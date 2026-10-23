"""Bound Gradio upload bodies before parsing or writing into a tenant cache.

The caller must authenticate the account instance before invoking this guard.
All non-upload requests bypass it, preserving SSE and WebSocket behavior.
"""
from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path


def is_upload_request(scope):
    return (scope["type"] == "http" and scope.get("method") == "POST"
            and scope.get("path", "").rstrip("/").endswith("/upload"))


async def json_error(send, status: int, detail: str):
    body = json.dumps({"detail": detail}, ensure_ascii=False).encode("utf-8")
    await send({"type": "http.response.start", "status": status,
                "headers": [(b"content-type", b"application/json; charset=utf-8"),
                            (b"content-length", str(len(body)).encode("ascii"))]})
    await send({"type": "http.response.body", "body": body})


class BoundedUploads:
    def __init__(self, app, cache_root: Path, *, request_limit=128 * 1024**2,
                 cache_limit=512 * 1024**2, memory_limit=8 * 1024**2,
                 temp_root=Path("/tmp"), body_timeout=60, lock_timeout=10):
        self.app = app
        self.cache_root = Path(cache_root)
        self.request_limit = request_limit
        self.cache_limit = cache_limit
        self.memory_limit = min(memory_limit, request_limit)
        self.temp_root = Path(temp_root)
        self.body_timeout = body_timeout
        self.lock_timeout = lock_timeout
        # One upload per account until Gradio finishes committing its cache files.
        self.lock = asyncio.Lock()

    def cache_bytes(self):
        total = 0
        root = self.cache_root.resolve()
        for path in root.rglob("*"):
            try:
                if path.is_file() and path.resolve().is_relative_to(root):
                    total += path.stat().st_size
            except FileNotFoundError:
                continue
        return total

    async def __call__(self, scope, receive, send):
        if not is_upload_request(scope):
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers", []))
        raw_length = headers.get(b"content-length")
        declared = None
        if raw_length is not None:
            try:
                declared = int(raw_length)
            except (TypeError, ValueError):
                await json_error(send, 400, "上传请求长度无效。")
                return
            if declared < 0:
                await json_error(send, 400, "上传请求长度无效。")
                return
            if declared > self.request_limit:
                await json_error(send, 413, "上传请求超过 128 MB，请减少文件数量或大小。")
                return
        response_started = False

        async def guarded_send(event):
            nonlocal response_started
            if event["type"] == "http.response.start":
                response_started = True
            await send(event)

        try:
            await asyncio.wait_for(self.lock.acquire(), timeout=self.lock_timeout)
        except TimeoutError:
            await json_error(send, 429, "当前账号正在上传文件，请稍后重试。")
            return

        try:
            used = await asyncio.to_thread(self.cache_bytes)
            remaining = self.cache_limit - used
            if remaining <= 0 or declared is not None and declared > remaining:
                await json_error(send, 413, "上传缓存已达到当前账号容量，请清理历史上传。")
                return
            # /tmp is a private, size-limited tmpfs in each account container.
            with tempfile.SpooledTemporaryFile(max_size=self.memory_limit, mode="w+b",
                                              dir=self.temp_root) as spool:
                actual = 0
                while True:
                    try:
                        event = await asyncio.wait_for(receive(), timeout=self.body_timeout)
                    except TimeoutError:
                        await json_error(send, 408, "上传等待超时，请重新上传。")
                        return
                    if event["type"] == "http.disconnect":
                        return
                    if event["type"] != "http.request":
                        await json_error(send, 400, "上传请求格式无效。")
                        return
                    chunk = event.get("body", b"")
                    actual += len(chunk)
                    if actual > self.request_limit or actual > remaining:
                        await json_error(send, 413, "上传请求超过当前账号允许的容量，请减少文件数量或大小。")
                        return
                    # Write only verified bytes. Never accumulate an unbounded body.
                    spool.write(chunk)
                    if not event.get("more_body", False):
                        break
                if declared is not None and declared != actual:
                    await json_error(send, 400, "上传请求长度不一致，请重新上传。")
                    return
                spool.seek(0)
                replayed = 0
                finished = False

                async def replay_receive():
                    nonlocal replayed, finished
                    if finished:
                        return await receive()
                    chunk = spool.read(65536)
                    replayed += len(chunk)
                    finished = replayed >= actual
                    return {"type": "http.request", "body": chunk, "more_body": not finished}

                # Replace transport framing with the exact bounded body length.
                replay_scope = dict(scope)
                replay_scope["headers"] = [(k, v) for k, v in scope.get("headers", [])
                                           if k.lower() not in {b"content-length", b"transfer-encoding"}]
                replay_scope["headers"].append((b"content-length", str(actual).encode("ascii")))
                await self.app(replay_scope, replay_receive, guarded_send)
        except OSError:
            if response_started:
                raise
            await json_error(send, 503, "上传临时空间暂时不可用，请稍后重试。")
        finally:
            self.lock.release()
