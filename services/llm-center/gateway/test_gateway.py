"""Exercise the real gateway ASGI routes using isolated upstream fixtures."""
import json
import tempfile
import time
import unittest
from contextlib import asynccontextmanager
import asyncio
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from app import FAMILY_COOKIE, module_cookie, Settings, Sessions, checked_upstream, create_app, safe_proxy_path


class GatewayIsolationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        (root / "php-key").write_text("a" * 128)
        (root / "runtime-key").write_text("b" * 128)
        self.cookie = module_cookie('tune')
        self.settings = Settings(internal_key_file=str(root / "php-key"), runtime_key_file=str(root / "runtime-key"), state_db=str(root / "sessions.db"))
        self.sessions = Sessions(self.settings.state_db)
        self.tickets = {"1" * 64: 901, "2" * 64: 902, "5"*64:901, "6"*64:902}
        self.ticket_modules = {"1"*64:'tune',"2"*64:'tune',"5"*64:'agent',"6"*64:'agent'}
        self.handles = {}
        self.disabled = set()
        self.seen = []
        self.remote = httpx.AsyncClient(transport=httpx.MockTransport(self.handle))
        self.socket_seen = []
        self.app = create_app(self.settings, self.remote, self.sessions, websocket_connector=self.socket_fixture)
        self.browser = TestClient(self.app)
        self.browser.__enter__()

    def tearDown(self):
        self.browser.__exit__(None, None, None)
        self.temp.cleanup()

    def handle(self, request):
        self.seen.append(request)
        if request.url.path.startswith("/api/Llmcenter/"):
            self.assertEqual(request.headers["X-LLM-Internal-Key"], "a" * 128)
            payload = json.loads(request.content)
            action = request.url.path.rsplit("/", 1)[-1]
            if action == "exchange":
                if self.ticket_modules.get(payload.get('ticket')) != payload['module']:
                    return httpx.Response(401, json={"code":0})
                tenant = self.tickets.pop(payload.get("ticket"), None)
                if not tenant:
                    return httpx.Response(401, json={"code": 0})
                handle = (("3" if tenant == 901 else "4") if payload['module']=='tune' else ("7" if tenant==901 else "8")) * 64
                self.handles[handle] = (tenant,payload['module'])
                return httpx.Response(200, json={"code": 1, "data": {"admin_id": tenant, "module":payload['module'], "session_handle": handle, "username": f"fixture-{tenant}", "expires_at": int(time.time()) + 3600}})
            identity = self.handles.get(payload["session_handle"])
            tenant = identity[0] if identity and identity[1]==payload['module'] else None
            if not tenant or tenant in self.disabled:
                return httpx.Response(401, json={"code": 0})
            if action == "revoke":
                del self.handles[payload["session_handle"]]
            return httpx.Response(200, json={"code": 1, "data": {"admin_id": tenant, "module":payload['module']}})
        if request.url.path == "/internal/instances/ensure":
            self.assertEqual(request.headers["authorization"], "Bearer " + "b" * 128)
            payload=json.loads(request.content);tenant = payload["tenant_id"];module=payload['module']
            port=(40100 if module=='tune' else 41100)+tenant-900
            return httpx.Response(200, json={"tenant_id": tenant, "module":module, "base_url": f"http://127.0.0.1:{port}", "instance_key": "c" * 64, "native_token":'native-private-'+'d'*64 if module=='agent' else '', "state": "ready"})
        self.assertEqual(request.headers["X-LLM-Instance-Key"], "c" * 64)
        if request.url.port and request.url.port>=41100:
            self.assertEqual(request.headers['authorization'],'Bearer native-private-'+'d'*64)
        if request.url.path == "/health":
            return httpx.Response(200, json={"status": "healthy"})
        if request.url.path.startswith('/assets/'):
            return httpx.Response(200,stream=httpx.ByteStream(b'fixture immutable application code'),headers={'content-type':'text/javascript'})
        if request.url.path == '/generated.html':
            return httpx.Response(200,stream=httpx.ByteStream(b'<script>parent.localStorage</script>'),headers={'content-security-policy':'sandbox allow-scripts','content-type':'text/html','set-cookie':'native-secret=must-not-pass'})
        if request.url.path == '/api/projects/fixture/workspace-files/content':
            path=request.url.params['path']
            self.assertEqual(request.headers['x-llm-preview-root'],'apps/demo')
            if path=='apps/demo/index.html':
                return httpx.Response(200,content=b'<link href="style.css"><script src="app.js"></script>',headers={'content-type':'text/html'})
            return httpx.Response(200,content=b'fixture resource',headers={'content-type':'text/javascript' if path.endswith('.js') else 'text/css'})
        if request.url.path == "/stream-fixture":
            owner = self
            class Stream(httpx.AsyncByteStream):
                async def __aiter__(self):
                    yield b"data: first-account-message\n\n"
                    owner.disabled.add(901)
                    await asyncio.sleep(0.15)
                    yield b"data: forbidden-after-logout\n\n"
            return httpx.Response(200, stream=Stream(), headers={"content-type":"text/event-stream"})
        return httpx.Response(200, stream=httpx.ByteStream(f"worker-port={request.url.port}".encode()))

    @asynccontextmanager
    async def socket_fixture(self, target, **kwargs):
        self.socket_seen.append((target, kwargs))
        class Remote:
            async def send(self, message): pass
            async def __aiter__(self):
                yield "tenant-scoped-fixture"
        yield Remote()

    def login(self, ticket="1" * 64):
        result = self.browser.post("/llm-center/tune/auth/exchange", json={"ticket": ticket}, headers={"Origin": "http://testserver"})
        self.assertEqual(result.status_code, 200, result.text)
        return self.browser.cookies.get(self.cookie)

    def test_warm_asset_requests_prepare_instance_once_but_revalidate_every_identity(self):
        self.login();self.seen.clear()
        for _ in range(10):
            result=self.browser.get('/llm-center/tune/ui/assets/index-abcdefgh.js')
            self.assertEqual(result.status_code,200)
            self.assertEqual(result.headers['cache-control'],'private, max-age=31536000, immutable')
        self.assertEqual(sum(r.url.path=='/internal/instances/ensure' for r in self.seen),0)
        self.assertEqual(sum(r.url.path=='/api/Llmcenter/identity' for r in self.seen),10)

    def test_parallel_cold_asset_requests_coalesce_one_preparation(self):
        self.login();self.seen.clear();self.app.state.upstreams.clear()
        async def run():
            async def handle(request):
                if request.url.path=='/internal/instances/ensure':await asyncio.sleep(.04)
                return self.handle(request)
            remote=httpx.AsyncClient(transport=httpx.MockTransport(handle));original=self.app.state.client;self.app.state.client=remote
            try:
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app),base_url='http://testserver',cookies=self.browser.cookies) as client:
                    results=await asyncio.gather(*(client.get('/llm-center/tune/ui/assets/index-abcdefgh.js') for _ in range(12)))
                    self.assertTrue(all(r.status_code==200 for r in results))
            finally:self.app.state.client=original;await remote.aclose()
        self.browser.portal.call(run)
        self.assertEqual(sum(r.url.path=='/internal/instances/ensure' for r in self.seen),1)
        self.assertEqual(sum(r.url.path=='/api/Llmcenter/identity' for r in self.seen),12)

    def test_routing_cache_never_bypasses_parent_logout_or_permission_checks(self):
        self.login();self.disabled.add(901)
        result=self.browser.get('/llm-center/tune/ui/assets/index-abcdefgh.js')
        self.assertEqual(result.status_code,401);self.assertEqual(result.headers['cache-control'],'no-store')

    def test_api_html_generated_preview_and_uploads_never_become_immutable(self):
        self.login()
        for path in ['/ui/','/ui/config','/ui/api/data','/ui/assets/index-abcdefgh.js?personal=1']:
            self.assertEqual(self.browser.get('/llm-center/tune'+path).headers['cache-control'],'no-store')

    def test_routing_cache_is_separate_for_tenants_and_modules(self):
        self.login();self.assertEqual(self.browser.post('/llm-center/agent/auth/exchange',json={'ticket':'5'*64},headers={'Origin':'http://testserver'}).status_code,200)
        self.assertIn((901,'tune'),self.app.state.upstreams);self.assertIn((901,'agent'),self.app.state.upstreams)
        self.assertNotEqual(self.app.state.upstreams[(901,'tune')][1][0],self.app.state.upstreams[(901,'agent')][1][0])

    def test_expired_routing_cache_prepares_again(self):
        self.login();value=self.app.state.upstreams[(901,'tune')];self.app.state.upstreams[(901,'tune')]=(0,value[1]);self.seen.clear()
        self.browser.get('/llm-center/tune/ui/config')
        self.assertEqual(sum(r.url.path=='/internal/instances/ensure' for r in self.seen),1)

    def preview(self):
        self.assertEqual(self.browser.post('/llm-center/agent/auth/exchange',json={'ticket':'5'*64},headers={'Origin':'http://testserver'}).status_code,200)
        source='/llm-center/agent/api/projects/fixture/workspace-files/content?workspace=%2Fworkspace&path=apps%2Fdemo%2Findex.html'
        response=self.browser.post('/llm-center/agent/auth/preview',json={'source':source},headers={'Origin':'http://testserver'})
        self.assertEqual(response.status_code,200,response.text)
        return response.json()['url']

    def test_preview_cookieless_html_js_css_and_cors(self):
        url=self.preview();self.browser.cookies.clear()
        response=self.browser.get(url)
        self.assertEqual(response.status_code,200)
        self.assertIn('sandbox allow-scripts',response.headers['content-security-policy'])
        self.assertNotIn('allow-same-origin',response.headers['content-security-policy'])
        for asset in ['app.js','style.css']:
            response=self.browser.get(url.rsplit('/',1)[0]+'/'+asset,headers={'Origin':'null'})
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.headers['access-control-allow-origin'],'null')
            self.assertNotIn('set-cookie',response.headers)
            self.assertNotIn('native-private',response.text)

    def test_preview_rejects_traversal_and_arbitrary_files(self):
        url=self.preview();self.browser.cookies.clear();base=url.rsplit('/',1)[0]
        for asset in ['%252e%252e/private.json','private.toml','%2fetc/passwd','assets/%5csecret.js']:
            self.assertIn(self.browser.get(base+'/'+asset).status_code,{400,403,401})
        self.assertEqual(self.browser.post(url,content=b'overwrite').status_code,401)

    def test_preview_parent_logout_immediately_invalidates_assets(self):
        url=self.preview();self.browser.cookies.clear();self.disabled.add(901)
        self.assertEqual(self.browser.get(url).status_code,401)

    def test_preview_account_switch_invalidates_cap(self):
        url=self.preview()
        self.assertEqual(self.browser.post('/llm-center/tune/auth/exchange',json={'ticket':'2'*64},headers={'Origin':'http://testserver'}).status_code,200)
        self.assertEqual(self.browser.get(url).status_code,401)

    def test_preview_cap_expiry_denied(self):
        url=self.preview()
        with self.sessions.connection() as db: db.execute('UPDATE preview_caps SET expires_at=0')
        self.assertEqual(self.browser.get(url).status_code,401)
        self.assertEqual(self.browser.get('/llm-center/agent/auth/me').status_code,200)

    def test_preview_renewal_keeps_url_and_rejects_other_account(self):
        url=self.preview()
        source='/api/projects/fixture/workspace-files/content?workspace=/workspace&path=apps/demo/index.html'
        result=self.browser.post('/llm-center/agent/auth/preview',json={'source':source,'renew_url':url},headers={'Origin':'http://testserver'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['url'],url)
        self.assertEqual(self.browser.post('/llm-center/agent/auth/exchange',json={'ticket':'6'*64},headers={'Origin':'http://testserver'}).status_code,200)
        self.assertEqual(self.browser.post('/llm-center/agent/auth/preview',json={'source':source,'renew_url':url},headers={'Origin':'http://testserver'}).status_code,403)

    def test_v1_session_store_survives_v2_tables_on_same_sqlite(self):
        from test_v1_app import Sessions as V1Sessions
        legacy=V1Sessions(self.settings.state_db)
        sid=legacy.create({'admin_id':999001,'session_handle':'f'*64,'username':'v1 fixture','expires_at':int(time.time())+3600})
        self.assertEqual(legacy.get(sid)['tenant_id'],999001)
        self.preview()
        self.assertEqual(legacy.get(sid)['tenant_id'],999001)

    def test_public_bootstrap_has_no_identity_or_ticket(self):
        result = self.browser.get("/llm-center/tune/")
        self.assertEqual(result.status_code, 200)
        self.assertIn("location.hash", result.text)
        self.assertNotIn("fixture-", result.text)
        self.assertEqual(result.headers["referrer-policy"], "no-referrer")

    def test_anonymous_all_business_routes_denied(self):
        for route in ["ui/", "config", "queue/data", "gradio_api/queue/data", "file=/tenant/outputs/fixture.txt", "upload"]:
            with self.subTest(route=route):
                result = self.browser.get("/llm-center/tune/" + route)
                self.assertEqual(result.status_code, 401)
        result = self.browser.post("/llm-center/tune/upload", content=b"fixture", headers={"Origin": "http://testserver"})
        self.assertEqual(result.status_code, 401)

    def test_cookie_is_scoped_httponly_and_no_internal_credentials(self):
        result = self.browser.post("/llm-center/tune/auth/exchange", json={"ticket": "1" * 64}, headers={"Origin": "http://testserver"})
        cookie = result.headers["set-cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("Path=/llm-center/tune/", cookie)
        self.assertIn("SameSite=strict", cookie)
        self.assertNotIn("session_handle", result.text)
        self.assertNotIn("c" * 64, result.text)

    def test_ticket_replay_denied(self):
        self.login()
        result = self.browser.post("/llm-center/tune/auth/exchange", json={"ticket": "1" * 64}, headers={"Origin": "http://testserver"})
        self.assertEqual(result.status_code, 401)

    def test_browser_headers_and_query_cannot_select_another_tenant(self):
        self.login()
        result = self.browser.get("/llm-center/tune/config?tenant_id=902&admin_id=902", headers={"X-Tenant-ID": "902", "X-LLM-Instance-Key": "evil", "Authorization": "Bearer runos-fixture", "X-Admin-ID": "902"})
        self.assertEqual(result.text, "worker-port=40101")
        downstream = self.seen[-1]
        self.assertNotIn("x-tenant-id", downstream.headers)
        self.assertNotIn("authorization", downstream.headers)
        self.assertNotIn("cookie", downstream.headers)
        self.assertEqual(downstream.headers["X-LLM-Instance-Key"], "c" * 64)

    def test_switch_account_revokes_old_opaque_session(self):
        old = self.login()
        self.login("2" * 64)
        self.assertEqual(self.browser.get("/llm-center/tune/config").text, "worker-port=40102")
        with self.assertRaises(Exception):
            self.sessions.get(old, "tune",self.browser.cookies.get(FAMILY_COOKIE))

    def test_parent_logout_or_disabled_account_rejects_old_cookie(self):
        self.login()
        self.disabled.add(901)
        result = self.browser.get("/llm-center/tune/gradio_api/queue/data")
        self.assertEqual(result.status_code, 401)
        self.assertIn("Max-Age=0", result.headers["set-cookie"])

    def test_logout_revokes_session_server_side(self):
        sid = self.login()
        result = self.browser.post("/llm-center/tune/auth/logout", headers={"Origin": "http://testserver"})
        self.assertEqual(result.status_code, 200)
        with self.assertRaises(Exception):
            self.sessions.get(sid, "tune",self.browser.cookies.get(FAMILY_COOKIE))

    def test_upload_has_same_auth_and_csrf_guards(self):
        self.login()
        self.assertEqual(self.browser.post("/llm-center/tune/upload", content=b"file").status_code, 403)
        self.assertEqual(self.browser.post("/llm-center/tune/upload", content=b"file", headers={"Origin": "http://evil.example"}).status_code, 403)
        result = self.browser.post("/llm-center/tune/upload", content=b"file", headers={"Origin": "http://testserver"})
        self.assertEqual(result.status_code, 200)

    def test_iframe_relative_assets_map_to_factory_assets(self):
        self.login()
        result = self.browser.get("/llm-center/tune/ui/assets/index-fixture.js")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.seen[-1].url.path, "/assets/index-fixture.js")

    def test_download_rejects_outside_paths_and_encoded_traversal(self):
        self.login()
        for path in ["file=/etc/passwd", "file=/models/private", "file=/tenant/../other/file", "file=/tenant/%252e%252e/other/file", "file=/tenant/%5cother"]:
            with self.subTest(path=path):
                self.assertIn(self.browser.get("/llm-center/tune/" + path).status_code, {400, 403})
        self.assertEqual(self.browser.get("/llm-center/tune/file=/tenant/exports/fixture.txt").status_code, 200)

    def test_websocket_anonymous_and_cross_origin_denied(self):
        for headers in [{"Origin": "http://testserver"}, {"Origin": "http://evil.example"}]:
            with self.assertRaises(Exception):
                with self.browser.websocket_connect("/llm-center/tune/queue/join", headers=headers):
                    self.fail("anonymous socket was accepted")

    def test_authorized_websocket_has_bound_worker_and_private_instance_key(self):
        self.login()
        with self.browser.websocket_connect("/llm-center/tune/queue/join?tenant_id=902", headers={"Origin":"http://testserver", "X-Tenant-ID":"902"}) as websocket:
            self.assertEqual(websocket.receive_text(), "tenant-scoped-fixture")
        target, options = self.socket_seen[-1]
        self.assertTrue(target.startswith("ws://127.0.0.1:40101/"))
        self.assertEqual(options["additional_headers"], {"X-LLM-Instance-Key":"c"*64})

    def test_sse_disconnects_after_parent_logout(self):
        self.settings.identity_interval = 0.05
        self.login()
        result = self.browser.get("/llm-center/tune/stream-fixture")
        self.assertIn("first-account-message", result.text)
        self.assertNotIn("forbidden-after-logout", result.text)
        self.assertEqual(self.browser.get("/llm-center/tune/config").status_code, 401)

    def test_worker_returned_wrong_tenant_or_nonloopback_rejected(self):
        for payload in [{"tenant_id": 902, "base_url": "http://127.0.0.1:40101"}, {"tenant_id": 901, "base_url": "http://example.org:40101"}, {"tenant_id": 901, "base_url": "http://127.0.0.1:22"}]:
            with self.assertRaises(Exception):
                checked_upstream(payload, 901, self.settings, "tune")

    def agent_login(self,ticket='5'*64):
        result=self.browser.post('/llm-center/agent/auth/exchange',json={'ticket':ticket},headers={'Origin':'http://testserver'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['module'],'agent')
        return self.browser.cookies.get(module_cookie('agent'))

    def test_same_account_modules_have_independent_cookies_and_do_not_revoke_each_other(self):
        tune=self.login();agent=self.agent_login()
        self.assertNotEqual(tune,agent)
        self.assertEqual(self.browser.get('/llm-center/tune/auth/me').status_code,200)
        self.assertEqual(self.browser.get('/llm-center/agent/auth/me').status_code,200)
        self.browser.post('/llm-center/agent/auth/logout',headers={'Origin':'http://testserver'})
        self.assertEqual(self.browser.get('/llm-center/tune/auth/me').status_code,200)

    def test_cookie_from_other_module_rejected_without_revoking_that_module(self):
        tune=self.login();family=self.browser.cookies.get(FAMILY_COOKIE)
        result=self.browser.get('/llm-center/agent/api/me',headers={'Cookie':f'{module_cookie("agent")}={tune}; {FAMILY_COOKIE}={family}'})
        self.assertEqual(result.status_code,401)
        self.assertEqual(self.browser.get('/llm-center/tune/auth/me').status_code,200)

    def test_tune_ticket_not_exchangeable_as_agent(self):
        result=self.browser.post('/llm-center/agent/auth/exchange',json={'ticket':'1'*64},headers={'Origin':'http://testserver'})
        self.assertEqual(result.status_code,401)
        self.login()

    def test_switch_account_in_either_module_revokes_all_previous_account_browser_sessions(self):
        old=self.login();self.agent_login();self.agent_login('6'*64)
        self.assertEqual(self.browser.get('/llm-center/tune/auth/me').status_code,401)
        self.assertEqual(self.browser.get('/llm-center/agent/auth/me').json()['admin_id'],902)

    def test_agent_server_auth_is_private_and_browser_cannot_override_it(self):
        self.agent_login()
        result=self.browser.get('/llm-center/agent/api/me',headers={'Authorization':'Bearer evil','X-LLM-Instance-Key':'evil','X-Tenant-ID':'902'})
        self.assertEqual(result.text,'worker-port=41101')
        self.assertNotIn('native-private',result.text)
        self.assertEqual(self.seen[-1].headers['authorization'],'Bearer native-private-'+'d'*64)
        self.assertNotIn('x-tenant-id',self.seen[-1].headers)

    def test_agent_native_credential_hmr_and_terminal_routes_refused(self):
        self.agent_login()
        for path in ['api/auth/claim','api/admin/users','api/hmr/push','api/terminals/t/stream','api/projects/p/machines/pair']:
            self.assertEqual(self.browser.get('/llm-center/agent/'+path).status_code,403)

    def test_generated_html_sandbox_and_no_native_cookie_survive_proxy(self):
        self.agent_login()
        result=self.browser.get('/llm-center/agent/generated.html')
        self.assertEqual(result.status_code,200)
        self.assertIn('sandbox allow-scripts',result.headers['content-security-policy'])
        self.assertNotIn('allow-same-origin',result.headers['content-security-policy'])
        self.assertNotIn('set-cookie',result.headers)

    def test_tune_and_agent_port_ranges_cannot_be_mixed(self):
        payload={'tenant_id':901,'module':'agent','base_url':'http://127.0.0.1:40101','instance_key':'c'*64,'native_token':'d'*64,'state':'ready'}
        with self.assertRaises(Exception):checked_upstream(payload,901,self.settings,'agent')


if __name__ == "__main__":
    unittest.main(verbosity=2)

