"""ASGI body limits and disconnect semantics required by real broker SSE responses."""
import ast
import asyncio
import re
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException, Request
from starlette.responses import JSONResponse


tree = ast.parse((Path(__file__).resolve().parents[1] / "control.py").read_text(encoding="utf-8"))
node = next(item for item in tree.body if isinstance(item, ast.ClassDef) and item.name == "ControlBodyGuard")
namespace = dict(Request=Request, HTTPException=HTTPException, JSONResponse=JSONResponse,
                 re=re, tempfile=tempfile, authorize=lambda *a, **kw: None,
                 tenant_id=lambda value: value, AGENTS=SimpleNamespace(authorize=lambda *a: None))
exec(compile(ast.Module(body=[node], type_ignores=[]), "control.py", "exec"), namespace)
Guard = namespace["ControlBodyGuard"]


def scope(headers=()):
    return {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
            "method": "POST", "path": "/broker/900001/v1/chat/completions", "headers": list(headers)}


class ControlBodyTests(unittest.IsolatedAsyncioTestCase):
    async def test_sse_disconnect_waits_after_final_body(self):
        disconnected = asyncio.Event()
        sent = False
        async def receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": b'{"stream":true}', "more_body": False}
            await disconnected.wait()
            return {"type": "http.disconnect"}
        async def application(_, replay, send):
            body = await replay()
            self.assertFalse(body["more_body"])
            watcher = asyncio.create_task(replay())
            await asyncio.sleep(0)
            self.assertFalse(watcher.done(), "SSE disconnect watcher must block, rather than spin on empty requests")
            disconnected.set()
            self.assertEqual((await watcher)["type"], "http.disconnect")
        await asyncio.wait_for(Guard(application)(scope(), receive, lambda _: None), 2)

    async def test_chunked_actual_bytes_override_forged_length(self):
        responses = []
        called = False
        async def receive():
            return {"type": "http.request", "body": b"x" * (20 * 1024**2 + 1), "more_body": False}
        async def send(message):
            responses.append(message)
        async def application(*_):
            nonlocal called
            called = True
        await Guard(application)(scope([(b"content-length", b"1")]), receive, send)
        self.assertFalse(called)
        self.assertEqual(responses[0]["status"], 413)

    async def test_unauthorized_body_is_not_read(self):
        responses = []
        called = False
        def deny(*_):
            raise HTTPException(403, "拒绝未认证请求")
        old = namespace["AGENTS"]
        namespace["AGENTS"] = SimpleNamespace(authorize=deny)
        async def receive():
            raise AssertionError("Unauthenticated body must never be consumed")
        async def send(message):
            responses.append(message)
        async def application(*_):
            nonlocal called
            called = True
        try:
            await Guard(application)(scope(), receive, send)
        finally:
            namespace["AGENTS"] = old
        self.assertFalse(called)
        self.assertEqual(responses[0]["status"], 403)


if __name__ == "__main__":
    unittest.main()
