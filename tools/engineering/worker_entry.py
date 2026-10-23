"""Native API entry in the synthetic CPU-only validation profile."""
import os,sys,pathlib,ipaddress
assert os.environ.get('RUNHIVE_TEST_ISOLATED')=='1'
sys.path[:0]=['/work/site3',str(pathlib.Path(__file__).resolve().parents[2]/'services/runos-api/app')]
def audit(event,args):
 if event in ('subprocess.Popen','os.system','os.posix_spawn'):raise RuntimeError('CPU validation profile forbids process launch from application code')
 if event=='socket.connect':
  address=args[1]
  if not isinstance(address,tuple) or not ipaddress.ip_address(address[0]).is_loopback:raise RuntimeError('Validation profile forbids non-loopback connections')
sys.addaudithook(audit)
import uvicorn,main
uvicorn.run(main.app,host='127.0.0.1',port=int(os.environ['RUNHIVE_WORKER_PORT']),log_level='warning',access_log=False)
