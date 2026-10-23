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
from urllib.parse import unquote, urlsplit, parse_qs, urlencode, quote
import posixpath

import httpx
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse, RedirectResponse, StreamingResponse
from websockets.asyncio.client import connect as ws_connect

PREFIX = "/llm-center"
COOKIE = "llm_center_session"
FAMILY_COOKIE = "llm_center_browser"
MODULES = {"tune": (40100, 40999), "agent": (41100, 41999)}
SECTIONS = {"tune": {"workspace", "data", "train", "eval", "chat", "export"}, "agent": {"projects", "agents", "skills", "models", "runs", "evaluations"}}


def module_prefix(module):
    if module not in MODULES:
        raise HTTPException(404, "中心不存在")
    return PREFIX + "/" + module


def module_cookie(module):
    module_prefix(module)
    return COOKIE + "_" + module
HOP_HEADERS = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"}
BLOCK_REQUEST_HEADERS = HOP_HEADERS | {"host", "cookie", "authorization", "x-runos-internal-key", "x-llm-internal-key", "x-llm-instance-key", "x-llm-tenant-id", "x-llm-preview-root", "x-tenant-id", "x-admin-id", "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-prefix"}


@dataclass
class Settings:
    php_url: str = "http://127.0.0.1:1819"
    runtime_url: str = "http://127.0.0.1:4021"
    internal_key_file: str = "/secrets/llm-center-internal-secret.txt"
    runtime_key_file: str = "/secrets/llm-center-runtime-secret.txt"
    state_db: str = "/state/dual-sessions.sqlite3"
    secure_cookie: bool = False
    identity_interval: int = 15
    upstream_port_min: int = 40100
    upstream_port_max: int = 49999
    upstream_cache_seconds: float = 30.0

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
            db.execute("CREATE TABLE IF NOT EXISTS browser_groups (family_hash TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS dual_sessions (sid_hash TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, module TEXT NOT NULL, family_hash TEXT NOT NULL, php_handle TEXT NOT NULL, username TEXT NOT NULL, expires_at INTEGER NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS preview_caps (cap_hash TEXT PRIMARY KEY, sid_hash TEXT NOT NULL, target TEXT NOT NULL, expires_at INTEGER NOT NULL)")
        os.chmod(self.path, 0o600)

    def connection(self):
        return sqlite3.connect(self.path, timeout=10)

    @staticmethod
    def key(sid):
        return hashlib.sha256(sid.encode("ascii")).hexdigest()

    def create(self, identity, module, family=""):
        module_prefix(module)
        tenant = identity.get("admin_id")
        handle = identity.get("session_handle", "")
        if identity.get("module") != module or type(tenant) is not int or tenant <= 0 or not re.fullmatch(r"[a-f0-9]{64}", handle):
            raise HTTPException(401, "大模型中心登录身份无效")
        sid = secrets.token_hex(32)
        now = int(time.time())
        expiry = min(int(identity.get("expires_at", now + 28800)), now + 28800)
        if expiry <= now:
            raise HTTPException(401, "大模型中心登录已过期")
        if not re.fullmatch(r"[a-f0-9]{64}", family):
            family = secrets.token_hex(32)
        family_hash = self.key(family)
        with self.connection() as db:
            existing = db.execute("SELECT tenant_id FROM browser_groups WHERE family_hash = ? AND expires_at > ?", (family_hash, now)).fetchone()
            if existing is not None and existing[0] != tenant:
                db.execute("DELETE FROM dual_sessions WHERE family_hash = ?", (family_hash,))
            db.execute("INSERT INTO browser_groups VALUES (?, ?, ?) ON CONFLICT(family_hash) DO UPDATE SET tenant_id = excluded.tenant_id, expires_at = excluded.expires_at", (family_hash, tenant, expiry))
            db.execute("DELETE FROM dual_sessions WHERE expires_at <= ?", (now,))
            db.execute("DELETE FROM browser_groups WHERE expires_at <= ?", (now,))
            db.execute("INSERT INTO dual_sessions VALUES (?, ?, ?, ?, ?, ?, ?)", (self.key(sid), tenant, module, family_hash, handle, str(identity.get("username", "")), expiry))
        return sid, family

    def get(self, sid, module, family):
        module_prefix(module)
        if not isinstance(sid, str) or not re.fullmatch(r"[a-f0-9]{64}", sid):
            raise HTTPException(401, "请从 Runhive 登录后进入大模型中心")
        if not isinstance(family, str) or not re.fullmatch(r"[a-f0-9]{64}", family):
            raise HTTPException(401, "浏览器登录状态已失效，请重新进入")
        with self.connection() as db:
            db.row_factory = sqlite3.Row
            row = db.execute("SELECT s.* FROM dual_sessions s JOIN browser_groups g ON g.family_hash = s.family_hash AND g.tenant_id = s.tenant_id WHERE s.sid_hash = ? AND s.module = ? AND s.family_hash = ? AND s.expires_at > ? AND g.expires_at > ?", (self.key(sid), module, self.key(family), int(time.time()), int(time.time()))).fetchone()
        if row is None:
            raise HTTPException(401, "大模型中心会话已失效，请重新进入")
        return dict(row)

    def revoke(self, sid, module):
        if sid and re.fullmatch(r"[a-f0-9]{64}", sid):
            with self.connection() as db:
                db.execute("DELETE FROM dual_sessions WHERE sid_hash = ? AND module = ?", (self.key(sid), module))

    def create_preview(self, session, target, renew_url=''):
        match = re.fullmatch(r'/llm-center/agent/preview/([a-f0-9]{64})/[^/?#]+', renew_url) if isinstance(renew_url,str) else None
        cap = match[1] if match else secrets.token_hex(32)
        expiry = min(int(time.time()) + 120, session['expires_at'])
        with self.connection() as db:
            if match:
                existing = db.execute('SELECT sid_hash,target FROM preview_caps WHERE cap_hash = ?', (self.key(cap),)).fetchone()
                if existing is None or existing[0] != session['sid_hash'] or json.loads(existing[1]) != target:
                    raise HTTPException(403, '应用预览续期身份不匹配')
                db.execute('UPDATE preview_caps SET expires_at = ? WHERE cap_hash = ?', (expiry,self.key(cap)))
                return cap
            db.execute("DELETE FROM preview_caps WHERE expires_at <= ?", (int(time.time()),))
            db.execute("INSERT INTO preview_caps VALUES (?, ?, ?, ?)", (self.key(cap), session['sid_hash'], json.dumps(target), expiry))
        return cap

    def preview(self, cap):
        if not re.fullmatch(r'[a-f0-9]{64}', cap):
            raise HTTPException(401, '应用预览凭据无效')
        with self.connection() as db:
            db.row_factory = sqlite3.Row
            row = db.execute("SELECT s.*, p.target FROM preview_caps p JOIN dual_sessions s ON s.sid_hash = p.sid_hash AND s.module = 'agent' JOIN browser_groups g ON g.family_hash = s.family_hash AND g.tenant_id = s.tenant_id WHERE p.cap_hash = ? AND p.expires_at > ? AND s.expires_at > ? AND g.expires_at > ?", (self.key(cap), int(time.time()), int(time.time()), int(time.time()))).fetchone()
        if row is None:
            raise HTTPException(401, '应用预览已过期，请重新打开')
        row = dict(row)
        return row, json.loads(row.pop('target'))


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


def safe_proxy_path(path, module="tune"):
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
    if module == "tune" and marker in decoded:
        filename = decoded.split(marker, 1)[1]
        if filename.startswith("/") and not filename.startswith(("/tenant/exports/", "/tenant/cache/gradio/")):
            raise HTTPException(403, "文件不在当前账号工作区")
    return path


def checked_upstream(payload, tenant, settings, module):
    module_prefix(module)
    if not isinstance(payload, dict) or payload.get("tenant_id") != tenant or payload.get("module") != module:
        raise HTTPException(502, "大模型中心实例身份不匹配")
    base = payload.get("base_url", "")
    url = urlsplit(base)
    port_min, port_max = MODULES[module]
    if url.scheme != "http" or url.hostname != "127.0.0.1" or url.username or url.password or url.path not in {"", "/"} or url.query or url.fragment or not port_min <= (url.port or 0) <= port_max:
        raise HTTPException(502, "大模型中心实例地址无效")
    key = payload.get("instance_key", "")
    if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{64,128}", key) or payload.get("state") != "ready":
        raise HTTPException(503, "大模型中心实例尚未就绪")
    native_token = payload.get("native_token", "")
    if module == "agent" and (not isinstance(native_token, str) or not 32 <= len(native_token) <= 4096 or any(c in native_token for c in "\r\n\x00")):
        raise HTTPException(503, "智能体工作区尚未就绪")
    return base.rstrip("/"), key, native_token


def agent_feature_operation(path, method):
    read = method in {"GET", "HEAD"}
    if read and re.fullmatch(r"api/plugins(?:/registry(?:/readme)?|/[A-Za-z0-9_-]+/files)?/?", path):
        return True
    if re.fullmatch(r"api/admin/plugin-config/?", path):
        return read or method == "PUT"
    if re.fullmatch(r"api/admin/plugin-config/action/?", path):
        return method == "POST"
    machines = re.fullmatch(r"api/projects/[A-Za-z0-9_-]+/machines(?:/(.*?))?/?", path)
    if not machines:
        return False
    action = (machines.group(1) or "").rstrip("/")
    if not action:
        return read
    if action == "ssh-hosts":
        return method == "POST"
    if re.fullmatch(r"ssh-hosts/[A-Za-z0-9_.-]+", action):
        return read or method == "PUT"
    if action in {"probe", "use", "stop-using"}:
        return method == "POST"
    if re.fullmatch(r"[A-Za-z0-9_-]+/dirs", action):
        return read
    return method == "POST" and bool(re.fullmatch(r"[A-Za-z0-9_-]+/(install|connect|disconnect|release|restart)", action))


def guard_agent_operation(path, method="GET"):
    decoded = path
    for _ in range(8):
        newer = unquote(decoded)
        if newer == decoded:
            break
        decoded = newer
    if "\x00" in decoded or "\\" in decoded or ".." in decoded.split("/"):
        raise HTTPException(403, "文件或请求路径无效")
    if agent_feature_operation(decoded, method):
        return
    path = decoded
    denied = re.match(r"^api/(auth|admin|hmr|install|desktop|terminals|machines|builtin-browser|plugins|platform-auth|modelscope-auth|model-oauth)(/|$)", path)
    if denied or re.search(r"/(machines|pairing|vault)(/|$)", path) or re.match(r"^api/me/(password|profile)(/|$)", path):
        raise HTTPException(403, "此操作由平台统一管理")


def preview_target(source):
    if not isinstance(source, str) or len(source) > 4096:
        raise HTTPException(400, '应用预览路径无效')
    parsed = urlsplit(source)
    if parsed.netloc or parsed.scheme or parsed.fragment:
        raise HTTPException(400, '应用预览仅支持当前工作区')
    path = parsed.path.removeprefix('/llm-center/agent')
    safe_proxy_path(path, 'agent')
    query = parse_qs(parsed.query, keep_blank_values=True)
    if re.fullmatch(r'/api/(sessions/[A-Za-z0-9_-]+/files|projects/[A-Za-z0-9_-]+/workspace-files)/content', path):
        if set(query) - {'path', 'workspace', 'preview'} or any(len(v) != 1 for v in query.values()):
            raise HTTPException(400, '应用预览参数无效')
        filename = query.get('path', [''])[0]
        safe_proxy_path(filename, 'agent')
        if filename.startswith('/') or not filename.lower().endswith(('.html', '.htm')):
            raise HTTPException(400, '应用预览需要工作区 HTML 入口')
        directory, entry = posixpath.split(filename)
        # A capability never covers the workspace root or sibling applications.
        if not directory or directory in {'.', '..'}:
            raise HTTPException(400, '请将应用文件保存到独立目录后预览')
        fixed = {}
        if '/workspace-files/' in path:
            workspace = query.get('workspace', [''])[0]
            if workspace != '/workspace' and not workspace.startswith('/workspace/'):
                raise HTTPException(403, '应用不在当前账号工作区')
            safe_proxy_path(workspace, 'agent')
            fixed['workspace'] = workspace
        elif 'workspace' in query:
            raise HTTPException(400, '应用预览参数无效')
        return {'kind':'file', 'endpoint':path, 'directory':directory, 'entry':entry, 'query':fixed}
    if re.fullmatch(r'/api/projects/[A-Za-z0-9_-]+/agents/[A-Za-z0-9_-]+/workflows/[A-Za-z0-9_-]+/ui/.+\.html?', path) and not (set(query) - {'rev'}) and all(len(v)==1 for v in query.values()):
        directory, entry = posixpath.split(path)
        return {'kind':'workflow', 'directory':directory, 'entry':entry}
    raise HTTPException(403, '该路径不支持应用预览')


def preview_resource(target, asset):
    safe_proxy_path(asset, 'agent')
    if not asset or asset.startswith('/') or any(p in {'', '.', '..'} for p in asset.split('/')):
        raise HTTPException(400, '应用资源路径无效')
    # Only static browser assets, never config, credentials or arbitrary file downloads.
    if not asset.lower().endswith(('.html','.htm','.js','.mjs','.css','.json','.png','.jpg','.jpeg','.gif','.webp','.svg','.ico','.woff','.woff2','.ttf','.wasm','.map','.mp4','.webm','.mp3','.wav')):
        raise HTTPException(403, '该文件类型不支持应用预览')
    filename = target['directory'] + '/' + asset
    if target['kind'] == 'workflow':
        return filename
    return target['endpoint'] + '?' + urlencode({**target['query'], 'path':filename, 'preview':'1'})


def create_app(settings=None, client=None, sessions=None, websocket_connector=ws_connect):
    settings = settings or Settings.environment()

    @asynccontextmanager
    async def lifespan(app):
        app.state.client = client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, read=None), follow_redirects=False)
        app.state.upstreams = {}
        app.state.upstream_pending = {}
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

    async def authenticate(sid, module, family):
        session = app.state.sessions.get(sid, module, family)
        return await verify_session(session)

    async def verify_session(session):
        module = session['module']
        identity = await php("identity", {"session_handle": session["php_handle"], "module": module})
        if identity.get("admin_id") != session["tenant_id"] or identity.get("module") != module:
            raise HTTPException(401, "大模型中心会话身份不匹配")
        return session

    async def upstream(session):
        # Cache routing metadata, never a user's authentication/permission decision.
        # Every caller has already revalidated its PHP identity and module permission.
        cache_key = (session['tenant_id'], session['module'])
        cached = app.state.upstreams.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        pending = app.state.upstream_pending.get(cache_key)
        if pending is not None:
            return await asyncio.shield(pending)
        async def resolve():
            try:
                response = await app.state.client.post(settings.runtime_url + "/internal/instances/ensure", json={"tenant_id": session["tenant_id"], "module": session["module"]}, headers={"Authorization": "Bearer " + app.state.runtime_key}, timeout=180)
                response.raise_for_status()
                result = checked_upstream(response.json(), session['tenant_id'], settings, session['module'])
                now = time.monotonic()
                if len(app.state.upstreams) >= 1024:
                    app.state.upstreams = {k:v for k,v in app.state.upstreams.items() if v[0] > now}
                    if len(app.state.upstreams) >= 1024:
                        app.state.upstreams.pop(next(iter(app.state.upstreams)))
                app.state.upstreams[cache_key] = (now + settings.upstream_cache_seconds, result)
                return result
            except (httpx.HTTPError, ValueError):
                raise HTTPException(503, "大模型中心实例正在准备，请稍后重试")
            finally:
                app.state.upstream_pending.pop(cache_key, None)
        pending = asyncio.create_task(resolve())
        app.state.upstream_pending[cache_key] = pending
        return await asyncio.shield(pending)

    def invalidate_upstream(session):
        app.state.upstreams.pop((session['tenant_id'],session['module']),None)

    @app.exception_handler(HTTPException)
    async def error_handler(request, exc):
        response = JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
        module = request.path_params.get("module")
        public_preview = module in MODULES and request.url.path.startswith(module_prefix(module) + '/preview/')
        if exc.status_code == 401 and module in MODULES and not public_preview:
            app.state.sessions.revoke(request.cookies.get(module_cookie(module), ""), module)
            response.delete_cookie(module_cookie(module), path=module_prefix(module) + "/", httponly=True, samesite="strict", secure=settings.secure_cookie)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        # Preserve sandbox directives for generated HTML/SVG/previews.
        policy = response.headers.get("Content-Security-Policy", "")
        response.headers["Content-Security-Policy"] = (policy + "; " if policy else "") + "frame-ancestors 'self'"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "private, max-age=31536000, immutable" if getattr(request.state, 'immutable_asset', False) and response.status_code == 200 else "no-store"
        return response

    @app.get(PREFIX + "/health")
    async def health():
        return {"status": "healthy", "service": "llm-center-gateway"}

    @app.get(PREFIX + "/{module}/")
    async def bootstrap(module: str):
        module_prefix(module)
        from starlette.responses import HTMLResponse
        return HTMLResponse(Path(__file__).with_name("bootstrap.html").read_text(encoding="utf-8"))

    @app.post(PREFIX + "/{module}/auth/exchange")
    async def launch(request: Request, module: str):
        prefix = module_prefix(module)
        cookie = module_cookie(module)
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
        identity = await php("exchange", {"ticket": ticket, "module": module})
        app.state.sessions.revoke(request.cookies.get(cookie, ""), module)
        sid, family = app.state.sessions.create(identity, module, request.cookies.get(FAMILY_COOKIE, ""))
        session = app.state.sessions.get(sid, module, family)
        try:
            base, key, native_token = await upstream(session)
            health_headers = {"X-LLM-Instance-Key": key}
            if native_token: health_headers["Authorization"] = "Bearer " + native_token
            ready = await app.state.client.get(base + "/health", headers=health_headers, timeout=10)
            ready.raise_for_status()
        except (HTTPException, httpx.HTTPError):
            app.state.sessions.revoke(sid, module)
            raise HTTPException(503, "大模型中心实例正在准备，请稍后重试")
        response = JSONResponse({"admin_id": session["tenant_id"], "module": module, "ready": True})
        response.set_cookie(cookie, sid, max_age=28800, path=prefix + "/", httponly=True, samesite="strict", secure=settings.secure_cookie)
        response.set_cookie(FAMILY_COOKIE, family, max_age=28800, path=PREFIX + "/", httponly=True, samesite="strict", secure=settings.secure_cookie)
        return response

    @app.get(PREFIX + "/{module}/auth/me")
    async def me(request: Request, module: str):
        session = await authenticate(request.cookies.get(module_cookie(module), ""), module, request.cookies.get(FAMILY_COOKIE, ""))
        return {"admin_id": session["tenant_id"], "module": module, "username": session["username"]}

    @app.get(PREFIX + "/{module}/auth/ready")
    async def ready(request: Request, module: str):
        session = await authenticate(request.cookies.get(module_cookie(module), ""), module, request.cookies.get(FAMILY_COOKIE, ""))
        base, key, native_token = await upstream(session)
        try:
            health_headers = {"X-LLM-Instance-Key": key}
            if native_token: health_headers["Authorization"] = "Bearer " + native_token
            result = await app.state.client.get(base + "/health", headers=health_headers, timeout=10)
            result.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(503, "大模型中心实例正在准备，请稍后重试")
        return {"admin_id": session["tenant_id"], "module": module, "ready": True}

    @app.post(PREFIX + "/{module}/auth/logout")
    async def logout(request: Request, module: str):
        cookie = module_cookie(module)
        if not same_origin(request.headers):
            raise HTTPException(403, "请求来源无效")
        sid = request.cookies.get(cookie, "")
        session = app.state.sessions.get(sid, module, request.cookies.get(FAMILY_COOKIE, ""))
        try:
            await php("revoke", {"session_handle": session["php_handle"], "module": module})
        finally:
            app.state.sessions.revoke(sid, module)
        response = JSONResponse({"detail": "已退出大模型中心"})
        response.delete_cookie(cookie, path=module_prefix(module) + "/", httponly=True, samesite="strict", secure=settings.secure_cookie)
        return response

    @app.post(PREFIX + '/{module}/auth/preview')
    async def preview_launch(request: Request, module: str):
        if module != 'agent': raise HTTPException(404, '中心不存在')
        if not same_origin(request.headers): raise HTTPException(403, '请求来源无效')
        session = await authenticate(request.cookies.get(module_cookie(module), ''), module, request.cookies.get(FAMILY_COOKIE, ''))
        try: payload = await request.json()
        except ValueError: raise HTTPException(400, '应用预览请求格式无效')
        target = preview_target(payload.get('source') if isinstance(payload,dict) else None)
        base, key, native_token = await upstream(session)
        source = preview_resource(target, target['entry'])
        headers = {'X-LLM-Instance-Key':key, 'Authorization':'Bearer '+native_token, 'X-LLM-Preview-Root':quote(target['directory'],safe='/')}
        try: result = await app.state.client.get(base + source, headers=headers, timeout=15)
        except httpx.HTTPError: raise HTTPException(503, '应用预览暂时不可用')
        if result.status_code != 200: raise HTTPException(404 if result.status_code==404 else 403, '应用入口不可用或无权访问')
        if not result.headers.get('content-type','').startswith('text/html'):
            raise HTTPException(400, '应用预览需要 HTML 入口')
        cap = app.state.sessions.create_preview(session, target, payload.get('renew_url',''))
        return {'url':module_prefix(module)+'/preview/'+cap+'/'+quote(target['entry'],safe=''), 'expires_in':120}

    @app.api_route(PREFIX + '/{module}/preview/{cap}/{asset:path}', methods=['GET','HEAD'])
    async def preview_asset(request: Request, module: str, cap: str, asset: str):
        if module != 'agent': raise HTTPException(404, '中心不存在')
        session, target = app.state.sessions.preview(cap)
        await verify_session(session)
        source = preview_resource(target, asset)
        base, key, native_token = await upstream(session)
        private_headers = {'X-LLM-Instance-Key':key, 'Authorization':'Bearer '+native_token, 'X-LLM-Preview-Root':quote(target['directory'],safe='/')}
        try: result = await app.state.client.request(request.method, base + source, headers=private_headers, timeout=15)
        except httpx.HTTPError: raise HTTPException(503, '应用资源暂时不可用')
        if result.status_code != 200: raise HTTPException(404 if result.status_code==404 else 403, '应用资源不可用或无权访问')
        # No browser or native token/cookie is supplied to this opaque document.
        from starlette.responses import Response
        headers = {'Content-Type':result.headers.get('content-type','application/octet-stream'), 'Content-Security-Policy':"sandbox allow-scripts allow-forms allow-popups; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; form-action 'none'; base-uri 'none'", 'Access-Control-Allow-Origin':'null', 'Cross-Origin-Resource-Policy':'cross-origin'}
        return Response(result.content, headers=headers)

    @app.api_route(PREFIX + "/{module}/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def proxy(request: Request, module: str, path: str):
        prefix = module_prefix(module)
        sid = request.cookies.get(module_cookie(module), "")
        family = request.cookies.get(FAMILY_COOKIE, "")
        session = await authenticate(sid, module, family)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not same_origin(request.headers):
            raise HTTPException(403, "请求来源无效")
        safe_proxy_path(path, module)
        base, instance_key, native_token = await upstream(session)
        if path == "ui":
            path = ""
        elif path.startswith("ui/"):
            # The embedded Gradio page uses ./assets/... and its dynamic imports
            # are relative to /ui/. Map that entire subpath to the instance root.
            path = path[3:]
        if module == "agent":
            guard_agent_operation(path, request.method)
        url = base + "/" + path + ("?" + request.url.query if request.url.query else "")
        headers = {k: v for k, v in request.headers.items() if k.lower() not in BLOCK_REQUEST_HEADERS}
        headers["X-Forwarded-Prefix"] = prefix
        headers["X-Forwarded-Proto"] = request.url.scheme
        headers["X-Forwarded-Host"] = request.headers.get("host", "")
        if module == "agent":
            # Native workflow CSRF compares Origin to Host when fetch metadata is absent.
            headers["Host"] = request.headers.get("host", "")
        headers["X-LLM-Instance-Key"] = instance_key
        if native_token: headers["Authorization"] = "Bearer " + native_token
        async def request_body():
            async for chunk in request.stream():
                yield chunk
        try:
            outgoing = app.state.client.build_request(request.method, url, headers=headers, content=request_body())
            result = await app.state.client.send(outgoing, stream=True)
        except httpx.HTTPError:
            invalidate_upstream(session)
            raise HTTPException(503, "大模型中心服务暂时不可用")
        result_headers = {k: v for k, v in result.headers.items() if k.lower() not in HOP_HEADERS | {"set-cookie", "x-frame-options"}}
        # Only native, versioned JS/CSS/woff assets are reusable. HTML/config/API,
        # uploads, downloads and generated apps always retain no-store semantics.
        request.state.immutable_asset = bool(re.fullmatch(r'assets/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)', path)) and not request.url.query and result.headers.get('content-type','').split(';')[0] in {'text/javascript','application/javascript','text/css','font/woff2','font/woff','application/font-woff'}
        location = result_headers.get("location")
        if location:
            target = urlsplit(location)
            if target.netloc and not location.startswith(base + "/"):
                await result.aclose()
                raise HTTPException(502, "大模型中心重定向地址无效")
            if location.startswith(base):
                result_headers["location"] = prefix + location[len(base):]
            elif location.startswith("/") and not location.startswith(prefix + "/"):
                result_headers["location"] = prefix + location

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
                        await authenticate(sid, module, family)
                        checked = time.monotonic()
                    if done:
                        try:
                            chunk = pending.result()
                        except StopAsyncIteration:
                            return
                        pending = None
                        yield chunk
            except HTTPException:
                app.state.sessions.revoke(sid, module)
                return
            finally:
                if pending is not None and not pending.done():
                    pending.cancel()
                await result.aclose()
        return StreamingResponse(response_body(), status_code=result.status_code, headers=result_headers, background=BackgroundTask(result.aclose))

    @app.websocket(PREFIX + "/{module}/{path:path}")
    async def websocket_proxy(ws: WebSocket, module: str, path: str):
        try:
            if not same_origin(ws.headers):
                raise HTTPException(403, "请求来源无效")
            sid = ws.cookies.get(module_cookie(module), "")
            family = ws.cookies.get(FAMILY_COOKIE, "")
            session = await authenticate(sid, module, family)
            safe_proxy_path(path, module)
            base, instance_key, native_token = await upstream(session)
            if path.startswith("ui/"): path = path[3:]
            if module == "agent": guard_agent_operation(path, "WEBSOCKET")
        except HTTPException:
            await ws.close(code=4401)
            return
        query = ws.url.query
        target = base.replace("http://", "ws://", 1) + "/" + path + ("?" + query if query else "")
        await ws.accept()
        tasks = []
        try:
            private_headers = {"X-LLM-Instance-Key": instance_key}
            if native_token: private_headers["Authorization"] = "Bearer " + native_token
            async with websocket_connector(target, origin=ws.headers.get("origin"), additional_headers=private_headers, max_size=32 * 1024 * 1024) as remote:
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
                        await authenticate(sid, module, family)
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

