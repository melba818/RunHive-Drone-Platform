"""Original PHP controller + public ThinkORM + real synthetic SQLite + real RunOS API.
Transport-only Api adapter; this is NOT full ThinkPHP/middleware acceptance.
"""
import os,sys
if os.environ.get("RUNOS_TEST_ISOLATED") != "1": raise SystemExit("Explicit isolated test environment required")
import pathlib,tarfile,hashlib,json,sqlite3,secrets,time,subprocess,urllib.request,urllib.error,base64
from concurrent.futures import ThreadPoolExecutor
ROOT=pathlib.Path('/work/candidate/app') if pathlib.Path('/work/candidate/app').exists() else pathlib.Path('/work/baseline/app')
sys.path[:0]=['/work/site3',str(ROOT)]
import resource
resource.setrlimit(resource.RLIMIT_CORE,(0,0))
checks=[];child=None;log=None;client=None
def row(ident,expected,actual,ok,**kw):checks.append(dict(id=ident,expected=expected,actual=actual,status='PASS' if ok else 'FAIL',**kw))
try:
 archive=pathlib.Path('/harness/php-runtime.tar.gz')
 if not pathlib.Path('/work/php/usr/bin/php8.3').exists():
  with tarfile.open(archive) as t:
   members=t.getmembers();assert len(members)<1000 and sum(m.size for m in members)<160*1024**2
   assert all(m.isfile() and not m.name.startswith('/') and '..' not in pathlib.PurePosixPath(m.name).parts for m in members)
   t.extractall('/work/php',filter='data')
 with tarfile.open('/harness/php-runtime-addons.tar.gz') as t:
  members=t.getmembers();assert len(members)<30 and sum(m.size for m in members)<8*1024**2
  assert all(m.isfile() and not m.name.startswith('/') and '..' not in pathlib.PurePosixPath(m.name).parts for m in members)
  t.extractall('/work/php',filter='data')
 php=pathlib.Path('/work/php');lib=php/'usr/lib/x86_64-linux-gnu';loader=lib/'ld-linux-x86-64.so.2'
 if not loader.exists():loader=php/'lib/x86_64-linux-gnu/ld-linux-x86-64.so.2'
 library=str(lib)+':'+str(php/'lib/x86_64-linux-gnu')
 module=next((php/'usr/lib/php').glob('*/pdo.so'));sqlite=module.parent/'pdo_sqlite.so'
 command=[str(loader),'--library-path',library,str(php/'usr/bin/php8.3'),'-n','-d','extension='+str(module),'-d','extension='+str(sqlite),'-d','extension='+str(module.parent/'ctype.so'),'-d','extension='+str(module.parent/'mbstring.so'),'-d','display_errors=0','-d','log_errors=1','-d','error_log=/results/php-runtime-errors.log']
 probe=subprocess.run(command+['-r','echo json_encode(["version"=>PHP_VERSION,"drivers"=>PDO::getAvailableDrivers(),"uid"=>function_exists("posix_getuid")?posix_getuid():null]);'],capture_output=True,text=True,timeout=10)
 assert probe.returncode==0,(probe.returncode,probe.stderr);runtime=json.loads(probe.stdout);assert 'sqlite' in runtime['drivers']
 import tempfile
 base=pathlib.Path(tempfile.mkdtemp(prefix='php-component-data-',dir='/work'));db=base/'synthetic.sqlite3'
 c=sqlite3.connect(db);c.executescript("PRAGMA journal_mode=WAL; CREATE TABLE admin(id INTEGER PRIMARY KEY,username TEXT,nickname TEXT,status TEXT); CREATE TABLE runos_sso_ticket(ticket_hash TEXT PRIMARY KEY,admin_id INTEGER,expires_at INTEGER,consumed_at INTEGER); INSERT INTO admin VALUES(101,'synthetic-A','A','enable'),(202,'synthetic-B','B','enable'),(303,'synthetic-disabled','D','disable');");c.commit()
 def ticket(owner=101,expired=False):
  text=secrets.token_hex(32);digest=hashlib.sha256(text.encode()).hexdigest();c.execute('INSERT INTO runos_sso_ticket VALUES(?,?,?,NULL)',(digest,owner,int(time.time())+(-10 if expired else 60)));c.commit();return text,digest
 e={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/work','LANG':'C.UTF-8','RUNOS_COMPONENT_DB':str(db),'PHP_CLI_SERVER_WORKERS':'2','RUNOS_TEST_ISOLATED':'1'}
 log=open('/results/php-component-server.log','wb');child=subprocess.Popen(command+['-S','127.0.0.1:18080','/harness/php_router.php'],env=e,stdout=log,stderr=log,start_new_session=True)
 def direct(text,json_body=False):
  import urllib.parse
  raw=json.dumps({'ticket':text}).encode() if json_body else urllib.parse.urlencode({'ticket':text}).encode()
  req=urllib.request.Request('http://127.0.0.1:18080/api/Runos/exchange',data=raw,headers={'content-type':'application/json' if json_body else 'application/x-www-form-urlencoded'})
  try:
   with urllib.request.urlopen(req,timeout=5) as r:return r.status,r.read()
  except urllib.error.HTTPError as ex:return ex.code,ex.read()
 for _ in range(80):
  assert child.poll() is None,'PHP component server exited'
  try:
   code,body=direct('invalid')
   if code==401:break
  except (OSError,urllib.error.URLError):pass
  time.sleep(.1)
 else:raise RuntimeError('PHP component startup failed; inspect synthetic server error log')
 os.environ.update(RUNOS_DATA_ROOT=str(base/'admin-101'),RUNOS_SHARED_CONFIG_ROOT=str(base/'shared'),RUNOS_OWNER_ADMIN_ID='101',RUNOS_SKIP_RUNTIME_INSTALL='1',NEXUSHIVE_API_URL='http://127.0.0.1:18080')
 from fastapi.testclient import TestClient
 import main
 client=TestClient(main.app)
 def exchange(ident,text,expected):
  r=client.post('/api/auth/exchange',json={'ticket':text});row(ident,expected,r.status_code,r.status_code==expected,interface='RunOS -> original PHP Runos::exchange -> ThinkORM -> SQLite',response_sha256=hashlib.sha256(r.content).hexdigest());return r
 text,digest=ticket();r=exchange('php-valid-one-use-first',text,200);assert r.status_code==200,r.text
 token=r.json()['access_token'];claims=json.loads(base64.urlsafe_b64decode(token.split('.')[0]+'=='))
 row('hmac-protocol-and-lifetime',28800,claims['exp']-claims['iat'],claims['exp']-claims['iat']==28800 and claims['sub']==101 and len(token.split('.'))==2)
 r=client.get('/api/auth/me',headers={'authorization':'Bearer '+token});row('actual-php-hmac-identity',101,r.json().get('admin_id'),r.status_code==200 and r.json()['admin_id']==101)
 exchange('php-ticket-replay',text,401);row('php-consumption-persisted',True,c.execute('SELECT consumed_at FROM runos_sso_ticket WHERE ticket_hash=?',(digest,)).fetchone()[0] is not None,c.execute('SELECT consumed_at FROM runos_sso_ticket WHERE ticket_hash=?',(digest,)).fetchone()[0] is not None)
 text,digest=ticket(expired=True);exchange('php-ticket-expired',text,401);row('expired-not-consumed',None,c.execute('SELECT consumed_at FROM runos_sso_ticket WHERE ticket_hash=?',(digest,)).fetchone()[0],c.execute('SELECT consumed_at FROM runos_sso_ticket WHERE ticket_hash=?',(digest,)).fetchone()[0] is None)
 code,body=direct('not-hex');row('php-direct-ticket-format',401,code,code==401)
 exchange('runos-invalid-format-before-php','not-hex',422)
 exchange('php-ticket-hash-not-present',secrets.token_hex(32),401)
 text,digest=ticket(303);exchange('php-disabled-account',text,403)
 text,digest=ticket(202);exchange('php-cross-worker-identity',text,403)
 text,digest=ticket();code,body=direct(text,True);data=json.loads(body);row('php-json-request-and-envelope',{'code':1,'admin_id':101},data,code==200 and data['code']==1 and data['data']['admin_id']==101)
 text,digest=ticket()
 with ThreadPoolExecutor(max_workers=2) as pool:responses=list(pool.map(lambda _:direct(text)[0],range(2)))
 row('php-concurrent-single-consumer',[200,401],sorted(responses),sorted(responses)==[200,401])
 c.execute("UPDATE admin SET status='disable' WHERE id=101");c.commit()
 r=client.get('/api/auth/me',headers={'authorization':'Bearer '+token});row('existing-session-after-php-disable-observation',200,r.status_code,r.status_code==200,security_boundary='GAP: existing HMAC session is not revoked; policy unchanged')
 # Deliberately break only the synthetic database; adapter diagnostics stay off the wire.
 c.execute('DROP TABLE runos_sso_ticket');c.commit();r=exchange('php-synthetic-database-failure',secrets.token_hex(32),503)
 row('php-db-diagnostic-not-forwarded',False,any(s in r.text.lower() for s in ['sqlite','sqlstate','select ','trace','synthetic.sqlite']),not any(s in r.text.lower() for s in ['sqlite','sqlstate','select ','trace','synthetic.sqlite']),scope='RunOS error mapping plus harness transport handler, not production ThinkPHP error middleware')
 import signal
 os.killpg(child.pid,signal.SIGTERM);child.wait(timeout=5);child=None
 exchange('actual-php-service-unavailable',secrets.token_hex(32),503)
 result={'status':'PASS' if all(x['status']=='PASS' for x in checks) else 'FAIL','stage':'php','checks':checks,'runtime':runtime,'original_controller_sha256':hashlib.sha256(pathlib.Path('/harness/Runos.php').read_bytes()).hexdigest(),'public_archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'scope':'Original approved PHP controller, actual public ThinkORM and real synthetic SQLite; test-only transport Api adapter. Full ThinkPHP bootstrap/middleware/MariaDB integration NOT RUN.'}
except Exception as ex:
 import traceback
 result={'status':'FAIL','stage':'php','checks':checks,'error':{'type':type(ex).__name__,'reason':str(ex),'trace':traceback.format_exc()[-3000:]}}
finally:
 if client:client.close()
 if child and child.poll() is None:
  import signal
  os.killpg(child.pid,signal.SIGTERM);child.wait(timeout=5)
 if log:log.close()
for name in ['php-component-errors.log','php-runtime-errors.log','php-component-server.log']:
 p=pathlib.Path('/results')/name
 if p.exists():result[name]=p.read_text(errors='replace')[-4000:]
print('API_STAGE_RESULT='+json.dumps(result),flush=True);sys.exit(0 if result['status']=='PASS' else 1)
