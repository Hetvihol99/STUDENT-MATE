import asyncio
import copy
import unittest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
import test_backend as backend_tests
from config import settings
from database import db_one
from routes.quizzes import quiz_schema, normalize_question, _validate_ai_question, citation_catalog, resolve_citation
from services.video import youtube_url, transcript_pages, _extract


class MediaTests(unittest.TestCase):
    setUp = backend_tests.BackendTests.setUp
    tearDown = backend_tests.BackendTests.tearDown
    seed = backend_tests.BackendTests.seed
    def test_youtube_links_are_canonical_and_cannot_fetch_arbitrary_hosts(self):
        canonical, vid = youtube_url('https://youtu.be/abcdefghijk?t=20')
        self.assertEqual(vid, 'abcdefghijk')
        self.assertEqual(canonical, 'https://www.youtube.com/watch?v=abcdefghijk')
        for link in ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'http://127.0.0.1/video', 'https://www.youtube.com/playlist?list=abc', 'https://youtube.com@evil.test/watch?v=abcdefghijk', 'https://youtube.com:8888/watch?v=abcdefghijk']:
            with self.assertRaises(HTTPException): youtube_url(link)

    def test_youtube_provided_transcript_is_ready_private_and_deletable(self):
        self.seed()
        response = self.client.post('/api/study/materials/youtube', json={'course':'DBMS Unit 1','url':'https://youtu.be/abcdefghijk','name':'Video lesson','transcript':'[00:00] A primary key uniquely identifies each row and cannot contain NULL.'})
        self.assertEqual(response.status_code, 201, response.text)
        mid = response.json()['id']
        page = self.client.get(f'/api/study/materials/{mid}/pages?page=1').json()
        self.assertEqual(page['type'], 'YouTube')
        self.assertEqual(page['transcriptSource'], 'provided')
        self.assertIn('primary key', page['text'])
        original = self.client.get(f'/api/study/materials/{mid}/file', follow_redirects=False)
        self.assertEqual(original.status_code, 307)
        self.assertEqual(original.headers['location'], 'https://www.youtube.com/watch?v=abcdefghijk')
        self.assertEqual(self.client.get(f'/api/study/materials/{mid}/pages?page=1',headers={'X-Dev-User-Id':'bob'}).status_code,404)
        self.assertEqual(self.client.delete(f'/api/study/materials/{mid}').status_code, 200)
        self.assertEqual(db_one('SELECT count(*) n FROM material_media WHERE material_id=?',mid)['n'],0)

    def test_video_upload_with_transcript_and_byte_ranges(self):
        self.seed()
        video = b'\x00\x00\x00\x18ftypisom' + b'\x00' * 40
        response = self.client.post('/api/study/materials', data={'course':'DBMS Unit 1','transcript':'A primary key uniquely identifies each row.'},files={'file':('lesson.mp4',video,'video/mp4')})
        self.assertEqual(response.status_code,201,response.text)
        mid = response.json()['id']
        ranged = self.client.get(f'/api/study/materials/{mid}/file',headers={'Range':'bytes=0-11'})
        self.assertEqual(ranged.status_code,206)
        self.assertEqual(ranged.content,video[:12])
        self.assertEqual(ranged.headers['content-type'],'video/mp4')
        self.assertEqual(self.client.get(f'/api/study/materials/{mid}/pages?page=1').json()['transcriptSource'],'provided')
        bad = self.client.post('/api/study/materials',data={'course':'DBMS Unit 1','transcript':'hi'},files={'file':('bad.mp4',b'not video','video/mp4')})
        self.assertEqual(bad.status_code,422)
        self.assertEqual(self.client.delete(f'/api/study/materials/{mid}').status_code,200)

    def test_youtube_auto_extraction_and_unavailable_fail_honestly(self):
        self.seed()
        body={'course':'DBMS Unit 1','url':'https://youtu.be/abcdefghijk'}
        self.assertEqual(self.client.post('/api/study/materials/youtube',json=body).status_code,503)
        settings.gemini_api_key='test'
        with patch('routes.materials.extract_youtube', AsyncMock(return_value=('Key lesson',['[00:00] A primary key uniquely identifies each row.']))):
            self.assertEqual(self.client.post('/api/study/materials/youtube',json=body).status_code,201)
        with patch('routes.materials.extract_youtube', AsyncMock(side_effect=HTTPException(422, {'error':'No speech found','code':'video_no_text'}))):
            self.assertEqual(self.client.post('/api/study/materials/youtube',json=body).status_code,422)
        states = self.client.get('/api/study/state').json()['materials']
        failed=next(m for m in states if m['status']=='Processing failed')
        self.assertEqual(failed['error'],'No speech found')
        self.assertEqual(self.client.get(f"/api/study/materials/{failed['id']}/pages?page=1").status_code,409)

    def test_ai_quiz_schema_and_non_mcq_render_contract(self):
        self.seed()
        up = self.client.post('/api/study/materials',data={'course':'DBMS Unit 1'},files={'file':('keys.txt',b'A primary key uniquely identifies each row.','text/plain')})
        mid=up.json()['id']
        from routes.helpers import get_evidence
        course=db_one('SELECT course_id FROM materials WHERE id=?',mid)['course_id']
        evidence=get_evidence('same_prefix_123456_alice',course,mid)[0]
        question={'type':'Short answer','difficulty':'Easy','prompt':'What uniquely identifies a row?','answer':'primary key','aliases':None,'options':[], 'explanation':'The primary key uniquely identifies each row.','citation':{'id':evidence['id'],'quote':'A primary key uniquely identifies each row.'}}
        settings.gemini_api_key='test'
        with patch('routes.quizzes.generate',AsyncMock(return_value={'questions':[question]})) as provider:
            response=self.client.post('/api/study/quizzes',json={'course':'DBMS Unit 1','materialId':mid,'topic':mid,'count':1,'type':'Short answer','difficulty':'Easy','mode':'Practice quiz','source':'ai'})
        self.assertEqual(response.status_code,201,response.text)
        self.assertNotIn('options',response.json()['questions'][0])
        schema=provider.call_args.kwargs['response_schema']
        self.assertEqual(schema['properties']['questions']['items']['properties']['type']['enum'],['Short answer'])
        self.assertEqual(schema['properties']['questions']['minItems'],1)
        question['type']='True/False'
        with self.assertRaises(HTTPException):_validate_ai_question(normalize_question(question),'Mixed','Adaptive',[evidence])
        submit=self.client.post(f"/api/study/quizzes/{response.json()['id']}/submit",json={'answers':{response.json()['questions'][0]['id']:'primary key'}})
        self.assertEqual(submit.json()['score'],100)

    def test_catalog_quotes_preserve_pdf_formulas_and_reject_fabrications(self):
        source={"id":"formula-source","text":"P(A∣B) = P(B∣A) P(A) / P(B).\nBayes’ theorem updates prior beliefs.","page":2,"materialId":"m","title":"Bayes"}
        catalog=citation_catalog([source])
        q={"type":"Short answer","difficulty":"Easy","prompt":"Which theorem updates prior beliefs?","answer":"Bayes' theorem","explanation":"Bayes' theorem updates beliefs.","citation":{"id":catalog[0]['id']}}
        resolved=resolve_citation(q,catalog)
        self.assertEqual(resolved['citation']['quote'],source['text'])
        _validate_ai_question(resolved,'Mixed','Adaptive',[source])
        q['citation']={'id':'invented'}
        with self.assertRaises(HTTPException):_validate_ai_question(resolve_citation(q,catalog),'Mixed','Adaptive',[source])
        q['citation']={'id':source['id'],'quote':'This quote was invented.'}
        with self.assertRaises(HTTPException):_validate_ai_question(resolve_citation(q,catalog),'Mixed','Adaptive',[source])

    def test_document_quiz_includes_later_pages_and_stores_exact_source(self):
        self.seed()
        with patch('routes.materials.extract_pages',return_value=['Lecture 16: Bayes theorem', 'Bayes theorem updates prior beliefs using evidence. P(A|B) = P(B|A) P(A) / P(B).']):
            up=self.client.post('/api/study/materials',data={'course':'DBMS Unit 1'},files={'file':('Bayes.pdf',b'%PDF-test','application/pdf')})
        mid=up.json()['id']
        settings.gemini_api_key='test'
        async def provider(prompt, **kwargs):
            self.assertTrue(any(source['page']==2 for source in prompt['sources']))
            entry=next(source for source in prompt['sources'] if source['page']==2)
            self.assertNotIn('quote',kwargs['response_schema']['properties']['questions']['items']['properties']['citation']['properties'])
            return {'questions':[{'type':'Short answer','difficulty':'Easy','prompt':'Which theorem updates prior beliefs?','answer':'Bayes theorem','explanation':'Bayes theorem updates prior beliefs using evidence.','citation':{'id':entry['id']}}]}
        with patch('routes.quizzes.generate',provider):
            response=self.client.post('/api/study/quizzes',json={'course':'DBMS Unit 1','materialId':mid,'topic':mid,'count':1,'type':'Short answer','difficulty':'Easy','mode':'Practice quiz','source':'ai'})
        self.assertEqual(response.status_code,201,response.text)
        self.assertEqual(response.json()['questions'][0]['page'],2)
        import json
        stored=json.loads(db_one('SELECT data FROM questions WHERE quiz_id=?',response.json()['id'])['data'])
        self.assertIn('P(A|B)',stored['citation']['quote'])

    def test_provider_upload_polling_and_cleanup(self):
        import httpx
        from services.video import extract_video
        settings.gemini_api_key='test'
        provider=AsyncMock()
        provider.__aenter__.return_value=provider
        provider.post.side_effect=[
            httpx.Response(200,headers={'x-goog-upload-url':'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=qa'}),
            httpx.Response(200,json={'file':{'name':'files/qa-test','uri':'https://generativelanguage.googleapis.com/v1beta/files/qa-test','state':'PROCESSING'}}),
        ]
        provider.get.return_value=httpx.Response(200,json={'name':'files/qa-test','uri':'https://generativelanguage.googleapis.com/v1beta/files/qa-test','state':'ACTIVE'})
        provider.delete.return_value=httpx.Response(200)
        with patch('services.video.httpx.AsyncClient',return_value=provider), patch('services.video.asyncio.sleep',AsyncMock()), patch('services.video._extract',AsyncMock(return_value=('Test',['[00:00] A primary key identifies a row.']))):
            title,pages=asyncio.run(extract_video('lesson.mp4',b'video','video/mp4'))
        self.assertEqual(title,'Test')
        provider.get.assert_awaited_once()
        provider.delete.assert_awaited_once()

    def test_document_topic_uses_the_first_readable_page(self):
        self.seed()
        with patch('routes.materials.extract_pages',return_value=['', 'A primary key uniquely identifies each row.']):
            response=self.client.post('/api/study/materials',data={'course':'DBMS Unit 1'},files={'file':('cover.pdf',b'%PDF-test','application/pdf')})
        self.assertEqual(response.status_code,201,response.text)
        topic=db_one('SELECT data FROM topics WHERE id=?',response.json()['id'])
        import json
        self.assertEqual(json.loads(topic['data'])['page'],2)

    def test_video_extraction_rejects_hallucinated_or_unordered_timestamps(self):
        for payload in [{'title':'x','segments':[]},{'title':'x','segments':[{'startSeconds':-1,'text':'text'}]},{'title':'x','segments':[{'startSeconds':3,'text':'text'},{'startSeconds':2,'text':'text'}]}]:
            with patch('services.video.generate',AsyncMock(return_value=payload)):
                with self.assertRaises(HTTPException):asyncio.run(_extract({'fileData':{}}))
        self.assertGreater(len(transcript_pages('Some useful lesson text. ' * 300)),1)


if __name__=='__main__':unittest.main()
