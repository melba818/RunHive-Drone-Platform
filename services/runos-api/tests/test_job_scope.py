"""Native worker HTTP tests over persisted synthetic job objects; no training starts."""
import sys,os,json,pathlib,tempfile,subprocess,time,hashlib
if os.environ.get('RUNOS_TEST_ISOLATED')!='1':
    raise SystemExit('Requires an explicitly isolated, network-disabled test container')
ROOT=pathlib.Path(__file__).resolve().parents[1]/'app'
sys.path[:0]=[os.environ['RUNOS_TEST_SITE'],str(ROOT)]
def block_execution():
    def audit(event,args):
        if event in ('subprocess.Popen','os.system','os.posix_spawn'):
            raise RuntimeError('Synthetic worker test forbids subprocess execution')
        if event=='socket.connect' and (not isinstance(args[1],tuple) or args[1][0] not in ['127.0.0.1','::1']):
            raise RuntimeError('Synthetic worker test forbids external connections')
    sys.addaudithook(audit)
if len(sys.argv)>1 and sys.argv[1]=='serve':
    block_execution()
    import main,uvicorn
    uvicorn.run(main.app,host='127.0.0.1',port=int(sys.argv[2]),log_level='warning',access_log=False)
    raise SystemExit
import httpx
from core.nexushive import issue_session
checks=[];processes=[];logs=[];result={'status':'FAIL','checks':checks,'fixture':'persisted synthetic historical jobs, not training creation API'}
try:
    with tempfile.TemporaryDirectory(prefix='runos-job-scope-') as tmp:
        base=pathlib.Path(tmp);key=base/'synthetic-key';key.write_text('synthetic-job-key-'*8);os.environ['RUNOS_SESSION_SECRET_FILE']=str(key)
        tokens={n:issue_session({'admin_id':n}) for n in [101,202]};clients={}
        for owner,port in [(101,18101),(202,18202)]:
            root=base/('admin-'+str(owner));root.mkdir();source=root/'local-source';source.mkdir();(source/'readme.txt').write_text('owned fixture')
            artifact=root/'training-artifact.txt';artifact.write_text('synthetic-artifact-'+str(owner))
            job={'id':'job-'+str(owner),'name':'synthetic-job-'+str(owner),'status':'completed','logs':['synthetic-log-'+str(owner)],'model_path':str(artifact),'config':{},'progress':100}
            (root/'training_jobs.json').write_text(json.dumps({job['id']:job}))
            env={'PATH':'/work/python/bin:/usr/local/bin:/usr/bin:/bin','HOME':'/work','LANG':'C.UTF-8','LD_LIBRARY_PATH':'/harness/oslibs','RUNOS_TEST_ISOLATED':'1','RUNOS_TEST_SITE':os.environ['RUNOS_TEST_SITE'],'RUNOS_DATA_ROOT':str(root),'RUNOS_SHARED_CONFIG_ROOT':str(base/'shared'),'RUNOS_OWNER_ADMIN_ID':str(owner),'RUNOS_SESSION_SECRET_FILE':str(key),'RUNOS_SKIP_RUNTIME_INSTALL':'1','NEXUSHIVE_API_URL':'http://127.0.0.1:9','CUDA_VISIBLE_DEVICES':'-1','OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1'}
            log=open('/results/b06-worker-'+str(owner)+'.log','wb');logs.append(log)
            p=subprocess.Popen([sys.executable,'-B','-I',__file__,'serve',str(port)],env=env,stdout=log,stderr=log);processes.append(p)
            client=httpx.Client(base_url='http://127.0.0.1:'+str(port),trust_env=False,timeout=5);clients[owner]=client
            for _ in range(100):
                if p.poll() is not None:raise RuntimeError('Synthetic native worker exited')
                try:
                    if client.get('/api/health').status_code==200:break
                except Exception:pass
                time.sleep(.2)
            else:raise RuntimeError('Synthetic native worker startup timeout')
        def call(ident,owner,method,path,expected,*,predicate=None,**kw):
            r=clients[owner].request(method,path,headers={'authorization':'Bearer '+tokens[owner]},**kw)
            ok=r.status_code==expected and (predicate(r) if predicate else True)
            checks.append({'id':ident,'owner':owner,'method':method,'path':path,'expected_status':expected,'actual_status':r.status_code,'status':'PASS' if ok else 'FAIL','body_sha256':hashlib.sha256(r.content).hexdigest()})
        for owner in [101,202]:
            other=303-owner;own='job-'+str(owner);foreign='job-'+str(other)
            call('own-job-status-'+str(owner),owner,'GET','/api/train/'+own+'/status?full_logs=true',200,predicate=lambda r,n=owner:r.json()['id']=='job-'+str(n) and 'synthetic-log-'+str(n) in r.json()['logs'])
            call('cross-job-status-'+str(owner),owner,'GET','/api/train/'+foreign+'/status',404)
            call('own-job-artifact-'+str(owner),owner,'GET','/api/train/'+own+'/export',200,predicate=lambda r,n=owner:r.text=='synthetic-artifact-'+str(n))
            call('cross-job-artifact-'+str(owner),owner,'GET','/api/train/'+foreign+'/export',404)
            call('spoof-job-owner-'+str(owner),owner,'GET','/api/train/'+foreign+'/status?owner_id='+str(other)+'&tenant_id='+str(other),404)
            call('cross-job-stop-'+str(owner),owner,'POST','/api/train/'+foreign+'/stop',200,predicate=lambda r:r.json()['success'] is False)
            call('cross-job-delete-'+str(owner),owner,'DELETE','/api/train/'+foreign,400)
            call('own-local-import-'+str(owner),owner,'POST','/api/datasets/load-local',200,json={'folder_path':str(base/('admin-'+str(owner))/'local-source'),'dataset_name':'owned-import'})
            call('cross-local-import-'+str(owner),owner,'POST','/api/datasets/load-local',403,json={'folder_path':str(base/('admin-'+str(other))/'local-source'),'dataset_name':'cross-import'})
        # Confirm foreign operations did not alter either real persisted object.
        for owner in [101,202]:
            saved=json.loads((base/('admin-'+str(owner))/'training_jobs.json').read_text());item=saved['job-'+str(owner)]
            checks.append({'id':'foreign-job-side-effects-'+str(owner),'status':'PASS' if item['status']=='completed' else 'FAIL','unauthorized_side_effect':item['status']!='completed'})
            call('own-job-stop-'+str(owner),owner,'POST','/api/train/job-'+str(owner)+'/stop',200,predicate=lambda r:r.json()['success'] is True)
            call('own-job-delete-'+str(owner),owner,'DELETE','/api/train/job-'+str(owner),200,predicate=lambda r:r.json()['success'] is True)
        for c in clients.values():c.close()
        result['status']='PASS' if all(c['status']=='PASS' for c in checks) else 'FAIL'
except Exception as exc:
    result['error']={'type':type(exc).__name__,'reason':str(exc)}
finally:
    for p in processes:
        if p.poll() is None:p.terminate()
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:p.kill();p.wait(timeout=5)
    for f in logs:f.close()
    result['worker_exit_codes']=[p.returncode for p in processes]
print('B06_RESULT='+json.dumps(result),flush=True)
sys.exit(0 if result['status']=='PASS' else 1)
