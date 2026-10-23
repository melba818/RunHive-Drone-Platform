#!/usr/bin/env python3
"""Local offline CI entry point, inside the documented restricted container."""
import argparse,json,os,pathlib,subprocess,sys,time
def main():
 p=argparse.ArgumentParser();p.add_argument('suite',choices=['runtime','web-inputs','static','core','system','web-build','browser']);a=p.parse_args()
 if os.environ.get('RUNHIVE_TEST_ISOLATED')!='1':raise SystemExit('Explicit isolated container required')
 root=pathlib.Path(__file__).resolve().parents[2];scripts=root/'tools/engineering'
 commands={'runtime':[sys.executable,'-B','-I',str(scripts/'prepare_runtime.py')], 'web-inputs':[sys.executable,'-B','-I',str(scripts/'prepare_web.py')], 'static':[sys.executable,'-B','-I',str(scripts/'ci.py'),'--source',str(root),'--manifest','/work/source-manifest.json','--selftest'], 'core':[sys.executable,'-B','-I',str(scripts/'regression.py')], 'system':[sys.executable,'-B','-I',str(scripts/'system_test.py')], 'web-build':['/usr/local/bin/node',str(scripts/'build-web.cjs')], 'browser':['/usr/local/bin/node',str(scripts/'browser-system.mjs')]}
 start=time.monotonic();r=subprocess.run(commands[a.suite],capture_output=True,text=True,timeout=1200,env={**os.environ,'RUNOS_TEST_ISOLATED':'1'})
 result={'suite':a.suite,'status':'PASS' if r.returncode==0 else 'FAIL','exit':r.returncode,'command':commands[a.suite],'seconds':round(time.monotonic()-start,3),'stdout':r.stdout,'stderr':r.stderr}
 if a.suite=='static' and r.returncode==0:
  negative=subprocess.run([sys.executable,'-B','-I',str(scripts/'test_ci_cli.py')],capture_output=True,text=True,timeout=150)
  result['negative_cli']={'exit':negative.returncode,'stdout':negative.stdout,'stderr':negative.stderr}
  if negative.returncode:result.update(status='FAIL',exit=negative.returncode)
 pathlib.Path('/results/pipeline-'+a.suite+'-'+str(time.time_ns())+'.json').write_text(json.dumps(result))
 print('API_STAGE_RESULT='+json.dumps(result));return result['exit']
if __name__=='__main__':sys.exit(main())
