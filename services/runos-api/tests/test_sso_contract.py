"""Real RunOS API against a synthetic SSO wire contract, not a PHP acceptance test."""
import http.server
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest


class IdentityContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='runos-b07-')
        cls.old = dict(os.environ); cls.mode = 'valid'; cls.received = []
        root = Path(cls.temp.name); key = root / 'synthetic-session-key'; key.write_text('synthetic-contract-key-' * 5)
        class SSO(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                body = self.rfile.read(int(self.headers.get('Content-Length','0')))
                cls.received.append({'path': self.path, 'form_contract': body.startswith(b'ticket='), 'synthetic': True})
                status = {'disabled':403, 'invalid':401, 'unavailable':503}.get(cls.mode,200)
                data = {'code': 1, 'data': {'admin_id': 101 if cls.mode != 'other-owner' else 202, 'username':'synthetic-A'}}
                if status != 200:data = {'code':0,'msg':'synthetic upstream private diagnostic','data':{}}
                raw = b'not-json synthetic diagnostic' if cls.mode=='malformed' else json.dumps(data).encode()
                self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
            def log_message(self,*args):pass
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1',0),SSO)
        cls.thread = threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        os.environ.update(RUNOS_DATA_ROOT=str(root/'admin-101'),RUNOS_SHARED_CONFIG_ROOT=str(root/'shared'),RUNOS_OWNER_ADMIN_ID='101',RUNOS_SKIP_RUNTIME_INSTALL='1',RUNOS_SESSION_SECRET_FILE=str(key),NEXUSHIVE_API_URL='http://127.0.0.1:'+str(cls.server.server_port))
        from fastapi.testclient import TestClient
        import main
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close();cls.server.shutdown();cls.server.server_close();cls.thread.join(timeout=5)
        os.environ.clear();os.environ.update(cls.old);cls.temp.cleanup()

    def exchange(self,mode):
        type(self).mode = mode
        return self.client.post('/api/auth/exchange',json={'ticket':'a'*64})

    def test_valid_exchange_uses_real_hmac_and_identity(self):
        r = self.exchange('valid');self.assertEqual(r.status_code,200)
        token = r.json()['access_token']
        me = self.client.get('/api/auth/me',headers={'Authorization':'Bearer '+token})
        self.assertEqual(me.status_code,200);self.assertEqual(me.json()['admin_id'],101)
        self.assertTrue(self.received[-1]['form_contract']);self.assertEqual(self.received[-1]['path'],'/api/Runos/exchange')

    def test_invalid_ticket_rejected(self):
        self.assertEqual(self.exchange('invalid').status_code,401)

    def test_disabled_account_status_preserved(self):
        r = self.exchange('disabled');self.assertEqual(r.status_code,403)
        self.assertNotIn('private diagnostic',r.text)

    def test_sso_unavailable_is_not_invalid_credentials(self):
        r = self.exchange('unavailable');self.assertEqual(r.status_code,503)
        self.assertNotIn('private diagnostic',r.text)

    def test_malformed_upstream_payload_is_generic_bad_gateway(self):
        r = self.exchange('malformed');self.assertEqual(r.status_code,502)
        self.assertNotIn('diagnostic',r.text)

    def test_cross_worker_exchange_rejected(self):
        self.assertEqual(self.exchange('other-owner').status_code,403)

    def test_invalid_ticket_format_rejected_before_upstream(self):
        before=len(self.received)
        r=self.client.post('/api/auth/exchange',json={'ticket':'invalid'})
        self.assertEqual(r.status_code,422);self.assertEqual(len(self.received),before)

    def test_connection_refused_is_service_unavailable(self):
        value=os.environ['NEXUSHIVE_API_URL'];os.environ['NEXUSHIVE_API_URL']='http://127.0.0.1:9'
        try:self.assertEqual(self.exchange('valid').status_code,503)
        finally:os.environ['NEXUSHIVE_API_URL']=value


if __name__=='__main__':unittest.main()
