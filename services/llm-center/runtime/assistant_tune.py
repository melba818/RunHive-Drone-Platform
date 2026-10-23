"""No-job validation shared with the fine-tuning submit boundary."""
import hashlib,json,re,secrets,time
from fastapi import HTTPException,Request

def install(app,authorize,tenant_id,initialize_tenant,LOCK,workspace_lock,db,sanitize_args,WORKSPACE,MODEL_NAMES,create_job):
    with db() as c:c.execute('CREATE TABLE IF NOT EXISTS assistant_drafts(id TEXT PRIMARY KEY,tenant INTEGER NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,binding TEXT NOT NULL,result TEXT,created INTEGER NOT NULL)')
    def read(tenant,did):
        if not re.fullmatch('[a-f0-9]{32}',did):raise HTTPException(404,'参数草稿不存在。')
        with db() as c:r=c.execute('SELECT * FROM assistant_drafts WHERE id=? AND tenant=?',(did,tenant)).fetchone()
        if not r:raise HTTPException(404,'参数草稿不存在。')
        return dict(r)
    def public(r):return {'id':r['id'],'kind':'tune','revision':r['revision'],'status':r['status'],'data':json.loads(r['payload']),'result':json.loads(r['result']) if r['result'] else None}
    @app.get('/internal/tenants/{tenant}/assistant/catalog')
    def catalog(tenant:int,request:Request):
        tenant_id(tenant);authorize(request,tenant);p=initialize_tenant(tenant)
        with LOCK,workspace_lock(p),db() as c:
            datasets=WORKSPACE.catalog(tenant)
            dataset_versions={}
            for name in list(datasets)[:200]:
                try:
                    _,_,item,_,path,_=WORKSPACE.resource(c,tenant,'dataset',name)
                    dataset_versions[name]=[item['size_bytes'],path.stat().st_mtime_ns]
                except (ValueError,OSError):continue
        return {'models':[{"id":n,**{k:v for k,v in m.items() if k in {'path','trainable','cpu','template'}}} for n,m in MODEL_NAMES.items()],
            'datasets':datasets,'dataset_versions':dataset_versions,'operations':['train','eval','export'],
            'training_fields':{'model_name_or_path':'models[].path','dataset':'datasets 中的名称，多个以逗号分隔','dataset_dir':'data','output_dir':'当前账号内的相对目录',
                'stage':['sft','pt','dpo','kto','rm'],'finetuning_type':['lora','freeze','full'],'cutoff_len':[8,32768],'per_device_train_batch_size':[1,16],
                'gradient_accumulation_steps':[1,128],'learning_rate':[1e-8,.1],'num_train_epochs':[.01,100],'lora_rank':[1,256]},
            'capabilities':{'remote_inference_api_trainable':False,'validation_without_job':True}}
    @app.post('/internal/tenants/{tenant}/assistant/validate')
    def validate(tenant:int,body:dict,request:Request):
        tenant_id(tenant);authorize(request,tenant);p=initialize_tenant(tenant)
        # Accept an explicit training-argument object as well as the canonical
        # operation/args envelope; both return exactly the same normalized DTO.
        if 'args' not in body and 'model_name_or_path' in body:
            body={'operation':body.get('operation','train'),'args':{k:v for k,v in body.items() if k!='operation'}}
        operation=body.get('operation','train')
        if operation not in {'train','eval','export'}:raise HTTPException(422,{'code':'VALIDATION_FAILED','message':'任务类型无效。','errors':[{'field':'operation','code':'INVALID_OPERATION','message':'请选择 train、eval 或 export。'}]})
        if set(body)-{'operation','args'} or not isinstance(body.get('args'),dict):
            raise HTTPException(422,{'code':'VALIDATION_FAILED','message':'微调参数结构无效。','errors':[{'field':'args','code':'INVALID_STRUCTURE','message':'请使用 {operation: train, args: {model_name_or_path, dataset, ...}}，或直接提交完整训练参数对象。'}]})
        with LOCK,workspace_lock(p),db() as c:
            try:
                args,cpu=sanitize_args(body.get('args'),operation,p)
                if operation!='export':WORKSPACE.validate_selection(c,tenant,args)
            except (ValueError,TypeError,OSError) as e:raise HTTPException(getattr(e,'status',422),str(e)) from None
            files=[]
            for f in sorted((p/'data').rglob('*')):
                if f.is_file():
                    st=f.stat();files.append([str(f.relative_to(p/'data')),st.st_size,st.st_mtime_ns])
            model=next(m for m in MODEL_NAMES.values() if m['path']==args['model_name_or_path'])
            fingerprint=hashlib.sha256(json.dumps([files,model],sort_keys=True).encode()).hexdigest()
        return {'args':args,'operation':operation,'binding':fingerprint,'cpu':cpu}
    @app.post('/internal/tenants/{tenant}/assistant/drafts')
    def prepare(tenant:int,body:dict,request:Request):
        v=validate(tenant,body,request);did=secrets.token_hex(16)
        with LOCK,db() as c:c.execute("INSERT INTO assistant_drafts VALUES(?,?,1,'prepared',?,?,NULL,?)",(did,tenant,json.dumps({'operation':v['operation'],'args':v['args']},ensure_ascii=False),v['binding'],int(time.time())))
        return public(read(tenant,did))
    @app.get('/internal/tenants/{tenant}/assistant/drafts')
    def listed(tenant:int,request:Request):
        tenant_id(tenant);authorize(request,tenant)
        with db() as c:rows=c.execute('SELECT * FROM assistant_drafts WHERE tenant=? ORDER BY created DESC LIMIT 40',(tenant,)).fetchall()
        return {'drafts':[public(dict(r)) for r in rows]}
    @app.get('/internal/tenants/{tenant}/assistant/drafts/{did}')
    def detail(tenant:int,did:str,request:Request):
        tenant_id(tenant);authorize(request,tenant);return public(read(tenant,did))
    @app.put('/internal/tenants/{tenant}/assistant/drafts/{did}')
    def update(tenant:int,did:str,body:dict,request:Request):
        tenant_id(tenant);authorize(request,tenant);r=read(tenant,did)
        if set(body)!={'revision','data'} or body['revision']!=r['revision']:raise HTTPException(409,'草稿版本已更新，请重新读取。')
        v=validate(tenant,body['data'],request);payload=json.dumps({'operation':v['operation'],'args':v['args']},ensure_ascii=False)
        if r['status']=='submitted' and json.loads(payload)==json.loads(r['payload']):return public(r)
        if r['status']!='prepared':raise HTTPException(409,'任务已提交，请新建参数草稿。')
        with LOCK,db() as c:
            n=c.execute("UPDATE assistant_drafts SET payload=?,binding=?,revision=revision+1 WHERE id=? AND tenant=? AND revision=? AND status='prepared'",(payload,v['binding'],did,tenant,body['revision'])).rowcount
            if n!=1:raise HTTPException(409,'草稿版本已更新。')
        return public(read(tenant,did))
    @app.post('/internal/tenants/{tenant}/assistant/drafts/{did}/execute')
    def execute(tenant:int,did:str,body:dict,request:Request):
        tenant_id(tenant);authorize(request,tenant);r=read(tenant,did)
        if set(body)!={'revision'} or body['revision']!=r['revision']:raise HTTPException(409,'参数版本已更新，请重新核对。')
        if r['status']=='submitted':return public(r)
        if r['status']!='prepared':raise HTTPException(409,'任务已提交或状态待核查。')
        data=json.loads(r['payload']);v=validate(tenant,data,request)
        if v['binding']!=r['binding']:raise HTTPException(409,'模型或数据已更新，请重新保存并核对。')
        with LOCK,db() as c:
            n=c.execute("UPDATE assistant_drafts SET status='submitting' WHERE id=? AND tenant=? AND revision=? AND status='prepared'",(did,tenant,body['revision'])).rowcount
            if n!=1:raise HTTPException(409,'任务提交中，请查询状态。')
        try:job=create_job(tenant,data,request)
        except HTTPException as e:
            with db() as c:c.execute('UPDATE assistant_drafts SET status=? WHERE id=? AND tenant=?',('uncertain' if e.status_code>=500 else 'prepared',did,tenant))
            raise
        except Exception:
            with db() as c:c.execute("UPDATE assistant_drafts SET status='uncertain' WHERE id=? AND tenant=?",(did,tenant))
            raise HTTPException(503,'任务提交状态待核查，请查看任务列表。') from None
        with db() as c:c.execute("UPDATE assistant_drafts SET status='submitted',result=? WHERE id=? AND tenant=?",(json.dumps(job,ensure_ascii=False),did,tenant))
        return public(read(tenant,did))
