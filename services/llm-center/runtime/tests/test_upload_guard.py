"""Run with python -m unittest discover -s tests -p 'test_upload_guard.py'."""
import ast
import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys

RUNTIME = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RUNTIME))
from upload_guard import BoundedUploads, is_upload_request, json_error
import upload_guard


class UploadGuardTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.cache = self.root / 'cache'
        self.cache.mkdir()
        self.calls = []
        self.persist = False

        async def app(scope, receive, send):
            body = bytearray()
            while True:
                event = await receive()
                body.extend(event.get('body', b''))
                if not event.get('more_body'):
                    break
            self.calls.append({'scope': scope, 'body': bytes(body)})
            if self.persist:
                await asyncio.sleep(0.01)
                (self.cache / f'upload-{len(self.calls)}').write_bytes(body)
            await send({'type': 'http.response.start', 'status': 200, 'headers': []})
            await send({'type': 'http.response.body', 'body': b'ok'})

        self.guard = BoundedUploads(app, self.cache, request_limit=128,
                                    cache_limit=512, memory_limit=16,
                                    temp_root=self.root, body_timeout=0.05)

    async def asyncTearDown(self):
        self.temp.cleanup()

    async def request(self, chunks, *, length=None, method='POST', path='/gradio_api/upload'):
        headers = [(b'content-type', b'multipart/form-data; boundary=x')]
        if length is not None:
            headers.append((b'content-length', str(length).encode()))
        else:
            headers.append((b'transfer-encoding', b'chunked'))
        scope = {'type': 'http', 'method': method, 'path': path, 'headers': headers}
        events = [{'type': 'http.request', 'body': body, 'more_body': i < len(chunks)-1}
                  for i, body in enumerate(chunks)]
        sent = []

        async def receive():
            return events.pop(0) if events else {'type': 'http.disconnect'}

        async def send(event):
            sent.append(event)

        await self.guard(scope, receive, send)
        statuses = [event['status'] for event in sent if event['type'] == 'http.response.start']
        return statuses[-1] if statuses else None

    async def test_missing_content_length_and_chunked_are_bounded(self):
        self.assertEqual(await self.request([b'a'*80, b'b'*80]), 413)
        self.assertEqual(self.calls, [])

    async def test_false_small_content_length_does_not_bypass_actual_limit(self):
        self.assertEqual(await self.request([b'a'*80, b'b'*80], length=1), 413)
        self.assertEqual(self.calls, [])

    async def test_content_length_mismatch_under_limit_is_rejected(self):
        self.assertEqual(await self.request([b'actual-body'], length=1), 400)
        self.assertEqual(self.calls, [])

    async def test_multipart_many_small_files_have_one_total_body_limit(self):
        parts = [b'--x\r\nContent-Disposition: form-data; name="f"\r\n\r\n' + b'a'*20 + b'\r\n'] * 3
        self.assertTrue(all(len(part) < 128 for part in parts))
        self.assertEqual(await self.request(parts), 413)
        self.assertEqual(self.calls, [])

    async def test_valid_chunked_body_replays_exact_content_and_framing(self):
        self.assertEqual(await self.request([b'first-', b'second']), 200)
        self.assertEqual(self.calls[0]['body'], b'first-second')
        headers = dict(self.calls[0]['scope']['headers'])
        self.assertEqual(headers[b'content-length'], b'12')
        self.assertNotIn(b'transfer-encoding', headers)

    async def test_request_at_limit_is_accepted_and_one_byte_over_is_rejected(self):
        self.assertEqual(await self.request([b'a'*128], length=128), 200)
        self.assertEqual(await self.request([b'a'*129]), 413)
        self.assertEqual(len(self.calls), 1)

    async def test_negative_or_invalid_declared_length_is_rejected(self):
        self.assertEqual(await self.request([b'a'], length=-1), 400)
        self.assertEqual(await self.request([b'a'], length='bad'), 400)

    async def test_tenant_cache_quota_applies_to_actual_chunked_bytes(self):
        (self.cache / 'existing').write_bytes(b'x'*480)
        self.assertEqual(await self.request([b'x'*40]), 413)
        self.assertEqual(self.calls, [])

    async def test_parallel_uploads_cannot_race_tenant_cache_limit(self):
        self.persist = True
        self.guard.cache_limit = 128
        results = await asyncio.gather(self.request([b'a'*80]), self.request([b'b'*80]))
        self.assertEqual(sorted(results), [200, 413])
        self.assertEqual(len(self.calls), 1)

    async def test_private_spool_rolls_to_disk_and_closes_after_success_or_rejection(self):
        opened = []
        original = tempfile.SpooledTemporaryFile

        def spool(*args, **kwargs):
            file = original(*args, **kwargs)
            opened.append(file)
            return file

        with patch.object(upload_guard.tempfile, 'SpooledTemporaryFile', spool):
            self.assertEqual(await self.request([b'a'*64]), 200)
            self.assertEqual(await self.request([b'a'*64, b'b'*80]), 413)
        self.assertTrue(all(file.closed for file in opened))
        self.assertTrue(all(file._rolled for file in opened))

    async def test_disconnect_cleans_spool_and_does_not_call_gradio(self):
        events = [{'type': 'http.request', 'body': b'a'*64, 'more_body': True}, {'type': 'http.disconnect'}]
        opened = []
        original = tempfile.SpooledTemporaryFile

        def spool(*args, **kwargs):
            file = original(*args, **kwargs)
            opened.append(file)
            return file

        async def receive(): return events.pop(0)
        async def send(event): pass
        with patch.object(upload_guard.tempfile, 'SpooledTemporaryFile', spool):
            await self.guard({'type': 'http', 'method': 'POST', 'path': '/upload', 'headers': []}, receive, send)
        self.assertEqual(self.calls, [])
        self.assertTrue(opened[0].closed)
        self.assertFalse(self.guard.lock.locked())

    async def test_receive_exception_cleans_spool_and_releases_lock(self):
        async def receive(): raise RuntimeError('fixture receive failure')
        async def send(event): pass
        with self.assertRaises(RuntimeError):
            await self.guard({'type': 'http', 'method': 'POST', 'path': '/upload', 'headers': []}, receive, send)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.guard.lock.locked())

    async def test_non_upload_get_sse_and_websocket_are_not_buffered(self):
        calls = []
        async def app(scope, receive, send): calls.append(scope)
        guard = BoundedUploads(app, self.cache, temp_root=self.root)
        async def receive(): raise AssertionError('non-upload body was consumed')
        async def send(event): pass
        for scope in [{'type': 'http', 'method': 'GET', 'path': '/gradio_api/upload_progress'},
                      {'type': 'http', 'method': 'GET', 'path': '/gradio_api/queue/data'},
                      {'type': 'http', 'method': 'GET', 'path': '/file=/tenant/exports/upload.bin'},
                      {'type': 'websocket', 'path': '/queue/join'}]:
            await guard(scope, receive, send)
        self.assertEqual(len(calls), 4)

    async def test_unauthorized_upload_is_rejected_before_read_or_spool(self):
        # Execute the exact integration class, with only an ASGI JSON response fixture.
        node = next(n for n in ast.parse((RUNTIME/'ui.py').read_text('utf-8')).body
                    if isinstance(n, ast.ClassDef) and n.name == 'InstanceAuth')
        class JsonResponse:
            def __init__(self, body, status_code): self.body, self.status = body, status_code
            async def __call__(self, scope, receive, send): await json_error(send, self.status, self.body['detail'])
        namespace = {'ASGIApp': object, 'Scope': dict, 'Receive': object, 'Send': object,
                     'TENANT': self.root, 'KEY': 'fixture-private-key', 'JSONResponse': JsonResponse}
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'reviewed-ui-auth', 'exec'), namespace)
        auth = namespace['InstanceAuth'](self.guard.app)
        async def receive(): raise AssertionError('unauthenticated upload body was read')
        sent = []
        async def send(event): sent.append(event)
        await auth({'type': 'http', 'method': 'POST', 'path': '/upload', 'headers': []}, receive, send)
        self.assertEqual(sent[0]['status'], 403)
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
