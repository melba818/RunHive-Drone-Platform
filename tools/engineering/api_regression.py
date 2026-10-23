"""Offline harness. Real source is never replaced; synthetic data stays in tmpfs."""
import sys,os,pathlib,json,ast,hashlib,time,traceback,subprocess,urllib.request,urllib.error,secrets,base64,hmac,signal
ROOT=pathlib.Path(__file__).resolve().parents[2]/'services/runos-api/app'
sys.path[:0]=['/work/site3',str(ROOT)]
RESULT=pathlib.Path('/results')
def emit(v):
 print('API_STAGE_RESULT='+json.dumps(v,ensure_ascii=False),flush=True)
def env(owner):
 e={'LD_LIBRARY_PATH':'/harness/oslibs','PATH':'/work/python/bin:/usr/local/bin:/usr/bin:/bin','HOME':'/work','LANG':'C.UTF-8','PYTHONDONTWRITEBYTECODE':'1','PYTHONNOUSERSITE':'1','RUNOS_SKIP_RUNTIME_INSTALL':'1','RUNOS_OWNER_ADMIN_ID':str(owner),'RUNOS_DATA_ROOT':'/work/synthetic/admin-'+str(owner),'RUNOS_SHARED_CONFIG_ROOT':'/work/synthetic/shared','RUNOS_SESSION_SECRET_FILE':'/work/synthetic/session-secret','NEXUSHIVE_INTERNAL_SECRET_FILE':'/work/synthetic/internal-secret','NEXUSHIVE_API_URL':'http://127.0.0.1:9','NVIDIA_VISIBLE_DEVICES':'void','CUDA_VISIBLE_DEVICES':'-1','OMP_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','MKL_NUM_THREADS':'1','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','ULTRALYTICS_OFFLINE':'true'}
 return e
def guard():
 def audit(event,args):
  if event in ('subprocess.Popen','os.system','os.posix_spawn'):raise RuntimeError('Test guard: subprocess disabled during application execution')
  if event=='socket.connect':
   address=args[1]
   if not isinstance(address,tuple) or address[0] not in ('127.0.0.1','::1'):raise RuntimeError('Test guard: non-loopback connection denied')
 sys.addaudithook(audit)
def token(owner,**kw):
 claims={'iss':'nexushive','aud':'runos','sub':owner,'username':'synthetic-'+str(owner),'iat':int(time.time()),'exp':int(time.time())+600};claims.update(kw)
 p=base64.urlsafe_b64encode(json.dumps(claims,separators=(',',':')).encode()).rstrip(b'=')
 sig=hmac.new(pathlib.Path('/work/synthetic/session-secret').read_bytes(),p,hashlib.sha256).digest()
 return p.decode()+'.'+base64.urlsafe_b64encode(sig).rstrip(b'=').decode()
if sys.argv[1]=='serve':
 os.environ.clear();os.environ.update(env(int(sys.argv[2])));guard()
 import main,uvicorn
 uvicorn.run(main.app,host='127.0.0.1',port=int(sys.argv[3]),log_level='warning',access_log=False)
else:
 stage=sys.argv[1];assert stage in ('imports','security','extended','b05','b06','b07','b08','b09');out={'stage':stage,'status':'FAIL','checks':[]};children=[]
 try:
  os.environ.update(env(101));
  for n in ['session-secret','internal-secret']:
   p=pathlib.Path('/work/synthetic')/n
   if not p.exists():p.write_text(secrets.token_hex(48),encoding='ascii');p.chmod(0o600)
  if stage=='candidate':
   import tarfile
   version2=False
   archive_path='/harness/candidate-final-v6.tar'
   with tarfile.open(archive_path) as archive:
    members=archive.getmembers()
    assert len(members)<200 and sum(m.size for m in members)<4*1024**2
    assert all(m.isfile() and not m.name.startswith('/') and '..' not in pathlib.PurePosixPath(m.name).parts for m in members)
    archive.extractall('/work/candidate-v2' if version2 else '/work/candidate',filter='data')
   out.update(status='PASS',candidate_files=len(members),candidate_sha256=hashlib.sha256(pathlib.Path(archive_path).read_bytes()).hexdigest())
  elif stage in ('b08','b09','php'):
   target=str(ROOT.parent/('tests/test_isolation_edges.py' if stage!='php' else 'tests/test_php_component.py'))
   r=subprocess.run([sys.executable,'-B','-I',target,stage],env={**env(101),'RUNOS_TEST_ISOLATED':'1'},capture_output=True,text=True,timeout=180)
   record=next((json.loads(x.split('=',1)[1]) for x in reversed(r.stdout.splitlines()) if x.startswith('API_STAGE_RESULT=')),None)
   out.update(record or {'status':'FAIL','stderr':r.stderr,'stdout':r.stdout[-3000:]});out['child_exit']=r.returncode;out['child_stderr']=r.stderr
  elif stage=='imports':
   for p in sorted(ROOT.rglob('*.py')):ast.parse(p.read_text(encoding='utf-8-sig'))
   out['syntax_files']=len(list(ROOT.rglob('*.py')))
   guard();import importlib
   for name in ['core.nexushive','routers.nexushive_auth','resource_store','main']:
    try:
     m=importlib.import_module(name);out['checks'].append({'id':'import-'+name,'status':'PASS'})
    except Exception as e:out['checks'].append({'id':'import-'+name,'status':'FAIL','type':type(e).__name__,'error':str(e),'trace':traceback.format_exc()[-5000:]})
   if 'main' in sys.modules:
    app=sys.modules['main'].app
    routes=[{'path':r.path,'methods':sorted(r.methods or [])} for r in app.routes if hasattr(r,'methods')]
    out['routes']=routes;out['openapi_paths']=len(app.openapi()['paths'])
   out['status']='PASS' if all(x['status']=='PASS' for x in out['checks']) else 'FAIL'
  elif stage=='security':
   import httpx
   def start(owner,port):
    log=open('/results/worker-'+str(owner)+'.log','wb');p=subprocess.Popen([sys.executable,'-B','-I',__file__,'serve',str(owner),str(port)],stdout=log,stderr=log,env=env(owner));children.append((p,log))
    for _ in range(120):
     if p.poll() is not None:raise RuntimeError('Native worker startup failed for synthetic owner '+str(owner))
     try:
      if httpx.get('http://127.0.0.1:'+str(port)+'/api/health',trust_env=False,timeout=.5).status_code==200:return
     except Exception:pass
     time.sleep(.25)
    raise RuntimeError('Native worker startup timeout')
   start(101,18010);start(202,18011)
   clients={101:httpx.Client(base_url='http://127.0.0.1:18010',trust_env=False,timeout=5),202:httpx.Client(base_url='http://127.0.0.1:18011',trust_env=False,timeout=5)}
   def check(ident,owner,method,path,expected,cred=None,**kw):
    headers=kw.pop('headers',{})
    if cred is not None:headers['authorization']='Bearer '+cred
    r=clients[owner].request(method,path,headers=headers,**kw);ok=r.status_code in expected
    row={'id':ident,'worker':owner,'method':method,'path':path,'expected_status':expected,'actual_status':r.status_code,'status':'PASS' if ok else 'FAIL','response_sha256':hashlib.sha256(r.content).hexdigest()}
    out['checks'].append(row);return r,row
   a=token(101);b=token(202)
   for owner,own,other in [(101,a,b),(202,b,a)]:
    prefix='worker-'+str(owner)
    check(prefix+'-health',owner,'GET','/api/health',[200])
    check(prefix+'-anonymous',owner,'GET','/api/datasets',[401])
    check(prefix+'-invalid',owner,'GET','/api/datasets',[401],cred='invalid')
    check(prefix+'-expired',owner,'GET','/api/datasets',[401],cred=token(owner,exp=int(time.time())-1))
    payload,signature=own.split('.',1)
    # Change the first signature sextet, not unused trailing Base64 pad bits.
    corrupt=('A' if signature[0]!='A' else 'B')+signature[1:]
    assert base64.urlsafe_b64decode(corrupt+'=')!=base64.urlsafe_b64decode(signature+'=')
    check(prefix+'-bad-signature',owner,'GET','/api/datasets',[401],cred=payload+'.'+corrupt)
    check(prefix+'-own-identity',owner,'GET','/api/auth/me',[200],cred=own)
    check(prefix+'-other-worker',owner,'GET','/api/datasets',[403],cred=other)
    check(prefix+'-spoof-identity-header',owner,'GET','/api/datasets',[401],headers={'X-User-ID':str(owner),'X-Tenant-ID':str(owner)})
    check(prefix+'-spoof-tenant-query',owner,'GET','/api/datasets?tenant_id='+str(303-owner),[200],cred=own)
    # Upload only synthetic text; no model execution or production data.
    r,row=check(prefix+'-upload-own',owner,'POST','/api/datasets/load?dataset_name=tenant-'+str(owner),[200],cred=own,files={'files':('readme.txt',b'synthetic fixture only','text/plain')})
    if r.status_code==200:row['dataset_id']=r.json()['dataset']['id']
   # Synthetic B fixture is outside A's dataset root, but inside disposable tmpfs.
   secret=pathlib.Path('/work/synthetic/admin-202/sentinel.txt');secret.write_text('synthetic-tenant-B-private',encoding='utf-8')
   for own,cred in [(101,a),(202,b)]:
    other=303-own
    check('worker-'+str(own)+'-cross-object',own,'GET','/api/datasets/tenant-'+str(other),[404],cred=cred)
    check('worker-'+str(own)+'-own-object',own,'GET','/api/datasets/tenant-'+str(own),[200],cred=cred)
   check('path-traversal-download',101,'GET','/api/datasets/tenant-101/image-file/%2e%2e/%2e%2e/%2e%2e/admin-202/sentinel.txt',[400,403,404],cred=a)
   escape_name='upload-escape-'+secrets.token_hex(6)+'.txt'
   escape=pathlib.Path('/work/synthetic/admin-101')/escape_name
   check('path-traversal-upload',101,'POST','/api/datasets/load?dataset_name=escape-fixture',[400,422],cred=a,files={'files':('../../'+escape_name,b'synthetic upload escape','text/plain')})
   out['checks'].append({'id':'upload-remains-contained','status':'PASS' if not escape.exists() else 'FAIL','escaped_file_exists':escape.exists()})
   # Real resource-library owner filtering, including file download.
   from PIL import Image
   import io
   image=io.BytesIO();Image.new('RGB',(1,1),(0,0,0)).save(image,format='PNG');asset_ids={}
   for owner,cred in [(101,a),(202,b)]:
    r,row=check('resource-upload-'+str(owner),owner,'POST','/api/assistant/resources/upload',[200],cred=cred,files={'file':('synthetic.png',image.getvalue(),'image/png')})
    if r.status_code==200:asset_ids[owner]=r.json()['id']
   for owner,cred in [(101,a),(202,b)]:
    if len(asset_ids)==2:
     check('resource-own-file-'+str(owner),owner,'GET','/api/assistant/resources/'+asset_ids[owner]+'/file?download=true',[200],cred=cred)
     check('resource-cross-file-'+str(owner),owner,'GET','/api/assistant/resources/'+asset_ids[303-owner]+'/file?download=true',[404],cred=cred)
    check('jobs-list-'+str(owner),owner,'GET','/api/train/jobs',[200],cred=cred)
    check('jobs-unknown-object-'+str(owner),owner,'GET','/api/train/synthetic-not-present/status',[404],cred=cred)
   check('synthetic-admin-no-implicit-cross-worker',202,'GET','/api/datasets',[403],cred=token(1))
   check('wrong-audience',101,'GET','/api/datasets',[401],cred=token(101,aud='wrong-audience'))
   check('wrong-issuer',101,'GET','/api/datasets',[401],cred=token(101,iss='wrong-issuer'))
   # Existing local-folder import accepts an arbitrary filesystem path. Confirm
   # this separate policy gap without reading anything outside synthetic tmpfs.
   other_folder=pathlib.Path('/work/synthetic/admin-202/external-dataset');other_folder.mkdir(exist_ok=True)
   (other_folder/'fixture.txt').write_text('synthetic B folder',encoding='utf-8')
   r,row=check('local-folder-cross-worker-policy',101,'POST','/api/datasets/load-local',[400,403,404],cred=a,json={'folder_path':str(other_folder),'dataset_name':'external-B-fixture'})
   out['policy_gap_checks']=[out['checks'].pop()]
   for owner,c in clients.items():c.close()
   out['native_workers_started']=2;out['status']='PASS' if all(x['status']=='PASS' for x in out['checks']) else 'FAIL'
  elif stage=='web':
   import httpx
   for owner,port in [(1,8010),(101,20101),(202,20202)]:
    log=open('/results/web-worker-'+str(owner)+'.log','wb');p=subprocess.Popen([sys.executable,'-B','-I',__file__,'serve',str(owner),str(port)],stdout=log,stderr=log,env=env(owner));children.append((p,log))
    for _ in range(120):
     if p.poll() is not None:raise RuntimeError('Native Web integration worker failed')
     try:
      if httpx.get('http://127.0.0.1:'+str(port)+'/api/health',trust_env=False,timeout=.5).status_code==200:break
     except Exception:pass
     time.sleep(.25)
    else:raise RuntimeError('Native Web integration startup timeout')
   pathlib.Path('/work/synthetic/web-tokens.json').write_text(json.dumps({'a':token(101),'b':token(202),'expired':token(101,exp=int(time.time())-1)}))
   e={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/work','BACKEND_URL':'http://127.0.0.1:8010','NODE_NO_WARNINGS':'1'}
   command=['/usr/local/bin/node','--require=/harness/web-guard.cjs','--experimental-strip-types','/harness/web-integration.mjs']
   r=subprocess.run(command,env=e,capture_output=True,text=True,timeout=60)
   result=next((json.loads(x.split('=',1)[1]) for x in r.stdout.splitlines() if x.startswith('REAL_WEB_API_RESULT=')),None)
   out.update(status='PASS' if r.returncode==0 and result and result['status']=='PASS' else 'FAIL',node_exit=r.returncode,web_result=result,node_stderr=r.stderr,scope='Real unchanged Web tenant-selector module plus real native API; not Next.js page/proxy or external SSO integration')
  elif stage=='b06':
   p=ROOT.parent/'tests/test_job_scope.py';assert p.is_file()
   e={**env(101),'RUNOS_TEST_SITE':'/work/site3','RUNOS_TEST_ISOLATED':'1'}
   r=subprocess.run([sys.executable,'-B','-I',str(p)],env=e,capture_output=True,text=True,timeout=90)
   record=next((json.loads(x.split('=',1)[1]) for x in r.stdout.splitlines() if x.startswith('B06_RESULT=')),None)
   out.update(status='PASS' if r.returncode==0 and record and record['status']=='PASS' else 'FAIL',checks=record.get('checks',[]) if record else [],b06=record,subprocess_exit=r.returncode,stderr=r.stderr,scope='Persisted synthetic completed jobs restored by real workers; no training creation, GPU, model loading or remote SSH')
  elif stage in ['b05','b07']:
   import unittest,importlib.util,io
   name='test_private_files.py' if stage=='b05' else 'test_sso_contract.py'
   p=ROOT.parent/'tests'/name
   if not p.exists():p=pathlib.Path('/harness')/name
   spec=importlib.util.spec_from_file_location('regression_'+stage,p);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
   suite=unittest.defaultTestLoader.loadTestsFromModule(mod);stream=io.StringIO()
   class Recorder(unittest.TextTestResult):
    def addSuccess(self,test):super().addSuccess(test);out['checks'].append({'id':test.id(),'status':'PASS'})
    def addFailure(self,test,error):super().addFailure(test,error);out['checks'].append({'id':test.id(),'status':'FAIL'})
    def addError(self,test,error):super().addError(test,error);out['checks'].append({'id':test.id(),'status':'FAIL'})
   result=unittest.TextTestRunner(stream=stream,verbosity=2,resultclass=Recorder).run(suite)
   out.update(status='PASS' if result.wasSuccessful() else 'FAIL',tests_run=result.testsRun,failures=len(result.failures),errors_count=len(result.errors),unittest_output=stream.getvalue(),source=str(p))
  elif stage=='audit':
   import importlib.metadata
   from pip._vendor.packaging.requirements import Requirement
   from pip._vendor.packaging.utils import canonicalize_name
   distributions=list(importlib.metadata.distributions(path=['/work/site3']))
   installed={canonicalize_name(d.metadata['Name']):d.version for d in distributions};missing=[]
   for d in distributions:
    for value in d.requires or []:
     req=Requirement(value)
     if req.marker and not req.marker.evaluate({'extra':''}):continue
     version=installed.get(canonicalize_name(req.name))
     if version is None or (req.specifier and version not in req.specifier):missing.append({'package':d.metadata['Name'],'requirement':str(req),'installed':version})
   files=[]
   for p in sorted(ROOT.parent.rglob('*')):
    if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc':files.append({'relative':p.relative_to(ROOT.parent).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
   import main
   schema=main.app.openapi();operations=sum(sum(k in ['get','post','put','delete','patch','head','options','trace'] for k in value) for value in schema['paths'].values())
   out['php_controller_sha256']=hashlib.sha256(pathlib.Path('/harness/Runos.php').read_bytes()).hexdigest()
   out['php_component_transport_sha256']=hashlib.sha256(pathlib.Path('/harness/php_router.php').read_bytes()).hexdigest()
   out.update(status='PASS' if not missing else 'FAIL',installed=installed,missing_or_conflicting=missing,files=files,openapi_paths=len(schema['paths']),openapi_operations=operations,source_kind='approved Git candidate only',production_data=False)
  elif stage=='extended':
   # Independent module and unittest checks use the real implementation.
   import unittest,importlib.util,io
   p=ROOT.parent/'tests/test_security_boundaries.py';assert p.is_file()
   spec=importlib.util.spec_from_file_location('security_boundaries',p);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
   suite=unittest.defaultTestLoader.loadTestsFromModule(mod);stream=io.StringIO();result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
   out.update(status='PASS' if result.wasSuccessful() else 'FAIL',tests_run=result.testsRun,failures=len(result.failures),errors_count=len(result.errors),unittest_output=stream.getvalue())
  else:raise RuntimeError('Unknown stage')
 except Exception as ex:out.update(status='FAIL',error={'type':type(ex).__name__,'reason':str(ex),'trace':traceback.format_exc()[-6000:]})
 finally:
  for p,f in children:
   if p.poll() is None:p.terminate()
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:p.kill();p.wait(timeout=5)
   f.close()
  out['child_exit_codes']=[p.returncode for p,f in children]
  RESULT.joinpath(stage+'.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');emit(out)
 sys.exit(0 if out['status']=='PASS' else 1)
