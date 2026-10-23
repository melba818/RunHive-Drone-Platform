"""Revision-bound review drafts for native routes and LLM jobs."""
import hashlib,html,json,re,secrets,time
from fastapi import HTTPException,Request
from starlette.responses import HTMLResponse,JSONResponse

def init(ops):
    with ops.db() as c:c.execute('CREATE TABLE IF NOT EXISTS assistant_prepared(id TEXT PRIMARY KEY,tenant INTEGER NOT NULL,kind TEXT NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,binding TEXT NOT NULL,result TEXT,created INTEGER NOT NULL)')
def get(ops,tenant,did):
    if not re.fullmatch('[a-f0-9]{32}',did):raise HTTPException(404,'参数草稿不存在。')
    init(ops)
    with ops.db() as c:r=c.execute('SELECT * FROM assistant_prepared WHERE id=? AND tenant=?',(did,tenant)).fetchone()
    if not r:raise HTTPException(404,'参数草稿不存在。')
    return dict(r)
def public(r):return {'id':r['id'],'kind':r['kind'],'revision':r['revision'],'status':r['status'],'data':json.loads(r['payload']),'result':json.loads(r['result']) if r['result'] else None}

async def validate(s,kind,data,b):
    from platform_mcp import invoke,resource_id,clean_args
    if kind=='tune':
        clean_args(data,['operation','args'],['args'])
        v=await b.runtime(s,'POST','/assistant/validate',data)
        return {'operation':v['operation'],'args':v['args']},v['binding']
    if kind=='route':
        clean_args(data,['action','id','revision','data'],['action','data'])
        if data['action'] not in {'create','update'}:raise HTTPException(422,'航线操作类型无效。')
        body=data['data']
        if isinstance(body,dict) and data['action']=='update':body={k:v for k,v in body.items() if not(k in {'name','kmz_json'} and isinstance(v,str) and not v.strip())}
        catalog=await b.php(s,'catalog');permission=catalog['resources'].get('routes',{})
        if not permission.get(data['action']):raise HTTPException(403,'当前账号无权修改航线。')
        binding='new'
        if data['action']=='update':
            r=(await b.php(s,'query',{'resource':'routes','id':resource_id(data.get('id'))}))['result'].get('list',[])
            if not r:raise HTTPException(404,'航线不存在。')
            binding=r[0]['revision']
            if data.get('revision') is not None and data['revision']!=binding:raise HTTPException(409,'航线版本已更新，请重新读取。')
            data=dict(data,revision=binding)
        if not isinstance(body,dict) or set(body)-{'name','project_id','airline_floder_id','type','scene','kmz_json'}:raise HTTPException(422,'航线字段无效。')
        if data['action']=='create' and (not body.get('name') or not body.get('project_id') or 'kmz_json' not in body):raise HTTPException(422,'请提供航线名称、项目和航线 JSON。')
        if 'kmz_json' in body:
            if not isinstance(body['kmz_json'],(str,dict)):raise HTTPException(422,'航线内容须为 JSON 对象或字符串。')
            parsed=(await b.php(s,'route_validate',{'resource':'routes','data':{'kmz_json':body['kmz_json']}}))['result']
            body=dict(body,kmz_json=parsed['document'])
        return {**data,'data':body},binding
    raise HTTPException(422,'草稿类型无效。')

async def prepare(s,args,b,ops):
    kind=args['kind']
    if kind=='tune':
        v=await b.runtime(s,'POST','/assistant/drafts',args['data'])
        return {'draft':v,'open_action':{'type':'platform_draft','id':v['id'],'kind':'tune'}}
    data,binding=await validate(s,kind,args['data'],b);did=secrets.token_hex(16);init(ops)
    with ops.db() as c:c.execute("INSERT INTO assistant_prepared VALUES(?,?,?,1,'prepared',?,?,NULL,?)",(did,s['tenant_id'],kind,json.dumps(data,ensure_ascii=False),binding,int(time.time())))
    return {'draft':public(get(ops,s['tenant_id'],did)),'open_action':{'type':'platform_draft','id':did,'kind':kind}}

def install(app,prefix,browser_identity,browser_write,bounded_json):
    @app.get(prefix+'/prepared')
    async def listed(request:Request):
        s=await browser_identity(request);ops=app.state.ops;init(ops)
        with ops.db() as c:rows=c.execute('SELECT * FROM assistant_prepared WHERE tenant=? ORDER BY created DESC LIMIT 40',(s['tenant_id'],)).fetchall()
        own=[public(dict(r)) for r in rows]
        try:own+=(await app.state.bridge.runtime(s,'GET','/assistant/drafts'))['drafts']
        except HTTPException:pass
        return {'drafts':own}
    @app.get(prefix+'/prepared/{did}')
    async def detail(did:str,request:Request):
        s=await browser_identity(request)
        try:value=public(get(app.state.ops,s['tenant_id'],did))
        except HTTPException as e:
            if e.status_code!=404:raise
            value=await app.state.bridge.runtime(s,'GET','/assistant/drafts/'+did)
        return JSONResponse(value,headers={'Cache-Control':'no-store'})
    @app.put(prefix+'/prepared/{did}')
    async def update(did:str,request:Request):
        s=await browser_identity(request);await browser_write(request,s);ops=app.state.ops;body=await bounded_json(request)
        try:r=get(ops,s['tenant_id'],did)
        except HTTPException as e:
            if e.status_code!=404:raise
            return await app.state.bridge.runtime(s,'PUT','/assistant/drafts/'+did,body)
        if set(body)!={'revision','data'} or body['revision']!=r['revision'] or r['status']!='prepared':raise HTTPException(409,'参数草稿已更新或已提交。')
        data,binding=await validate(s,r['kind'],body['data'],app.state.bridge)
        with ops.db() as c:
            n=c.execute("UPDATE assistant_prepared SET revision=revision+1,payload=?,binding=? WHERE id=? AND tenant=? AND revision=? AND status='prepared'",(json.dumps(data,ensure_ascii=False),binding,did,s['tenant_id'],body['revision'])).rowcount
            if n!=1:raise HTTPException(409,'参数草稿版本已更新。')
        return public(get(ops,s['tenant_id'],did))
    @app.post(prefix+'/prepared/{did}/execute')
    async def execute(did:str,request:Request):
        from platform_mcp import invoke
        s=await browser_identity(request);await browser_write(request,s);ops=app.state.ops;body=await bounded_json(request)
        try:r=get(ops,s['tenant_id'],did)
        except HTTPException as e:
            if e.status_code!=404:raise
            return await app.state.bridge.runtime(s,'POST','/assistant/drafts/'+did+'/execute',body)
        if set(body)!={'revision'} or body['revision']!=r['revision']:raise HTTPException(409,'参数草稿版本已更新，请重新核对。')
        if r['status']=='submitted':return public(r)
        if r['status']!='prepared':raise HTTPException(409,'任务已提交或执行状态待核查。')
        data,binding=await validate(s,r['kind'],json.loads(r['payload']),app.state.bridge)
        if binding!=r['binding']:raise HTTPException(409,'关联资源已更新，请重新保存草稿并核对。')
        with ops.db() as c:
            n=c.execute("UPDATE assistant_prepared SET status='submitting' WHERE id=? AND tenant=? AND revision=? AND status='prepared'",(did,s['tenant_id'],body['revision'])).rowcount
            if n!=1:raise HTTPException(409,'任务提交中，请查询执行状态。')
        try:
            if r['kind']=='tune':result=await app.state.bridge.runtime(s,'POST','/jobs',data)
            else:result=await invoke('platform_manage',{'resource':'routes',**data},s,app.state.bridge,ops)
        except HTTPException as e:
            # A transport failure may have happened after the business commit.
            with ops.db() as c:c.execute('UPDATE assistant_prepared SET status=? WHERE id=? AND tenant=?',('uncertain' if e.status_code>=500 else 'prepared',did,s['tenant_id']))
            raise
        with ops.db() as c:c.execute("UPDATE assistant_prepared SET status='submitted',result=? WHERE id=? AND tenant=?",(json.dumps(result,ensure_ascii=False),did,s['tenant_id']))
        return public(get(ops,s['tenant_id'],did))
