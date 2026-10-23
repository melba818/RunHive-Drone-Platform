"""Synthetic real-router regressions. No model execution, GPU, remote nodes or ACL mocks."""
import os,sys
if os.environ.get("RUNOS_TEST_ISOLATED") != "1": raise SystemExit("Explicit isolated test environment required")
import json,time,pathlib,hashlib,asyncio,io,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]/'app'
sys.path[:0]=['/work/site3',str(ROOT)]
group=sys.argv[1]
temporary=tempfile.TemporaryDirectory(prefix='edge-'+group+'-',dir='/work')
os.environ.update(RUNOS_DATA_ROOT=temporary.name+'/admin-101',RUNOS_SHARED_CONFIG_ROOT=temporary.name+'/shared')
from fastapi.testclient import TestClient
from fastapi import HTTPException
from config import settings
from core.nexushive import issue_session
import main

checks=[]
def record(ident,expected,actual,ok,**kw):
 checks.append(dict(id=ident,expected=expected,actual=actual,status='PASS' if ok else 'FAIL',**kw))
def http(ident,method,url,expected=(403,),**kw):
 r=client.request(method,url,headers=auth,**kw);record(ident,list(expected),r.status_code,r.status_code in expected,method=method,path=url,response_sha256=hashlib.sha256(r.content).hexdigest());return r
root=settings.WORKSPACE_DIR;other=root.parent/'admin-202';other.mkdir(exist_ok=True,parents=True)
foreign=other/'edge-foreign.txt';foreign.write_text('synthetic-foreign-bytes');foreign_digest=hashlib.sha256(foreign.read_bytes()).hexdigest()
owned=root/'edge-owned.txt';owned.write_text('synthetic-owned-bytes')
auth={'authorization':'Bearer '+issue_session({'admin_id':101})};client=TestClient(main.app)
try:
 if group=='b08':
  def job(path):
   settings._text_annotate_jobs['edge-job']={'dataset_id':'edge-dataset','recent_images':[{'abs_path':str(path)}],'all_images':[{'abs_path':str(path),'image_id':'edge-image','path':'edge-owned.txt'}]}
  dataset=settings.DATASETS_DIR/'edge-dataset';dataset.mkdir(exist_ok=True)
  settings.active_datasets['edge-dataset']={'id':'edge-dataset','name':'edge-dataset','format':'yolo'}
  job(foreign)
  for suffix in ['preview/0','image/edge-image','annotated/edge-image']:
   http('annotation-cross-'+suffix.split('/')[0],'GET','/api/auto-annotate/text-batch/edge-job/'+suffix)
  job(owned);r=http('annotation-own-preview','GET','/api/auto-annotate/text-batch/edge-job/preview/0',(200,));record('annotation-own-bytes','owned bytes',hashlib.sha256(r.content).hexdigest(),r.content==owned.read_bytes())
  link=root/'edge-symlink.txt';link.symlink_to(foreign);job(link)
  http('annotation-external-symlink','GET','/api/auto-annotate/text-batch/edge-job/preview/0')
  hard=root/'edge-hardlink.txt';os.link(foreign,hard);job(hard)
  http('annotation-hardlink','GET','/api/auto-annotate/text-batch/edge-job/preview/0')
  folder=root/'edge-import-hardlink';folder.mkdir(exist_ok=True);os.link(foreign,folder/'external.txt')
  before=set(settings.active_datasets)
  http('import-hardlink-before-registration','POST','/api/datasets/load-local',json={'folder_path':str(folder),'dataset_name':'edge-hard-import'})
  record('import-denial-no-registration','no new dataset',len(settings.active_datasets),set(settings.active_datasets)==before)
  # A safe internal directory alias must not conceal a nested external link.
  target=root/'edge-internal-target';target.mkdir(exist_ok=True);(target/'outside').symlink_to(other,target_is_directory=True)
  scan=root/'edge-import-nested';scan.mkdir(exist_ok=True);(scan/'inner').symlink_to(target,target_is_directory=True)
  http('recursive-internal-alias-external-child','POST','/api/datasets/load-local',json={'folder_path':str(scan),'dataset_name':'edge-nested-import'})
  # Descriptor response binds an inode before a parent-directory replacement.
  from core.file_access import owned_file_response
  pinned=root/'edge-pinned';pinned.mkdir(exist_ok=True);(pinned/'data.txt').write_text('pinned original')
  response=owned_file_response(pinned/'data.txt');pinned.rename(root/'edge-pinned-old');pinned.symlink_to(other,target_is_directory=True)
  async def collect():return b''.join([b async for b in response.body_iterator])
  body=asyncio.run(collect());record('parent-replacement-after-open','pinned original',body.decode(),body==b'pinned original')
  # Real queued asynchronous work reads the already-open descriptor after a path swap.
  asyncfile=root/'edge-async.txt';asyncfile.write_text('asynchronous owned')
  response=owned_file_response(asyncfile);asyncfile.rename(root/'edge-async-old.txt');asyncfile.symlink_to(foreign)
  body=asyncio.run(collect());record('asynchronous-descriptor-read','asynchronous owned',body.decode(),body==b'asynchronous owned')
 elif group=='b09':
  models=settings.MODELS_DIR;models.mkdir(exist_ok=True,parents=True)
  def upload(ident,name):return http(ident,'POST','/api/models/load',params={'model_name':name,'model_type':'invalid-test-model'},files={'model_file':('fixture.txt',b'upload synthetic','application/octet-stream')})
  outside=other/'model-upload-outside.txt';upload('model-absolute-name-denied',str(outside));record('model-absolute-no-write',False,outside.exists(),not outside.exists())
  relative=os.path.relpath(other/'model-upload-relative.txt',models);upload('model-relative-name-denied',relative);record('model-relative-no-write',False,(other/'model-upload-relative.txt').exists(),not (other/'model-upload-relative.txt').exists())
  symlink=models/'edge-model-link.txt';symlink.symlink_to(foreign);upload('model-upload-symlink-denied',symlink.name)
  before=set(settings.model_manager.loaded_models)
  hard=models/'edge-model-hard.txt';os.link(foreign,hard);upload('model-upload-hardlink-denied',hard.name)
  record('denied-model-no-registration',len(before),len(settings.model_manager.loaded_models),set(settings.model_manager.loaded_models)==before)
  r=http('owned-model-metadata-create','POST','/api/models/load',(200,),params={'model_name':'owned-synthetic.txt','model_type':'synthetic-metadata'},files={'model_file':('fixture.txt',b'metadata only','application/octet-stream')})
  ident=r.json().get('model_id');record('native-model-manager-registration',True,ident in settings.model_manager.loaded_models,ident in settings.model_manager.loaded_models and settings.model_manager.loaded_models[ident]['model'] is None)
  # Restored native TrainingManager objects must not turn a foreign artifact path into access.
  malicious_dataset=settings.DATASETS_DIR/'edge-foreign-train';malicious_dataset.symlink_to(other,target_is_directory=True)
  settings.active_datasets[malicious_dataset.name]={'id':malicious_dataset.name,'format':'yolo','name':'synthetic foreign input'}
  before_jobs=set(settings.training_manager.training_jobs);before_threads=set(settings.training_manager.training_threads)
  http('training-foreign-input-before-creation','POST','/api/train',json={'dataset_id':malicious_dataset.name,'model_type':'yolo','pretrained':False,'device':'cpu'})
  record('training-denial-no-job-or-thread',True,{'jobs':len(settings.training_manager.training_jobs),'threads':len(settings.training_manager.training_threads)},set(settings.training_manager.training_jobs)==before_jobs and set(settings.training_manager.training_threads)==before_threads)
  settings.training_manager.training_jobs['edge-foreign-artifact']={'id':'edge-foreign-artifact','status':'completed','model_path':str(foreign),'config':{},'logs':[]}
  http('training-foreign-artifact-denied','GET','/api/train/edge-foreign-artifact/export')
  http('format-export-foreign-input-before-model-code','POST','/api/train/edge-foreign-artifact/export-format')
  resume_root=root/'edge-resume-source';resume_root.mkdir()
  paused={'id':'edge-resume','status':'paused','dataset_path':str(resume_root),'last_checkpoint':str(foreign),'model_type':'yolo','config':{},'logs':[]}
  settings.training_manager.training_jobs['edge-resume']=paused
  before_resume=json.dumps(paused,sort_keys=True);before_threads=set(settings.training_manager.training_threads)
  http('resume-foreign-checkpoint-before-thread','POST','/api/train/edge-resume/resume')
  record('resume-denial-no-state-or-thread',True,paused['status'],json.dumps(paused,sort_keys=True)==before_resume and set(settings.training_manager.training_threads)==before_threads)
  settings.training_manager.training_jobs['edge-foreign-checkpoints']={'id':'edge-foreign-checkpoints','dataset_path':str(other),'model_type':'yolo'}
  http('checkpoint-list-foreign-directory','GET','/api/train/edge-foreign-checkpoints/checkpoints')
  checkpoint_root=root/'edge-checkpoint-source';weights=checkpoint_root/'runs/train_edge-owned-checkpoints/train/weights';weights.mkdir(parents=True)
  artifact=weights/'synthetic.pt';artifact.write_text('synthetic text artifact, not model weights')
  settings.training_manager.training_jobs['edge-owned-checkpoints']={'id':'edge-owned-checkpoints','dataset_path':str(checkpoint_root),'model_type':'yolo'}
  http('checkpoint-list-own-directory','GET','/api/train/edge-owned-checkpoints/checkpoints',(200,))
  r=http('checkpoint-download-owned-descriptor','GET','/api/train/edge-owned-checkpoints/checkpoint/synthetic.pt',(200,));record('checkpoint-owned-bytes',True,r.content==artifact.read_bytes(),r.content==artifact.read_bytes())
  settings.training_manager.training_jobs['edge-owned-artifact']={'id':'edge-owned-artifact','status':'completed','model_path':str(owned),'config':{},'logs':[]}
  r=http('training-own-artifact','GET','/api/train/edge-owned-artifact/export',(200,));record('training-own-bytes','owned bytes',hashlib.sha256(r.content).hexdigest(),r.content==owned.read_bytes())
  # Actual model metadata and job records in the real SQLite store; no ML runtime is invoked.
  from resource_store import ResourceStore
  store=ResourceStore(root/'edge-store')
  assets={owner:store.add(owner,'synthetic-model-'+str(owner),'model',metadata={'description':'synthetic metadata only; no weights'}) for owner in (101,202)}
  for owner in (101,202):
   other_id=assets[303-owner]['id'];own_id=assets[owner]['id']
   record('model-asset-own-'+str(owner),'model',store.get(owner,own_id)['kind'],store.get(owner,own_id)['kind']=='model')
   for action in ('query','rename','trash'):
    try:
     if action=='query':store.get(owner,other_id)
     else:store.update(owner,other_id,{'name':'forged-name'} if action=='rename' else {'trash':True})
     actual=200
    except HTTPException as ex:actual=ex.status_code
    record('model-asset-cross-'+action+'-'+str(owner),404,actual,actual==404)
   record('model-asset-owner-retained-'+str(owner),'synthetic-model-'+str(owner),store.get(owner,own_id)['name'],store.get(owner,own_id)['name']=='synthetic-model-'+str(owner))
  a=store.create_job(101,'model-metadata',{'request_id':'edge-A','model_id':'synthetic-A'});b=store.create_job(202,'model-metadata',{'request_id':'edge-B','model_id':'synthetic-B'})
  record('model-metadata-own-A',a['id'],store.job(101,a['id'])['id'],store.job(101,a['id'])['input']['model_id']=='synthetic-A')
  record('model-metadata-own-B',b['id'],store.job(202,b['id'])['id'],store.job(202,b['id'])['input']['model_id']=='synthetic-B')
  for owner,ident in [(101,b['id']),(202,a['id'])]:
   try:store.job(owner,ident);actual=200
   except HTTPException as ex:actual=ex.status_code
   record('model-metadata-cross-'+str(owner),404,actual,actual==404)
  store.finish_job(101,b['id'],'completed',{'forged':True})
  record('async-owner-update-no-foreign-effect','queued',store.job(202,b['id'])['status'],store.job(202,b['id'])['status']=='queued')
  store.finish_job(101,a['id'],'completed',{'owned':True})
  record('async-owner-preserved','completed',store.job(101,a['id'])['status'],store.job(101,a['id'])['result']=={'owned':True})
 record('foreign-bytes-unchanged',foreign_digest,hashlib.sha256(foreign.read_bytes()).hexdigest(),hashlib.sha256(foreign.read_bytes()).hexdigest()==foreign_digest)
except Exception as ex:
 import traceback
 checks.append({'id':'harness-error','status':'FAIL','type':type(ex).__name__,'reason':str(ex),'trace':traceback.format_exc()[-3000:]})
finally:client.close()
result={'status':'PASS' if checks and all(x['status']=='PASS' for x in checks) else 'FAIL','stage':group,'checks':checks,'scope':'Real routers, manager metadata and SQLite synthetic objects; no ML training or shared-write policy acceptance'}
print('API_STAGE_RESULT='+json.dumps(result),flush=True)
sys.exit(0 if result['status']=='PASS' else 1)
