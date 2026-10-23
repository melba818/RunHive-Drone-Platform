"""Runhive-authenticated, tenant-selecting proxy for isolated LLaMA-Factory instances.

Only the PHP exchange/identity responses determine the tenant. Browser headers, query
parameters, cookies belonging to other applications, and paths cannot select a worker.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse, RedirectResponse, StreamingResponse
from websockets.asyncio.client import connect as ws_connect

PREFIX = "/llm-center"
COOKIE = "llm_center_session"
HOP_HEADERS = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"}
BLOCK_REQUEST_HEADERS = HOP_HEADERS | {"host", "cookie", "authorization", "x-runos-internal-key", "x-llm-internal-key", "x-llm-instance-key", "x-llm-tenant-id", "x-tenant-id", "x-admin-id", "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-prefix"}


@dataclass
class Settings:
    php_url: str = "http://127.0.0.1:1819"
    runtime_url: str = "http://127.0.0.1:4021"
    internal_key_file: str = "/secrets/llm-center-internal-secret.txt"
    runtime_key_file: str = "/secrets/llm-center-runtime-secret.txt"
    state_db: str = "/state/sessions.sqlite3"
    secure_cookie: bool = False
    identity_interval: int = 15
    upstream_port_min: int = 40100
    upstream_port_max: int = 49999

    @classmethod
    def environment(cls):
        return cls(
            php_url=os.getenv("LLM_PHP_URL", cls.php_url).rstrip("/"),
            runtime_url=os.getenv("LLM_RUNTIME_URL", cls.runtime_url).rstrip("/"),
            internal_key_file=os.getenv("LLM_INTERNAL_KEY_FILE", cls.internal_key_file),
            runtime_key_file=os.getenv("LLM_RUNTIME_KEY_FILE", cls.runtime_key_file),
            state_db=os.getenv("LLM_SESSION_DB", cls.state_db),
            secure_cookie=os.getenv("LLM_COOKIE_SECURE", "0") == "1",
        )


class Sessions:
    def __init__(self, filename):
        self.path = Path(filename)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.execute("CREATE TABLE IF NOT EXISTS sessions (sid_hash TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, php_handle TEXT NOT NULL, username TEXT NOT NULL, expires_at INTEGER NOT NULL)")
        os.chmod(self.path, 0o600)

    def connection(self):
        return sqlite3.connect(self.path, timeout=10)

    @staticmethod
    def key(sid):
        return hashlib.sha256(sid.encode("ascii")).hexdigest()

    def create(self, identity):
        tenant = identity.get("admin_id")
        handle = identity.get("session_handle", "")
        if type(tenant) is not int or tenant <= 0 or not re.fullmatch(r"[a-f0-9]{64}", handle):
            raise HTTPException(401, "大模型中心登录身份无效")
        sid = secrets.token_hex(32)
        now = int(time.time())
        expiry = min(int(identity.get("expires_at", now + 28800)), now + 28800)
        if expiry <= now:
            raise HTTPException(401, "大模型中心登录已过期")
        with self.connection() as db:
            db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
            db.execute("INSERT INTO sessions VALUES (?, ?, ?, ?, ?)", (self.key(sid), tenant, handle, str(identity.get("username", "")), expiry))
        return sid

    def get(self, sid):
        if not isinstance(sid, str) or not re.fullmatch(r"[a-f0-9]{64}", sid):
            raise HTTPException(401, "请从 Runhive 登录后进入大模型中心")
        with self.connection() as db:
            db.row_factory = sqlite3.Row
            row = db.execute("SELECT * FROM sessions WHERE sid_hash = ? AND expires_at > ?", (self.key(sid), int(time.time()))).fetchone()
        if row is None:
            raise HTTPException(401, "大模型中心会话已失效，请重新进入")
        return dict(row)

    def revoke(self, sid):
        if sid and re.fullmatch(r"[a-f0-9]{64}", sid):
            with self.connection() as db:
                db.execute("DELETE FROM sessions WHERE sid_hash = ?", (self.key(sid),))


def secret_file(filename):
    key = Path(filename).read_text(encoding="utf-8").strip()
    if len(key) < 64:
        raise RuntimeError("大模型中心内部密钥缺失")
    return key


def same_origin(headers):
    origin = headers.get("origin", "")
    if not origin:
        return False
    parsed = urlsplit(origin)
    return parsed.scheme in {"http", "https"} and parsed.netloc.lower() == headers.get("host", "").lower() and not parsed.username and not parsed.password


def safe_proxy_path(path):
    decoded = path
    for _ in range(4):
        newer = unquote(decoded)
        if newer == decoded:
            break
        decoded = newer
    if "\x00" in decoded or "\\" in decoded or any(part == ".." for part in decoded.split("/")):
        raise HTTPException(400, "文件或请求路径无效")
    # The runtime mounts only this account at /tenant. Shared base models are blocked.
    marker = "file="
    if marker in decoded:
        filename = decoded.split(marker, 1)[1]
        if filename.startswith("/") and not filename.startswith(("/tenant/exports/", "/tenant/cache/gradio/")):
            raise HTTPException(403, "文件不在当前账号工作区")
    return path


def checked_upstream(payload, tenant, settings):
    if not isinstance(payload, dict) or payload.get("tenant_id") != tenant:
        raise HTTPException(502, "大模型中心实例身份不匹配")
    base = payload.get("base_url", "")
    url = urlsplit(base)
    if url.scheme != "http" or url.hostname != "127.0.0.1" or url.username or url.password or url.path not in {"", "/"} or url.query or url.fragment or not settings.upstream_port_min <= (url.port or 0) <= settings.upstream_port_max:
        raise HTTPException(502, "大模型中心实例地址无效")
    key = payload.get("instance_key", "")
    if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{64,128}", key) or payload.get("state") != "ready":
        raise HTTPException(503, "大模型中心实例尚未就绪")
    return base.rstrip("/"), key


def create_app(settings=None, client=None, sessions=None, websocket_connector=ws_connect):
    settings = settings or Settings.environment()

    @asynccontextmanager
    async def lifespan(app):
        app.state.client = client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, read=None), follow_redirects=False)
        app.state.sessions = sessions or Sessions(settings.state_db)
        app.state.internal_key = secret_file(settings.internal_key_file)
        app.state.runtime_key = secret_file(settings.runtime_key_file)
        try:
            yield
        finally:
            if client is None:
                await app.state.client.aclose()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

    async def php(action, data):
        try:
            response = await app.state.client.post(settings.php_url + "/api/Llmcenter/" + action, json=data, headers={"X-LLM-Internal-Key": app.state.internal_key})
            payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, "统一登录服务暂时不可用")
        if response.status_code != 200 or not isinstance(payload, dict) or payload.get("code") != 1 or not isinstance(payload.get("data"), dict):
            raise HTTPException(401, "Runhive 登录已失效或账号已停用，请重新登录")
        return payload["data"]

    async def authenticate(sid):
        session = app.state.sessions.get(sid)
        identity = await php("identity", {"session_handle": session["php_handle"]})
        if identity.get("admin_id") != session["tenant_id"]:
            app.state.sessions.revoke(sid)
            raise HTTPException(401, "大模型中心会话身份不匹配")
        return session

    async def upstream(session):
        try:
            response = await app.state.client.post(settings.runtime_url + "/internal/instances/ensure", json={"tenant_id": session["tenant_id"]}, headers={"Authorization": "Bearer " + app.state.runtime_key}, timeout=180)
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, "大模型中心实例正在准备，请稍后重试")
        return checked_upstream(data, session["tenant_id"], settings)

    @app.exception_handler(HTTPException)
    async def error_handler(request, exc):
        response = JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
        if exc.status_code == 401:
            app.state.sessions.revoke(request.cookies.get(COOKIE, ""))
            response.delete_cookie(COOKIE, path=PREFIX + "/", httponly=True, samesite="strict", secure=settings.secure_cookie)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Content-Security-Policy"] = "frame-ancestors 'self'"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get(PREFIX + "/health")
    async def health():
        return {"status": "healthy", "service": "llm-center-gateway"}

    @app.get(PREFIX + "/")
    async def bootstrap():
        from starlette.responses import HTMLResponse
        return HTMLResponse(Path(__file__).with_name("bootstrap.html").read_text(encoding="utf-8"))

    @app.post(PREFIX + "/auth/exchange")
    async def launch(request: Request):
        if not same_origin(request.headers):
            raise HTTPException(403, "请求来源无效")
        try:
            payload = await request.json()
        except ValueError:
            raise HTTPException(400, "登录请求格式无效")
        ticket = payload.get("ticket", "") if isinstance(payload, dict) else ""
        if not isinstance(ticket, str) or not re.fullmatch(r"[a-f0-9]{64}", ticket):
            raise HTTPException(401, "登录票据无效或已过期")
        # A ticket is exchangeable only at the app-specific PHP endpoint.
        identity = await php("exchange", {"ticket": ticket})
        app.state.sessions.revoke(request.cookies.get(COOKIE, ""))
        sid = app.state.sessions.create(identity)
        session = app.state.sessions.get(sid)
        try:
            base, key = await upstream(session)
            ready = await app.state.client.get(base + "/health", headers={"X-LLM-Instance-Key": key}, timeout=10)
            ready.raise_for_status()
        except (HTTPException, httpx.HTTPError):
            app.state.sessions.revoke(sid)
            raise HTTPException(503, "大模型中心实例正在准备，请稍后重试")
        response = JSONResponse({"admin_id": session["tenant_id"], "ready": True})
        response.set_cookie(COOKIE, sid, max_age=28800, path=PREFIX + "/", httponly=True, samesite="strict", secure=settings.secure_cookie)
        return response

    @app.get(PREFIX + "/auth/me")
    async def me(request: Request):
        session = await authenticate(request.cookies.get(COOKIE, ""))
        return {"admin_id": session["tenant_id"], "username": session["username"]}

    @app.get(PREFIX + "/auth/ready")
    async def ready(request: Request):
        session = await authenticate(request.cookies.get(COOKIE, ""))
        base, key = await upstream(session)
        try:
            result = await app.state.client.get(base + "/health", headers={"X-LLM-Instance-Key": key}, timeout=10)
            result.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(503, "大模型中心实例正在准备，请稍后重试")
        return {"admin_id": session["tenant_id"], "ready": True}

    @app.post(PREFIX + "/auth/logout")
    async def logout(request: Request):
        if not same_origin(request.headers):
            raise HTTPException(403, "请求来源无效")
        sid = request.cookies.get(COOKIE, "")
        session = app.state.sessions.get(sid)
        try:
            await php("revoke", {"session_handle": session["php_handle"]})
        finally:
            app.state.sessions.revoke(sid)
        response = JSONResponse({"detail": "已退出大模型中心"})
        response.delete_cookie(COOKIE, path=PREFIX + "/", httponly=True, samesite="strict", secure=settings.secure_cookie)
        return response

    @app.api_route(PREFIX + "/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def proxy(request: Request, path: str):
        sid = request.cookies.get(COOKIE, "")
        session = await authenticate(sid)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not same_origin(request.headers):
            raise HTTPException(403, "请求来源无效")
        safe_proxy_path(path)
        base, instance_key = await upstream(session)
        if path == "ui":
            path = ""
        elif path.startswith("ui/"):
            # The embedded Gradio page uses ./assets/... and its dynamic imports
            # are relative to /ui/. Map that entire subpath to the instance root.
            path = path[3:]
        url = base + "/" + path + ("?" + request.url.query if request.url.query else "")
        headers = {k: v for k, v in request.headers.items() if k.lower() not in BLOCK_REQUEST_HEADERS}
        headers["X-Forwarded-Prefix"] = PREFIX
        headers["X-Forwarded-Proto"] = request.url.scheme
        headers["X-Forwarded-Host"] = request.headers.get("host", "")
        headers["X-LLM-Instance-Key"] = instance_key
        async def request_body():
            async for chunk in request.stream():
                yield chunk
        try:
            outgoing = app.state.client.build_request(request.method, url, headers=headers, content=request_body())
            result = await app.state.client.send(outgoing, stream=True)
        except httpx.HTTPError:
            raise HTTPException(503, "大模型中心服务暂时不可用")
        result_headers = {k: v for k, v in result.headers.items() if k.lower() not in HOP_HEADERS | {"set-cookie", "content-security-policy", "x-frame-options"}}
        location = result_headers.get("location")
        if location:
            target = urlsplit(location)
            if target.netloc and not location.startswith(base + "/"):
                await result.aclose()
                raise HTTPException(502, "大模型中心重定向地址无效")
            if location.startswith(base):
                result_headers["location"] = PREFIX + location[len(base):]
            elif location.startswith("/") and not location.startswith(PREFIX + "/"):
                result_headers["location"] = PREFIX + location

        async def response_body():
            iterator = result.aiter_raw().__aiter__()
            pending = None
            checked = time.monotonic()
            try:
                while True:
                    if pending is None:
                        pending = asyncio.create_task(iterator.__anext__())
                    done, _ = await asyncio.wait({pending}, timeout=settings.identity_interval)
                    if time.monotonic() - checked >= settings.identity_interval:
                        await authenticate(sid)
                        checked = time.monotonic()
                    if done:
                        try:
                            chunk = pending.result()
                        except StopAsyncIteration:
                            return
                        pending = None
                        yield chunk
            except HTTPException:
                app.state.sessions.revoke(sid)
                return
            finally:
                if pending is not None and not pending.done():
                    pending.cancel()
                await result.aclose()
        return StreamingResponse(response_body(), status_code=result.status_code, headers=result_headers, background=BackgroundTask(result.aclose))

    @app.websocket(PREFIX + "/{path:path}")
    async def websocket_proxy(ws: WebSocket, path: str):
        try:
            if not same_origin(ws.headers):
                raise HTTPException(403, "请求来源无效")
            sid = ws.cookies.get(COOKIE, "")
            session = await authenticate(sid)
            safe_proxy_path(path)
            base, instance_key = await upstream(session)
        except HTTPException:
            await ws.close(code=4401)
            return
        query = ws.url.query
        target = base.replace("http://", "ws://", 1) + "/" + path + ("?" + query if query else "")
        await ws.accept()
        tasks = []
        try:
            async with websocket_connector(target, origin=ws.headers.get("origin"), additional_headers={"X-LLM-Instance-Key": instance_key}, max_size=32 * 1024 * 1024) as remote:
                async def inbound():
                    while True:
                        message = await ws.receive()
                        if message["type"] == "websocket.disconnect":
                            return
                        await remote.send(message.get("text") if message.get("text") is not None else message.get("bytes", b""))
                async def outbound():
                    async for message in remote:
                        if isinstance(message, str):
                            await ws.send_text(message)
                        else:
                            await ws.send_bytes(message)
                async def verify_live():
                    while True:
                        await asyncio.sleep(settings.identity_interval)
                        await authenticate(sid)
                tasks = [asyncio.create_task(inbound()), asyncio.create_task(outbound()), asyncio.create_task(verify_live())]
                done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task.result()
        except (WebSocketDisconnect, HTTPException, OSError):
            pass
        finally:
            for task in tasks:
                task.cancel()
            try:
                await ws.close(code=1000)
            except RuntimeError:
                pass

    return app


app = create_app()
