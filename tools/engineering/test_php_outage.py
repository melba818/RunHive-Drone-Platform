"""Real synthetic DB outage and recovery, exercising the original PHP base class."""
import os,pathlib,json,subprocess,signal,time,urllib.request,urllib.error,hashlib,traceback
assert os.environ.get('RUNHIVE_TEST_ISOLATED')=='1'
ready_path=pathlib.Path('/work/system-ready.json');ready=json.loads(ready_path.read_text());runtime=ready['runtime'];checks=[];database=None
def direct():
 req=urllib.request.Request('http://127.0.0.1:18080/api/Runos/exchange',data=b'ticket=invalid',headers={'content-type':'application/x-www-form-urlencoded','accept':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=8) as r:return r.status,r.read()
 except urllib.error.HTTPError as ex:return ex.code,ex.read()
def sql(text):
 p=subprocess.run(runtime['client']+['--no-defaults','--protocol=socket','--socket=/work/db/run.sock','--user=root','--batch','--skip-column-names'],input=text,capture_output=True,text=True,timeout=3)
 return p.returncode,p.stdout
try:
 code,_=direct();assert code==401,'Original PHP endpoint is not ready'
 pid=ready['db_pid'];cmd=pathlib.Path('/proc/'+str(pid)+'/cmdline').read_bytes();assert b'/work/maria/usr/sbin/mariadbd' in cmd and os.getpgid(pid)==pid
 os.killpg(pid,signal.SIGTERM)
 for _ in range(40):
  if sql('SELECT 1;')[0]!=0:break
  time.sleep(.1)
 else:raise RuntimeError('Synthetic DB did not stop')
 code,body=direct();diagnostic=any(s in body.lower() for s in [b'sqlstate',b'/work/',b'stack trace',b'pdoexception'])
 checks.append({'id':'php-db-unavailable-status','expected':503,'actual':code,'status':'PASS' if code==503 else 'FAIL','body_sha256':hashlib.sha256(body).hexdigest()})
 checks.append({'id':'php-db-diagnostics-not-exposed','expected':False,'actual':diagnostic,'status':'PASS' if not diagnostic else 'FAIL'})
except Exception:checks.append({'id':'outage-prerequisite','status':'FAIL','error':traceback.format_exc()[-1800:]})
finally:
 # Restart only the same synthetic datadir, with the same restricted settings.
 if sql('SELECT 1;')[0]!=0:
  args=runtime['mariadb']+['--no-defaults','--basedir=/work/maria/usr','--datadir=/work/db','--lc-messages-dir=/work/maria/usr/share/mysql','--innodb-buffer-pool-size=32M','--innodb-log-file-size=8M','--performance-schema=OFF','--skip-log-bin','--skip-networking','--skip-grant-tables','--socket=/work/db/run.sock','--pid-file=/work/db/run.pid','--tmpdir=/tmp']
  log=open('/results/db-recovery-'+str(time.time_ns())+'.log','wb');database=subprocess.Popen(args,stdout=log,stderr=log,start_new_session=True);log.close()
  for _ in range(60):
   if sql('SELECT 1;')[0]==0:break
   assert database.poll() is None,'Synthetic DB restart failed';time.sleep(.1)
  ready['db_pid']=database.pid;ready_path.write_text(json.dumps(ready))
 try:
  code,_=direct();checks.append({'id':'php-db-recovery-original-ticket-validation','expected':401,'actual':code,'status':'PASS' if code==401 else 'FAIL'})
 except Exception:checks.append({'id':'php-db-recovery-original-ticket-validation','status':'FAIL','error':traceback.format_exc()[-1000:]})
result={'status':'PASS' if all(x['status']=='PASS' for x in checks) else 'FAIL','checks':checks,'scope':'Synthetic MariaDB process and original PHP HTTP endpoint only; no production service access'}
print('API_STAGE_RESULT='+json.dumps(result),flush=True)
raise SystemExit(0 if result['status']=='PASS' else 1)
