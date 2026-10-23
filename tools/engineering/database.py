"""Synthetic MariaDB backup/restore adapter; cannot target production schemas."""
import hashlib,json,os,pathlib,subprocess
def permitted(schema):
 if os.environ.get('RUNHIVE_TEST_ISOLATED')!='1' or schema not in ('runhive_test','runhive_restore'):
  raise ValueError('Only the explicitly isolated synthetic schemas are allowed')
def backup(runtime,schema,target):
 permitted(schema);target=pathlib.Path(target)
 assert target.parent==pathlib.Path('/results') and not target.exists()
 args=runtime['dump']+['--no-defaults','--protocol=socket','--socket=/work/db/run.sock','--user=root','--skip-comments','--skip-dump-date','--single-transaction',schema]
 p=subprocess.run(args,capture_output=True,timeout=30);assert p.returncode==0,p.stderr.decode()[-1200:]
 assert 0<len(p.stdout)<2*1024**2
 with target.open('xb') as f:f.write(p.stdout)
 return {'bytes':len(p.stdout),'sha256':hashlib.sha256(p.stdout).hexdigest(),'schema':schema,'sql':p.stdout.decode()}
def restore(runtime,schema,sql):
 permitted(schema);assert schema=='runhive_restore'
 statement='DROP DATABASE IF EXISTS runhive_restore; CREATE DATABASE runhive_restore; USE runhive_restore;\n'+sql
 p=subprocess.run(runtime['client']+['--no-defaults','--protocol=socket','--socket=/work/db/run.sock','--user=root'],input=statement,text=True,capture_output=True,timeout=30)
 assert p.returncode==0,p.stderr[-1200:]
