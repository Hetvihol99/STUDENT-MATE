"""Bound API request bodies before parsing JSON or multipart uploads."""
from fastapi.responses import JSONResponse
from config import settings


class RequestBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] in ('GET', 'HEAD', 'OPTIONS') or not scope['path'].startswith('/api/study/'):
            return await self.app(scope, receive, send)
        headers = dict(scope['headers'])
        multipart = headers.get(b'content-type', b'').startswith(b'multipart/form-data')
        limit = max(settings.max_upload_mb, settings.max_video_mb) * 1024 * 1024 + settings.max_text_chars * 4 + 65536 if multipart else (settings.max_text_chars * 4 + 32768 if scope["path"] == "/api/study/materials/youtube" else 32768)
        parts = []
        size = 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            part = message.get('body', b'')
            size += len(part)
            if size > limit:
                response = JSONResponse(status_code=413, content={'error': 'This request exceeds the allowed size.', 'code': 'too_large'}, headers={'Cache-Control': 'no-store'})
                return await response(scope, receive, send)
            parts.append(part)
            if not message.get('more_body', False):
                break
        pending = True
        async def replay():
            nonlocal pending
            if pending:
                pending = False
                return {'type': 'http.request', 'body': b''.join(parts), 'more_body': False}
            return await receive()
        await self.app(scope, replay, send)
