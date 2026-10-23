#!/usr/bin/env python3
"""Real MariaDB + ThinkPHP HTTP + approved RunOS API. Synthetic data only."""
import os,sys,pathlib,json,subprocess,time,secrets,hashlib,urllib.request,urllib.error,urllib.parse,traceback,signal
from concurrent.futures import ThreadPoolExecutor
assert os.environ.get('RUNHIVE_TEST_ISOLATED')=='1'
os.environ['RUNOS_SKIP_RUNTIME_INSTALL']='1'
sys.path[:0]=['/work/site3','/work/repo/services/runos-api/app']
runtime=json.loads(pathlib.Path('/work/runtime.json').read_text());checks=[];children=[];logs=[]
def record(name,expected,actual):
 checks.append({'id':name,'expected':expected,'actual':actual,'status':'PASS' if expected==actual else 'FAIL'})
 assert expected==actual,name
def command(args,data=None):
 p=subprocess.run(args,input=data,capture_output=True,text=True,timeout=40)
 if p.returncode:raise RuntimeError('isolated command failed: '+str(p.returncode)+' '+p.stderr[-1500:])
 return p.stdout
def start(args,env,name):
 log=open('/results/'+name+'-'+str(time.time_ns())+'.log','wb');logs.append(log)
 p=subprocess.Popen(args,env=env,stdout=log,stderr=log,start_new_session=True);children.append(p);return p
def sql(statement):return command(runtime['client']+['--no-defaults','--protocol=socket','--socket=/work/db/run.sock','--user=root','--batch','--skip-column-names'],statement)
def ticket(owner=101,expired=False):
 value=secrets.token_hex(32);digest=hashlib.sha256(value.encode()).hexdigest()
 sql("INSERT INTO runhive_test.runos_sso_ticket VALUES ('%s',%d,%d,NULL);"%(digest,owner,int(time.time())+(-10 if expired else 60)))
 return value
def request(url,body=None,token=None):
 headers={'content-type':'application/json','accept':'application/json'}
 if token:headers['authorization']='Bearer '+token
 req=urllib.request.Request(url,json.dumps(body).encode() if body is not None else None,headers)
 try:
  with urllib.request.urlopen(req,timeout=12) as r:return r.status,r.read()
 except urllib.error.HTTPError as ex:return ex.code,ex.read()
try:
 db=pathlib.Path('/work/db');db.mkdir(mode=0o700,exist_ok=True)
 base=runtime['mariadb']+['--no-defaults','--basedir=/work/maria/usr','--datadir=/work/db','--lc-messages-dir=/work/maria/usr/share/mysql','--innodb-buffer-pool-size=32M','--innodb-log-file-size=8M','--performance-schema=OFF','--skip-log-bin']
 bootstrap='CREATE DATABASE mysql;\nUSE mysql;\n'+pathlib.Path('/work/maria/usr/share/mysql/mysql_system_tables.sql').read_text()+'\n'+pathlib.Path('/work/maria/usr/share/mysql/mysql_system_tables_data.sql').read_text()
 if not (db/'mysql').exists():command(base+['--bootstrap','--skip-grant-tables'],bootstrap)
 server=start(base+['--skip-networking','--skip-grant-tables','--socket=/work/db/run.sock','--pid-file=/work/db/run.pid','--tmpdir=/tmp'],dict(os.environ),'mariadb')
 for _ in range(80):
  assert server.poll() is None,'MariaDB exited'
  try:
   if sql('SELECT 1;').strip()=='1':break
  except Exception:pass
  time.sleep(.15)
 else:raise RuntimeError('MariaDB startup timeout')
 version=sql('SELECT VERSION();').strip();record('real-mariadb-version',True,'MariaDB' in version)
 sql("DROP DATABASE IF EXISTS runhive_test; CREATE DATABASE runhive_test; USE runhive_test; CREATE TABLE admin(id INT PRIMARY KEY,username VARCHAR(64),nickname VARCHAR(64),status VARCHAR(16)); CREATE TABLE config(id INT PRIMARY KEY AUTO_INCREMENT,name VARCHAR(64),value TEXT,type VARCHAR(32),content TEXT,extend TEXT); CREATE TABLE runos_sso_ticket(ticket_hash CHAR(64) PRIMARY KEY,admin_id INT,expires_at BIGINT,consumed_at BIGINT NULL); INSERT INTO admin VALUES(101,'synthetic-A','A','enable'),(202,'synthetic-B','B','enable'),(303,'disabled','D','disable');")
 phpapp=pathlib.Path('/work/phpapp');(phpapp/'app').mkdir(parents=True,exist_ok=True);(phpapp/'runtime').mkdir(exist_ok=True);(phpapp/'route').mkdir(exist_ok=True)
 php=start(runtime['php']+['-d','display_errors=0','-d','log_errors=1','-d','error_log=/results/php-http-errors.log','-S','127.0.0.1:18080','/work/repo/tools/engineering/php-http.php'],{**os.environ,'PHP_CLI_SERVER_WORKERS':'2'},'php-http')
 for _ in range(60):
  assert php.poll() is None,'PHP exited'
  try:
   code,body=request('http://127.0.0.1:18080/api/Runos/exchange',{'ticket':'invalid'})
   if code==401:break
  except OSError:pass
  time.sleep(.2)
 else:raise RuntimeError('ThinkPHP exchange startup failed status='+str(code)+' body_sha256='+hashlib.sha256(body).hexdigest())
 record('thinkphp-original-controller-http',401,code)
 key=pathlib.Path('/work/synthetic-session-secret')
 if not key.exists():key.write_text(secrets.token_hex(48));key.chmod(0o444)
 assert len(key.read_text().strip())>=64
 env={**os.environ,'RUNOS_SESSION_SECRET_FILE':str(key),'RUNOS_DATA_ROOT':'/control-a','RUNOS_SHARED_CONFIG_ROOT':'/control-a/shared','RUNOS_OWNER_ADMIN_ID':'101','RUNOS_ALLOW_CROSS_TENANT_EXCHANGE':'1','NEXUSHIVE_API_URL':'http://127.0.0.1:18080','RUNOS_SKIP_RUNTIME_INSTALL':'1','PYTHONPATH':'/work/site3:/work/repo/services/runos-api/app','LD_LIBRARY_PATH':'/harness/oslibs'}
 api=start(['/work/python/bin/python3.12','-B','-m','uvicorn','main:app','--host','127.0.0.1','--port','8010'],env,'api-control')
 for _ in range(100):
  assert api.poll() is None,'API exited'
  try:
   if request('http://127.0.0.1:8010/api/health')[0]==200:break
  except OSError:pass
  time.sleep(.2)
 else:raise RuntimeError('API startup timeout')
 value=ticket();code,body=request('http://127.0.0.1:8010/api/auth/exchange',{'ticket':value});record('api-real-php-mariadb-exchange',200,code);token=json.loads(body)['access_token']
 record('ticket-replay',401,request('http://127.0.0.1:8010/api/auth/exchange',{'ticket':value})[0])
 record('expired-ticket',401,request('http://127.0.0.1:8010/api/auth/exchange',{'ticket':ticket(expired=True)})[0])
 record('disabled-account',403,request('http://127.0.0.1:8010/api/auth/exchange',{'ticket':ticket(303)})[0])
 value=ticket()
 with ThreadPoolExecutor(2) as pool:statuses=list(pool.map(lambda _:request('http://127.0.0.1:18080/api/Runos/exchange',{'ticket':value})[0],range(2)))
 record('mariadb-concurrent-once',[200,401],sorted(statuses))
 record('real-session-identity',101,json.loads(request('http://127.0.0.1:8010/api/auth/me',token=token)[1])['admin_id'])
 sql("UPDATE runhive_test.admin SET status='disable' WHERE id=101;")
 record('disabled-existing-session-observed-unrevoked',200,request('http://127.0.0.1:8010/api/auth/me',token=token)[0])
 sql("UPDATE runhive_test.admin SET status='enable' WHERE id=101;")
 # Real logical backup, restore into an independent synthetic schema, upgrade and rollback.
 sys.path.insert(0,str(pathlib.Path(__file__).parent))
 from database import backup,restore
 saved=backup(runtime,'runhive_test','/results/synthetic-backup-'+str(time.time_ns())+'.sql');dump=saved['sql']
 restore(runtime,'runhive_restore',dump)
 record('backup-restore-row-parity',sql('SELECT COUNT(*) FROM runhive_test.runos_sso_ticket;').strip(),sql('SELECT COUNT(*) FROM runhive_restore.runos_sso_ticket;').strip())
 sql('ALTER TABLE runhive_restore.admin ADD COLUMN test_revision INT NOT NULL DEFAULT 2;');record('synthetic-schema-upgrade','2',sql('SELECT test_revision FROM runhive_restore.admin WHERE id=101;').strip())
 restore(runtime,'runhive_restore',dump)
 record('synthetic-schema-rollback','0',sql("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='runhive_restore' AND table_name='admin' AND column_name='test_revision';").strip())
 # Preserve only synthetic runtime coordinates for the following browser stage.
 pathlib.Path('/work/system-ready.json').write_text(json.dumps({'runtime':runtime,'version':version,'api_pid':api.pid,'php_pid':php.pid,'db_pid':server.pid,'backup_sha256':hashlib.sha256(dump.encode()).hexdigest()}))
 result={'status':'PASS','checks':checks,'mariadb_version':version,'scope':'Real ThinkPHP HTTP/Response pipeline + original Runos/Api/BaseController, public ORM + MariaDB + real API. Narrow synthetic bootstrap; production plugin/middleware set is not fully restored.','session_policy':'Existing issued HMAC session remains valid after disable; unchanged pending business decision.'}
except Exception:
 result={'status':'FAIL','checks':checks,'error':traceback.format_exc()[-2500:]}
 for p in reversed(children):
  if p.poll() is None:os.killpg(p.pid,signal.SIGTERM);p.wait(timeout=8)
for log in logs:log.close()
for name in ['mariadb.log','php-http.log','php-http-errors.log','api-control.log']:
 candidates=list(pathlib.Path('/results').glob(name.replace('.log','*log')))
 if candidates:
  p=max(candidates,key=lambda p:p.stat().st_mtime_ns);result[name]=p.read_text(errors='replace')[-4000:]
print('API_STAGE_RESULT='+json.dumps(result),flush=True)
sys.exit(0 if result['status']=='PASS' else 1)
