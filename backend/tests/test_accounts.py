import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from auth import COOKIE_NAME, token_hash
from config import settings
from database import _local, db_one, db_run
from main import app


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original = (settings.database_path, settings.storage_path, settings.auth_mode)
        settings.database_path = self.temp.name + '/accounts.db'
        settings.storage_path = self.temp.name + '/files'
        settings.auth_mode = 'session'
        _local.conn = None
        self.client = TestClient(app)
        self.client.headers.update({'Origin': 'http://localhost:5173', 'X-StudyMate-Request': '1'})

    def tearDown(self):
        self.client.close()
        if getattr(_local, 'conn', None):
            _local.conn.close()
        _local.conn = None
        settings.database_path, settings.storage_path, settings.auth_mode = self.original
        self.temp.cleanup()

    def register(self, client=None, email='alice@example.test', name='Alice'):
        client = client or self.client
        response = client.post('/api/study/auth/register', json={'name': name, 'email': email, 'password': 'A long test passphrase 123'})
        self.assertEqual(response.status_code, 201, response.text)
        return response

    def test_anonymous_and_forged_dev_identity_rejected(self):
        self.assertEqual(self.client.get('/api/study/auth/config').json()['provider'], 'password')
        for headers in [{'X-Dev-User-Id': 'dev_student_001'}, {'Cookie': 'studymate_session=forged'}, {'Cookie': '__studymate_local=1'}]:
            self.assertEqual(self.client.get('/api/study/state', headers=headers).status_code, 401)

    def test_register_cookie_password_hash_and_session_persistence(self):
        response = self.register()
        cookie = response.headers['set-cookie']
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=lax', cookie)
        token = self.client.cookies.get(COOKIE_NAME)
        account = db_one('SELECT * FROM auth_accounts')
        self.assertTrue(account['password_hash'].startswith('$argon2id$'))
        self.assertNotIn('test passphrase', account['password_hash'])
        session = db_one('SELECT * FROM auth_sessions')
        self.assertEqual(session['token_hash'], token_hash(token))
        self.assertNotEqual(session['token_hash'], token)
        self.assertEqual(self.client.post('/api/study/bootstrap').json()['user']['name'], 'Alice')
        self.assertEqual(self.client.post('/api/study/courses', json={'name': 'Physics'}).status_code, 201)
        self.assertEqual(self.client.post('/api/study/auth/logout').status_code, 200)
        self.assertEqual(self.client.get('/api/study/state').status_code, 401)
        login = self.client.post('/api/study/auth/login', json={'email': 'ALICE@example.test', 'password': 'A long test passphrase 123'})
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual(self.client.get('/api/study/state').json()['courses'], ['Physics'])
        self.assertNotEqual(token, self.client.cookies.get(COOKIE_NAME))
        self.assertEqual(self.client.get('/api/study/state', headers={'Cookie': COOKIE_NAME + '=' + token}).status_code, 401)

    def test_expiry_and_logout_revoke_access(self):
        self.register()
        db_run('UPDATE auth_sessions SET expires_at=?', int(time.time()) - 1)
        self.assertEqual(self.client.get('/api/study/state').status_code, 401)
        self.assertEqual(self.client.post('/api/study/auth/logout').status_code, 200)
        self.assertEqual(db_one('SELECT count(*) n FROM auth_sessions')['n'], 0)

    def test_validation_duplicate_csrf_and_wrong_credentials(self):
        self.assertEqual(self.client.post('/api/study/auth/register', json={'name': 'a', 'email': 'bad', 'password': 'tiny'}).status_code, 400)
        self.assertEqual(self.client.post('/api/study/auth/register', headers={'Origin': 'https://evil.test'}, json={'name': 'a', 'email': 'a@example.test', 'password': 'A long test passphrase 123'}).status_code, 403)
        self.register()
        duplicate = self.client.post('/api/study/auth/register', json={'name': 'Other', 'email': 'ALICE@example.test', 'password': 'A long test passphrase 123'})
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(db_one('SELECT count(*) n FROM profiles')['n'], 1)
        wrong = self.client.post('/api/study/auth/login', json={'email': 'alice@example.test', 'password': 'incorrect'})
        unknown = self.client.post('/api/study/auth/login', json={'email': 'unknown@example.test', 'password': 'incorrect'})
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(wrong.json(), unknown.json())

    def test_multiuser_isolation(self):
        self.register()
        mid = self.client.post('/api/study/seed').json()['materials'][0]['id']
        with TestClient(app, headers=dict(self.client.headers)) as other:
            self.register(other, 'bob@example.test', 'Bob')
            self.assertEqual(other.get('/api/study/state').json()['materials'], [])
            for method, url, body in [('GET', f'/api/study/materials/{mid}/file', None), ('DELETE', f'/api/study/materials/{mid}', None), ('PATCH', f'/api/study/materials/{mid}', {'name': 'stolen'})]:
                self.assertEqual(other.request(method, url, json=body).status_code, 404)
            self.assertEqual(other.get('/api/study/auth/me').json()['user']['email'], 'bob@example.test')

    def test_password_change_revokes_other_sessions(self):
        self.register()
        previous = self.client.cookies.get(COOKIE_NAME)
        response = self.client.post('/api/study/auth/password', json={'currentPassword': 'A long test passphrase 123', 'newPassword': 'My new long passphrase 456'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/api/study/state').status_code, 200)
        self.assertEqual(self.client.get('/api/study/state', headers={'Cookie': COOKIE_NAME + '=' + previous}).status_code, 401)
        self.assertEqual(self.client.post('/api/study/auth/login', json={'email': 'alice@example.test', 'password': 'A long test passphrase 123'}).status_code, 401)
        self.assertEqual(self.client.post('/api/study/auth/login', json={'email': 'alice@example.test', 'password': 'My new long passphrase 456'}).status_code, 200)

    def test_production_cookie_and_dev_headers(self):
        with patch.object(settings, 'app_env', 'production'):
            response = self.register()
            self.assertIn('Secure', response.headers['set-cookie'])
            self.assertEqual(self.client.get('/api/study/state').status_code, 401)  # HTTP cannot send the Secure cookie.
            with patch.object(settings, 'auth_mode', 'development'):
                self.assertEqual(self.client.get('/api/study/state', headers={'X-Dev-User-Id': 'dev_student_001'}).status_code, 401)

    def test_oversized_auth_request_rejected(self):
        response = self.client.post("/api/study/auth/login", content=b"x" * 32769, headers={"Content-Type": "application/json"})
        self.assertEqual(response.status_code, 413)

    def test_login_rate_limit(self):
        for _ in range(10):
            self.assertEqual(self.client.post('/api/study/auth/login', json={'email': 'unknown@example.test', 'password': 'incorrect'}).status_code, 401)
        self.assertEqual(self.client.post('/api/study/auth/login', json={'email': 'unknown@example.test', 'password': 'incorrect'}).status_code, 429)


if __name__ == '__main__':
    unittest.main()
