import ast
import json
import pathlib
import re
import tempfile
import unittest
from types import SimpleNamespace

SOURCE = pathlib.Path(__file__).parents[1] / 'control.py'


class Denied(Exception):
    def __init__(self, status_code, detail):
        self.status_code, self.detail = status_code, detail


class Response:
    def __init__(self, payload, status_code):
        self.payload, self.status = payload, status_code

    async def __call__(self, scope, receive, send):
        await send({'type': 'http.response.start', 'status': self.status})
        await send({'type': 'http.response.body', 'body': json.dumps(self.payload).encode()})


class BodyTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, chunks, headers=(), authorized=True):
        seen, emitted = [], []
        async def downstream(scope, receive, send):
            content = b''
            while True:
                msg = await receive()
                content += msg.get('body', b'')
                if not msg.get('more_body'):
                    break
            seen.append((content, dict(scope['headers'])))
            await send({'type': 'http.response.start', 'status': 200})
        def auth(*args, **kwargs):
            if not authorized:
                raise Denied(401, '认证失败。')
        env = {'re': re, 'tempfile': tempfile, 'HTTPException': Denied, 'JSONResponse': Response, 'Request': lambda scope: SimpleNamespace(headers={k.decode(): v.decode() for k, v in scope['headers']}), 'authorize': auth}
        node = next(n for n in ast.parse(SOURCE.read_text()).body if isinstance(n, ast.ClassDef) and n.name == 'ControlBodyGuard')
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(SOURCE), 'exec'), env)
        events = [{'type': 'http.request', 'body': body, 'more_body': i < len(chunks) - 1} for i, body in enumerate(chunks)]
        reads = 0
        async def receive():
            nonlocal reads
            reads += 1
            return events.pop(0)
        async def send(event):
            emitted.append(event)
        scope = {'type': 'http', 'path': '/internal/tenants/1/chat', 'method': 'POST', 'headers': list(headers)}
        await env['ControlBodyGuard'](downstream)(scope, receive, send)
        return seen, emitted[0]['status'], reads

    async def test_unauthorized_denied_before_body_read(self):
        seen, status, reads = await self.exercise([b'private'], authorized=False)
        self.assertEqual((seen, status, reads), ([], 401, 0))

    async def test_chunked_actual_limit(self):
        seen, status, _ = await self.exercise([b'x' * 65536] * 321, [(b'transfer-encoding', b'chunked')])
        self.assertEqual((seen, status), ([], 413))

    async def test_forged_content_length_does_not_bypass(self):
        seen, status, _ = await self.exercise([b'x' * 65536] * 321, [(b'content-length', b'1')])
        self.assertEqual((seen, status), ([], 413))

    async def test_normal_bounded_body_and_exact_replay_header(self):
        seen, status, _ = await self.exercise([b'{"x":', b'1}'], [(b'transfer-encoding', b'chunked')])
        self.assertEqual(status, 200)
        self.assertEqual(seen[0][0], b'{"x":1}')
        self.assertEqual(seen[0][1][b'content-length'], b'7')
        self.assertNotIn(b'transfer-encoding', seen[0][1])


if __name__ == '__main__':
    unittest.main()
