import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from fastapi.testclient import TestClient
from config import settings
from database import _local, db_one, db_run, get_db
from main import app
from routes.helpers import check_rate
from services.gemini import verify_citations
from services.extraction import extract_pages


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original = (settings.database_path, settings.storage_path, settings.gemini_api_key, settings.auth_mode)
        settings.auth_mode = "development"
        settings.database_path = self.temp.name + '/test.db'
        settings.storage_path = self.temp.name + '/files'
        settings.gemini_api_key = ''
        _local.conn = None
        self.client = TestClient(app)
        self.client.headers.update({'X-StudyMate-Request': '1', 'Origin': 'http://localhost:5173', 'X-Dev-User-Id': 'same_prefix_123456_alice'})
        self.assertEqual(self.client.post('/api/study/bootstrap').status_code, 200)

    def tearDown(self):
        self.client.close()
        if getattr(_local, 'conn', None):
            _local.conn.close()
        _local.conn = None
        settings.database_path, settings.storage_path, settings.gemini_api_key, settings.auth_mode = self.original
        self.temp.cleanup()

    def seed(self):
        res = self.client.post('/api/study/seed')
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    def test_origins_validation_and_production_guard(self):
        for origin in ['http://localhost.evil.test', 'https://evil.test/testserver']:
            self.assertEqual(self.client.post('/api/study/bootstrap', headers={'Origin': origin}).status_code, 403)
        res = self.client.post('/api/study/courses', json={'name': ''})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'validation')
        with patch.object(settings, 'app_env', 'production'):
            self.assertEqual(self.client.get('/api/study/state').status_code, 401)

    def test_rate_limit_persists_and_expires(self):
        check_rate('alice', 'test', 2)
        check_rate('alice', 'test', 2)
        with self.assertRaises(HTTPException) as raised:
            check_rate('alice', 'test', 2)
        self.assertEqual(raised.exception.status_code, 429)
        self.assertFalse(get_db().in_transaction)
        db_run('UPDATE rate_limits SET reset_at=0')
        check_rate('alice', 'test', 2)
        self.assertEqual(db_one('SELECT count FROM rate_limits')['count'], 1)

    def test_seed_download_isolation_and_reseed(self):
        state = self.seed()
        mid = state['materials'][0]['id']
        self.assertEqual(len(self.seed()['materials']), 1)
        self.assertIn('primary key', self.client.get(f'/api/study/materials/{mid}/file').text.lower())
        self.client.headers['X-Dev-User-Id'] = 'same_prefix_123456_bob'
        self.client.post('/api/study/bootstrap')
        self.assertEqual(self.client.get(f'/api/study/materials/{mid}/file').status_code, 404)
        self.assertNotEqual(self.seed()['materials'][0]['id'], mid)
        self.client.headers['X-Dev-User-Id'] = 'same_prefix_123456_alice'
        self.assertEqual(self.client.delete(f'/api/study/materials/{mid}').status_code, 200)
        self.assertEqual(self.seed()['materials'][0]['id'], mid)

    def test_upload_revision_delete_and_pdf(self):
        self.seed()
        res = self.client.post('/api/study/materials', data={'course': 'DBMS Unit 1'}, files={'file': ('notes.txt', b'A transaction is an atomic unit of work.', 'text/plain')})
        self.assertEqual(res.status_code, 201, res.text)
        mid = res.json()['id']
        self.assertEqual(self.client.post('/api/study/revision', json={'topic': mid}).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/study/materials/{mid}').status_code, 200)
        self.assertEqual(db_one('SELECT count(*) n FROM revisions')['n'], 0)
        sample = Path(__file__).resolve().parents[2] / 'frontend/sample-materials/DBMS-Unit-1.pdf'
        self.assertEqual(len(extract_pages('notes.pdf', sample.read_bytes(), 'application/pdf')), 4)
        res = self.client.post('/api/study/materials', data={'course': 'DBMS Unit 1'}, files={'file': ('large.txt', b'x' * (settings.max_upload_mb * 1024 * 1024 + 1), 'text/plain')})
        self.assertEqual(res.status_code, 413)

    def test_diagnostic_balances_topics_and_prioritizes_unseen(self):
        from services.curriculum import select_questions, INITIAL_TOPICS
        selected = select_questions("all", "Mixed", "Adaptive", 4, [])
        self.assertEqual({q["topic"] for q in selected}, {t["id"] for t in INITIAL_TOPICS})
        seen = [q["id"] for q in selected]
        self.assertTrue(all(q["id"] not in seen for q in select_questions("all", "Mixed", "Adaptive", 4, seen)))

    def test_quiz_grading_idempotency_and_delete(self):
        mid = self.seed()['materials'][0]['id']
        res = self.client.post('/api/study/quizzes', json={'course': 'DBMS Unit 1', 'materialId': mid, 'topic': 'keys', 'type': 'Mixed', 'difficulty': 'Adaptive', 'count': 3, 'mode': 'Practice quiz', 'source': 'prepared'})
        self.assertEqual(res.status_code, 201, res.text)
        quiz = res.json()
        self.assertTrue(all('answer' not in q for q in quiz['questions']))
        import json
        from database import db_all
        questions = [json.loads(r['data']) for r in db_all('SELECT data FROM questions WHERE quiz_id=?', quiz['id'])]
        url = f"/api/study/quizzes/{quiz['id']}/submit"
        result = self.client.post(url, json={'answers': {q['id']: q['answer'] for q in questions}}).json()
        self.assertEqual(result['score'], 100)
        self.assertEqual(self.client.post(url, json={'answers': {}}).json()['id'], result['id'])
        self.assertEqual(self.client.delete(f'/api/study/materials/{mid}').status_code, 200)
        self.assertEqual(db_one('SELECT count(*) n FROM attempts')['n'], 0)

    def test_malformed_ai_does_not_save(self):
        mid = self.seed()['materials'][0]['id']
        body = {'course': 'DBMS Unit 1', 'materialId': mid, 'question': 'primary key', 'style': 'Simple'}
        self.assertEqual(self.client.post('/api/study/chat', json=body).status_code, 503)
        settings.gemini_api_key = 'test'
        with patch('routes.chat.generate', AsyncMock(return_value={'answer': 'Wrong', 'supported': 'yes', 'citations': []})):
            self.assertEqual(self.client.post('/api/study/chat', json=body).status_code, 502)
        self.assertEqual(self.client.get('/api/study/conversations').json(), [])
        for refs in [[], ['bad'], [{'id': 'a', 'quote': ''}], [{'id': 'a', 'quote': 1}]]:
            with self.assertRaises(HTTPException):
                verify_citations(refs, [{'id': 'a', 'text': 'Actual source quote'}])


if __name__ == '__main__':
    unittest.main()
