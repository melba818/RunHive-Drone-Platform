#!/usr/bin/env python3
"""Run CPU-only groups in separate interpreters to avoid singleton state leakage."""
import json,os,pathlib,subprocess,sys
if os.environ.get('RUNHIVE_TEST_ISOLATED')!='1':raise SystemExit('Isolated runtime required')
root=pathlib.Path(__file__).resolve().parents[2];groups=['imports','security','extended','b05','b06','b07','b08','b09'];results=[]
for group in groups:
 p=subprocess.run([sys.executable,'-B','-I',str(root/'tools/engineering/api_regression.py'),group],capture_output=True,text=True,timeout=180,env={**os.environ,'RUNOS_TEST_ISOLATED':'1','RUNOS_TEST_SITE':'/work/site3'})
 record=next((json.loads(x.split('=',1)[1]) for x in reversed(p.stdout.splitlines()) if x.startswith('API_STAGE_RESULT=')),None)
 results.append({'group':group,'exit':p.returncode,'result':record,'stderr':p.stderr[-12000:]})
 # Preserve the original group output even if a later group fails.
 pathlib.Path('/results/core-'+group+'.json').write_text(json.dumps(results[-1]))
status='PASS' if all(x['exit']==0 and x['result'] and x['result']['status']=='PASS' for x in results) else 'FAIL'
print('API_STAGE_RESULT='+json.dumps({'status':status,'groups':results}),flush=True)
sys.exit(0 if status=='PASS' else 1)
