"""Runhive platform MCP: native RBAC, isolated tuning APIs, explicit flight review."""
from __future__ import annotations
import asyncio,hashlib,hmac,html,json,os,re,secrets,sqlite3,time
from contextlib import asynccontextmanager,contextmanager,closing
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs,quote,urlsplit
import httpx
from fastapi import FastAPI,HTTPException,Request
from starlette.responses import HTMLResponse,JSONResponse,Response

RELEASE='runhive-agent-platform-20261011-v28'
ROUTE_CONTRACT=json.loads(Path(__file__).with_name('route-contract.json').read_text(encoding='utf-8'))
TUNE={'tune_datasets':'dataset','tune_jobs':'job','tune_exports':'export'}
BUSINESS=['applications','routes','devices','flight_tasks','flight_records','telemetry','projects','media','model_assets','alerts']
PREFIX='/llm-center/agent/platform'
PROTOCOLS={'2024-11-05','2025-03-26','2025-06-18','2025-11-25'}

def schema(properties=None,required=None):
    return {'type':'object','properties':properties or {},'required':required or [],'additionalProperties':False}
def tool(name,description,properties=None,required=None,readonly=True):
    return {'name':name,'description':description,'inputSchema':schema(properties,required),'annotations':{'readOnlyHint':readonly,'destructiveHint':False,'idempotentHint':readonly,'openWorldHint':False}}
from assistant_service import AssistantService, assistant_tools, invoke_assistant
STR={'type':'string'};OBJ={'type':'object'}
TOOLS=[
    tool('platform_catalog','查看当前账号可操作的平台模块、操作名称和参数要求。首先调用此工具，确认模块权限。',{'module':{'type':'string','enum':['tune','applications','routes','flight','other']}}),
    tool('platform_query','查询微调数据/任务/导出、应用、航线、设备、飞行任务/记录、遥测、项目、媒体、模型资产和告警。仅使用返回的真实 ID。',{'resource':{'type':'string','enum':list(TUNE)+BUSINESS},'id':STR,'page':{'type':'integer','minimum':1},'limit':{'type':'integer','minimum':1,'maximum':100},'filters':OBJ},['resource']),
    tool('platform_manage','执行账号范围内的业务操作。先查看目录参数。航线可用查询返回的 kmz_json 创建或编辑；编辑必须携带查询返回的 revision，名称部分更新无需 kmz_json。不能用于下发飞行任务。',{'resource':{'type':'string','enum':list(TUNE)+['applications','routes','projects']},'action':{'type':'string','enum':['create','update','rename','pin','unpin','archive','unarchive','train','eval','export','cancel']},'id':STR,'revision':{'anyOf':[{'type':'integer','minimum':0},STR]},'data':OBJ},['resource','action'],False),
    tool('flight_prepare_task','根据用户明确指定的设备、航线、执行方式和返航高度创建飞行任务待确认记录，返回确认链接。此工具不向设备下发任务；用户在确认页面提交后才执行。',{'name':STR,'equipment_id':{'type':'integer','minimum':1},'airline_id':{'type':'integer','minimum':1},'task_type':{'type':'integer','enum':[0,1]},'execute_time':{'type':'integer'},'rth_altitude':{'type':'integer','minimum':20,'maximum':500},'rth_mode':{'type':'integer','enum':[0,1]},'out_of_control_action':{'type':'integer','enum':[0,1,2]},'exit_wayline_when_rc_lost':{'type':'integer','enum':[0,1]},'wayline_precision_type':{'type':'integer','enum':[0,1]}},['name','equipment_id','airline_id','task_type','rth_altitude'],False),
    tool('platform_operation_status','查询飞行待确认记录的审核及业务执行结果。',{'request_id':STR},['request_id']),
    tool('platform_validate_route','校验航线 JSON 并返回规范化值和统计；不创建、不修改航线。kmz_json 接受对象或旧接口返回的 JSON 字符串。',{'kmz_json':{'anyOf':[OBJ,STR]}},['kmz_json']),
]

TOOLS += assistant_tools(tool,STR,OBJ)
from workbench_api import agent_tools
WORKBENCH_NAMES={'assistant_task_plan','assistant_workflow_prepare','assistant_workflows','assistant_resource_search','assistant_change_detection'}
TOOLS += agent_tools(tool,STR,OBJ)
ASSISTANT_NAMES={'platform_catalog','platform_query','platform_validate_route','flight_prepare_task','platform_operation_status','assistant_catalog','assistant_prepare','assistant_drafts','assistant_choose','assistant_corridors','assistant_route_workflow'}
ASSISTANT_NAMES |= WORKBENCH_NAMES

@dataclass
class Settings:
    php_url:str='http://127.0.0.1:1819'
    control_url:str='http://127.0.0.1:4021'
    gateway_db:str='/gateway-state/dual-sessions.sqlite3'
    state_db:str='/state/platform.sqlite3'
    internal_key_file:str='/secrets/llm-center-internal-secret.txt'
    runtime_key_file:str='/secrets/llm-center-runtime-secret.txt'
    portal_url:str='http://127.0.0.1:1819'
    node_path:str='/usr/local/bin/node'
    @classmethod
    def environment(cls):
        return cls(**{k:os.getenv('PLATFORM_'+k.upper(),v) for k,v in cls().__dict__.items()})

class Operations:
    def __init__(self,path):
        self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.db() as c:
            c.execute('CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,tenant INTEGER NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,entities TEXT NOT NULL,result TEXT,created INTEGER NOT NULL,expires INTEGER NOT NULL)')
            c.execute('CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,tenant INTEGER NOT NULL,tool TEXT NOT NULL,outcome TEXT NOT NULL,created INTEGER NOT NULL)')
        os.chmod(self.path,0o600)
    @contextmanager
    def db(self):
        c=sqlite3.connect(self.path,timeout=10);c.row_factory=sqlite3.Row
        try:
            with c:yield c
        finally:c.close()
    def add(self,tenant,data,entities):
        rid=secrets.token_hex(24);now=int(time.time())
        with self.db() as c:c.execute('INSERT INTO operations VALUES(?,?,?,\'pending\',?,?,NULL,?,?)',(rid,tenant,'flight_dispatch',json.dumps(data,ensure_ascii=False),json.dumps(entities,ensure_ascii=False),now,now+900))
        return rid
    def get(self,tenant,rid):
        if not isinstance(rid,str) or not re.fullmatch('[a-f0-9]{48}',rid):raise HTTPException(400,'任务标识无效。')
        with self.db() as c:r=c.execute('SELECT * FROM operations WHERE id=? AND tenant=?',(rid,tenant)).fetchone()
        if r is None:raise HTTPException(404,'待确认任务不存在。')
        return dict(r)
    def claim(self,tenant,rid):
        with self.db() as c:
            n=c.execute("UPDATE operations SET status='executing' WHERE id=? AND tenant=? AND status='pending' AND expires>?",(rid,tenant,int(time.time()))).rowcount
        return n==1
    def finish(self,tenant,rid,status,result):
        with self.db() as c:c.execute('UPDATE operations SET status=?,result=? WHERE id=? AND tenant=?',(status,json.dumps(result,ensure_ascii=False),rid,tenant))
    def audit(self,tenant,name,outcome):
        with self.db() as c:c.execute('INSERT INTO audit(tenant,tool,outcome,created) VALUES(?,?,?,?)',(tenant,name,outcome,int(time.time())))

def gateway_session(filename,tenant=None,sid=None,family=None):
    now=int(time.time())
    args=[now,now];extra='';order='ORDER BY s.expires_at DESC,s.rowid DESC LIMIT 1'
    if tenant is not None:extra+=' AND s.tenant_id=?';args.append(tenant)
    if sid is not None:
        if not all(isinstance(x,str) and re.fullmatch('[a-f0-9]{64}',x) for x in [sid,family]):raise HTTPException(401,'请从 Runhive 登录后进入 Agent 中心。')
        extra+=' AND s.sid_hash=? AND s.family_hash=?';args.extend([hashlib.sha256(sid.encode()).hexdigest(),hashlib.sha256(family.encode()).hexdigest()])
    try:
        with closing(sqlite3.connect(Path(filename).as_uri()+'?mode=ro',uri=True)) as c:
            c.row_factory=sqlite3.Row
            row=c.execute("SELECT s.* FROM dual_sessions s JOIN browser_groups g ON g.family_hash=s.family_hash AND g.tenant_id=s.tenant_id WHERE s.module='agent' AND s.expires_at>? AND g.expires_at>?"+extra+' '+order,args).fetchone()
    except sqlite3.Error:raise HTTPException(503,'平台登录服务暂时不可用。') from None
    if row is None:raise HTTPException(401,'平台登录已失效，请重新进入 Agent 中心。')
    return dict(row)

class Bridge:
    def __init__(self,settings,client,internal_key,runtime_key):
        self.settings=settings;self.client=client;self.internal_key=internal_key;self.runtime_key=runtime_key;self.assistant=AssistantService(self)
    async def php(self,session,action,params=None):
        try:
            identity={'workflow_handle':session['workflow_handle'],'workflow_id':session.get('workflow_id'),'definition_sha256':session.get('definition_hash')} if session.get('workflow_handle') else {'session_handle':session['php_handle']}
            res=await self.client.post(self.settings.php_url+'/api/Agentbridge/call',json={'tenant_id':session['tenant_id'],**identity,'action':action,'params':params or {}},headers={'X-LLM-Internal-Key':self.internal_key},timeout=45)
            body=res.json()
        except (httpx.HTTPError,ValueError):raise HTTPException(503,'平台业务接口暂时不可用。') from None
        if res.status_code!=200 or not isinstance(body,dict) or body.get('code')!=1 or not isinstance(body.get('data'),dict):
            detail=body.get('msg','业务操作未完成。') if isinstance(body,dict) else '业务操作未完成。'
            fields=body.get('data',{}) if isinstance(body,dict) else {}
            if isinstance(fields,dict) and fields.get('errors'):detail=dict(fields,message=str(detail)[:300])
            raise HTTPException(res.status_code if res.status_code in [400,401,403,404,409,413,422,503] else 400,detail)
        if body['data'].get('tenant_id')!=session['tenant_id']:raise HTTPException(403,'账号访问范围不匹配。')
        return body['data']
    async def runtime(self,session,method,path,data=None):
        await self.php(session,'authorize_tune')
        try:
            res=await self.client.request(method,self.settings.control_url+'/internal/tenants/'+str(session['tenant_id'])+path,json=data,headers={'Authorization':'Bearer '+self.runtime_key},timeout=60)
            body=res.json()
        except (httpx.HTTPError,ValueError):raise HTTPException(503,'微调服务暂时不可用。') from None
        if res.status_code>=400:
            detail=body.get('detail','微调操作未完成。')
            raise HTTPException(res.status_code,detail if isinstance(detail,dict) else str(detail)[:400])
        return body
    async def authenticate(self,request,tenant):
        if not 1<=tenant<=2147483647:raise HTTPException(400,'账号标识无效。')
        if request.headers.get('origin'):raise HTTPException(403,'此工具接口仅接受 Agent 服务调用。')
        auth=request.headers.get('authorization','')
        if not re.fullmatch(r'Bearer [A-Za-z0-9_-]{64,128}',auth):raise HTTPException(401,'工具请求未授权。')
        try:res=await self.client.get(self.settings.control_url+'/broker/'+str(tenant)+'/v1/models',headers={'Authorization':auth},timeout=8)
        except httpx.HTTPError:raise HTTPException(503,'Agent 身份验证暂时不可用。') from None
        if res.status_code!=200:raise HTTPException(403,'账号实例认证失败。')
        session=gateway_session(self.settings.gateway_db,tenant=tenant)
        await self.php(session,'catalog');return session

def clean_args(args,allowed,required=()):
    if not isinstance(args,dict) or set(args)-set(allowed) or any(k not in args for k in required):raise HTTPException(400,'操作参数无效。')
def integer(x,low,high):
    if type(x)!=int or not low<=x<=high:raise HTTPException(400,'数值参数无效。')
    return x
def resource_id(x):
    if not isinstance(x,str) or not x or len(x)>240 or any(c in x for c in '\x00\r\n\\'):raise HTTPException(400,'资源标识无效。')
    return x

async def invoke(name,args,session,bridge,ops):
    if name in WORKBENCH_NAMES:
        from workbench_api import invoke_tool
        return await invoke_tool(name,args,session,bridge,ops)
    if name.startswith('assistant_'):return await invoke_assistant(name,args,session,bridge,ops)
    if name=='platform_catalog':
        clean_args(args,['module']);c=await bridge.php(session,'catalog')
        c['modules']={
            'tune':{'available':c['tune'],'queries':list(TUNE),'manage':['create','rename','pin','unpin','archive','unarchive','train','eval','export','cancel'],
                'parameters':{
                    'create_dataset':{'resource':'tune_datasets','action':'create','data':{'name':'dataset_name','records':[{'instruction':'问题','input':'','output':'回答'}]}},
                    'train':{'resource':'tune_jobs','action':'train','data':{'args':{'model_name_or_path':'/models/tiny-llama','stage':'sft','finetuning_type':'lora','dataset':'quickstart','dataset_dir':'data','output_dir':'agent-training','cutoff_len':256,'per_device_train_batch_size':1,'max_steps':1,'do_train':True}}},
                    'resource_change':'需要 id、当前 revision；rename 的 data.label 为新名称。'}},
            'applications':{'resources':['applications'],'manage':['create','update','rename'],'fields':['name','status','icon','content','launch_url']},
            'routes':{'resources':['routes','projects'],'manage':['create','update','rename'],'contract':ROUTE_CONTRACT,'create_required':['name','project_id'],'geometry':'kmz_json (object or JSON string), or waypoints + settings; use only one geometry format','update_required':['id','revision'],'update_optional':['name','kmz_json'],'readonly_project':'project_id/airline_floder_id may be echoed unchanged; moving is not supported','validate_tool':'platform_validate_route'},
            'flight':{'resources':['devices','flight_tasks','flight_records','telemetry'],'dispatch':'flight_prepare_task 返回确认链接，用户确认后下发；不支持通过工具跳过确认。'},
            'other':{'resources':[k for k in c['resources'] if k not in ['applications','routes','devices','flight_tasks','flight_records','telemetry','projects']]}}
        if args.get('module'):
            if args['module'] not in c['modules']:raise HTTPException(400,'模块类型无效。')
            c['modules']={args['module']:c['modules'][args['module']]}
        return c
    if name=='platform_query':
        clean_args(args,['resource','id','page','limit','filters'],['resource']);resource=args['resource']
        if resource in TUNE:
            if args.get('filters'):raise HTTPException(400,'微调资源请按返回的分组和 ID 查询。')
            if 'id' in args:return await bridge.runtime(session,'GET','/workspace/detail?kind='+TUNE[resource]+'&resource='+quote(resource_id(args['id']),safe=''))
            page=integer(args.get('page',1),1,10000);limit=integer(args.get('limit',20),1,100)
            workspace=await bridge.runtime(session,'GET','/workspace')
            groups=workspace.get('groups',[]);items=[i for g in groups for i in g['items'] if i.get('kind')==TUNE[resource]]
            chosen={i['id'] for i in items[(page-1)*limit:page*limit]}
            return dict(workspace,total=len(items),page=page,limit=limit,groups=[dict(g,items=[i for i in g['items'] if i.get('kind')==TUNE[resource] and i['id'] in chosen]) for g in groups])
        if resource not in BUSINESS:raise HTTPException(400,'资源类型无效。')
        return (await bridge.php(session,'query',args))['result']
    if name=='platform_manage':
        clean_args(args,['resource','action','id','revision','data'],['resource','action'])
        r=args['resource'];a=args['action'];data=args.get('data',{})
        if not isinstance(data,dict):raise HTTPException(400,'操作数据无效。')
        if r in TUNE:
            if a in ['rename','pin','unpin','archive','unarchive']:
                clean_args(data,['label']);body={'kind':TUNE[r],'id':resource_id(args.get('id')),'action':a,'revision':integer(args.get('revision'),0,2147483647)}
                if a=='rename':body['label']=data.get('label')
                elif data:raise HTTPException(400,'此操作不需要额外数据。')
                return await bridge.runtime(session,'POST','/workspace/action',body)
            if r=='tune_jobs' and a in ['train','eval','export']:
                clean_args(data,['args'],['args']);return await bridge.runtime(session,'POST','/jobs',{'operation':a,'args':data['args']})
            if r=='tune_jobs' and a=='cancel':
                jid=resource_id(args.get('id'))
                if not re.fullmatch('[a-f0-9]{32}',jid):raise HTTPException(400,'微调任务标识无效。')
                return await bridge.runtime(session,'POST','/jobs/'+jid+'/cancel',{})
            if r=='tune_datasets' and a=='create':
                clean_args(data,['name','records'],['name','records']);rid=resource_id(data['name']);rows=data['records']
                if not isinstance(rows,list) or not 1<=len(rows)<=1000 or len(json.dumps(rows,ensure_ascii=False).encode())>512000:raise HTTPException(400,'请提供不超过 1000 条、512 KB 的数据；较大文件请在训练数据页面上传。')
                await bridge.php(session,'authorize_tune')
                res=await bridge.client.post(bridge.settings.control_url+'/internal/instances/ensure',json={'tenant_id':session['tenant_id'],'module':'tune'},headers={'Authorization':'Bearer '+bridge.runtime_key},timeout=180)
                res.raise_for_status();instance=res.json();u=urlsplit(instance.get('base_url',''))
                if instance.get('tenant_id')!=session['tenant_id'] or instance.get('module')!='tune' or u.hostname!='127.0.0.1' or not 40100<=(u.port or 0)<41000:raise HTTPException(503,'微调实例配置无效。')
                upload=await bridge.client.post(instance['base_url']+'/gradio_api/upload',files={'files':('agent-dataset.json',json.dumps(rows,ensure_ascii=False).encode(),'application/json')},headers={'X-LLM-Instance-Key':instance['instance_key']},timeout=30)
                upload.raise_for_status();paths=upload.json()
                if not isinstance(paths,list) or len(paths)!=1 or not isinstance(paths[0],str) or not paths[0].startswith('/tenant/cache/gradio/'):raise HTTPException(503,'数据上传结果无效。')
                return await bridge.runtime(session,'POST','/workspace/import',{'name':rid,'cache_file':paths[0].removeprefix('/tenant/cache/gradio/')})
            raise HTTPException(400,'此微调操作不受支持。')
        if r not in ['applications','routes','projects'] or a not in ['create','update','rename']:raise HTTPException(400,'此资源操作不受支持。')
        if a=='rename':clean_args(data,['name'],['name']);a='update'
        if r=='routes':
            allowed=ROUTE_CONTRACT['create_fields'] if a=='create' else ROUTE_CONTRACT['update_fields']
            unknown=set(data)-set(allowed)
            if unknown:raise HTTPException(422,{'code':'VALIDATION_FAILED','message':'航线参数校验未通过。','errors':[{'field':k,'code':'UNKNOWN_FIELD','message':'此字段不受支持。'} for k in sorted(unknown)]})
            if 'kmz_json' in data and data['kmz_json'] is None:raise HTTPException(422,{'code':'VALIDATION_FAILED','message':'航线参数校验未通过。','errors':[{'field':'kmz_json','code':'INVALID_TYPE','message':'航线内容须为 JSON 对象或 JSON 字符串。'}]})
            if 'kmz_json' in data and any(k in data for k in ['waypoints','settings','takeoff']):raise HTTPException(422,{'code':'VALIDATION_FAILED','message':'航线参数校验未通过。','errors':[{'field':'kmz_json','code':'CONFLICTING_INPUT','message':'JSON 与航点规划参数不能同时提交。'}]})
            if a=='update':
                revision=args.get('revision',data.get('revision'))
                if not isinstance(revision,str) or not re.fullmatch('[a-f0-9]{64}',revision):raise HTTPException(422,{'code':'VALIDATION_FAILED','message':'航线参数校验未通过。','errors':[{'field':'revision','code':'REQUIRED','message':'请提供查询结果中的航线版本。'}]})
                data=dict(data,revision=revision)
            if 'waypoints' in data:
                planning=dict(data);planning.pop('revision',None)
                if a=='update':
                    existing=(await bridge.php(session,'query',{'resource':'routes','id':resource_id(args.get('id'))}))['result'].get('list',[])
                    if not existing:raise HTTPException(404,'航线不存在。')
                    planning={'name':existing[0]['name'],'project_id':existing[0]['project_id'],**planning}
                process=await asyncio.create_subprocess_exec(bridge.settings.node_path,str(Path(__file__).with_name('route_compile.mjs')),stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
                try:stdout,stderr=await asyncio.wait_for(process.communicate(json.dumps(planning,ensure_ascii=False).encode()),15)
                except asyncio.TimeoutError:
                    process.kill();await process.wait();raise HTTPException(503,'航线规划超时。') from None
                if process.returncode:
                    try:detail=json.loads(stderr)
                    except ValueError:detail={'code':'VALIDATION_FAILED','message':'航线参数校验未通过。'}
                    raise HTTPException(422,detail)
                if len(stdout)>ROUTE_CONTRACT['max_bytes']*2:raise HTTPException(413,'航线内容过大。')
                compiled=json.loads(stdout);data={k:v for k,v in data.items() if k not in ['waypoints','settings','takeoff']};data.update(kmz_json=compiled['kmz_json'])
            body={'resource':'routes','data':data}
            if a=='update':body['id']=resource_id(args.get('id'))
            return (await bridge.php(session,'route_create' if a=='create' else 'route_update',body))['result']
        body={'resource':r,'data':data}
        if 'id' in args:body['id']=resource_id(args['id'])
        return (await bridge.php(session,a,body))['result']
    if name=='flight_prepare_task':
        clean_args(args,list(TOOLS[3]['inputSchema']['properties']),TOOLS[3]['inputSchema']['required'])
        validated=await bridge.php(session,'flight_validate',{'resource':'flight_tasks','data':args})
        rid=ops.add(session['tenant_id'],validated['data'],validated['entities'])
        return {'request_id':rid,'status':'pending','confirmation_url':bridge.settings.portal_url.rstrip('/')+PREFIX+'/requests/'+rid,'expires_in_seconds':900,'device':validated['entities']['devices'].get('nickname'),'route':validated['entities']['routes'].get('name'),'dispatched':False}
    if name=='platform_operation_status':
        clean_args(args,['request_id'],['request_id']);r=ops.get(session['tenant_id'],args['request_id'])
        return {'request_id':r['id'],'status':'expired' if r['status']=='pending' and r['expires']<=int(time.time()) else r['status'],'result':json.loads(r['result']) if r['result'] else None}
    if name=='platform_validate_route':
        clean_args(args,['kmz_json'],['kmz_json']);return (await bridge.php(session,'route_validate',{'resource':'routes','data':args}))['result']
    raise HTTPException(400,'工具名称无效。')

def create_app(settings=None,client=None):
    settings=settings or Settings.environment()
    @asynccontextmanager
    async def lifespan(app):
        app.state.client=client or httpx.AsyncClient(follow_redirects=False,timeout=45)
        internal=Path(settings.internal_key_file).read_text().strip();runtime=Path(settings.runtime_key_file).read_text().strip()
        if len(internal)<64 or len(runtime)<64:raise RuntimeError('Platform secrets are not configured')
        app.state.bridge=Bridge(settings,app.state.client,internal,runtime);app.state.ops=Operations(settings.state_db)
        from workflow_engine import WorkflowEngine
        app.state.workflows=WorkflowEngine(app.state.bridge,app.state.ops)
        app.state.bridge.workflows=app.state.workflows
        app.state.workflows.start_loop()
        try:yield
        finally:
            await app.state.workflows.close()
            if client is None:await app.state.client.aclose()
    app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None,lifespan=lifespan)
    @app.exception_handler(HTTPException)
    async def business_error(request,exc):
        detail=exc.detail if isinstance(exc.detail,dict) else {'message':str(exc.detail)}
        return JSONResponse(dict(detail,status=exc.status_code,request_id=detail.get('request_id',secrets.token_hex(12))),status_code=exc.status_code,headers={'Cache-Control':'no-store'})
    async def bounded_json(request):
        raw=bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw)>ROUTE_CONTRACT['max_bytes']:raise HTTPException(413,'请求内容不能超过 4 MB。')
        try:value=json.loads(raw)
        except ValueError:raise HTTPException(400,{'code':'INVALID_JSON','message':'JSON 格式无效。'}) from None
        if not isinstance(value,dict):raise HTTPException(422,{'code':'VALIDATION_FAILED','message':'请求内容须为对象。','errors':[{'field':'$','code':'INVALID_TYPE','message':'请求内容须为对象。'}]})
        return value
    @app.get('/health')
    async def health():return {'status':'healthy','release_id':RELEASE}
    @app.api_route('/platform/{tenant}/assistant-mcp',methods=['POST','GET','DELETE'])
    @app.api_route('/platform/{tenant}/mcp',methods=['POST','GET','DELETE'])
    async def mcp(tenant:int,request:Request):
        bridge=app.state.bridge;session=await bridge.authenticate(request,tenant)
        if request.method!='POST':return Response(status_code=405,headers={'Allow':'POST'})
        version=request.headers.get('mcp-protocol-version','2025-03-26')
        if version not in PROTOCOLS:raise HTTPException(400,'MCP 协议版本不受支持。')
        body=bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body)>ROUTE_CONTRACT['max_bytes']:raise HTTPException(413,'工具请求内容过大。')
        try:p=json.loads(body)
        except ValueError:raise HTTPException(400,'工具请求格式无效。') from None
        if not isinstance(p,dict) or p.get('jsonrpc')!='2.0':raise HTTPException(400,'工具请求格式无效。')
        if 'id' not in p:return Response(status_code=202)
        rid=p['id'];method=p.get('method');params=p.get('params',{})
        try:
            if method=='initialize':
                requested=params.get('protocolVersion');result={'protocolVersion':requested if requested in PROTOCOLS else '2025-06-18','capabilities':{'tools':{'listChanged':False}},'serverInfo':{'name':'runhive-platform','version':'25'}}
            elif method=='ping':result={}
            elif method=='tools/list':result={'tools':[t for t in TOOLS if not request.url.path.endswith('/assistant-mcp') or t['name'] in ASSISTANT_NAMES]}
            elif method=='tools/call':
                name=params.get('name');args=params.get('arguments',{})
                try:
                    if request.url.path.endswith('/assistant-mcp') and name not in ASSISTANT_NAMES:raise HTTPException(403,'平台助手仅可查询和准备参数，请在页面确认执行。')
                    value=await invoke(name,args,session,bridge,app.state.ops)
                    if request.url.path.endswith('/assistant-mcp') and name=='platform_query' and args.get('resource')=='routes':
                        value=compact_route_query(value)
                    app.state.ops.audit(tenant,name,'completed')
                    result={'content':[{'type':'text','text':json.dumps(value,ensure_ascii=False)}],'isError':False}
                except HTTPException as e:
                    app.state.ops.audit(tenant,str(name)[:100],'HTTP_'+str(e.status_code));detail=e.detail if isinstance(e.detail,dict) else {'message':str(e.detail)};detail=dict(detail,status=e.status_code,request_id=detail.get('request_id',secrets.token_hex(12)));result={'content':[{'type':'text','text':json.dumps(detail,ensure_ascii=False)}],'structuredContent':detail,'isError':True}
                except (httpx.HTTPError,ValueError,TypeError,KeyError):
                    app.state.ops.audit(tenant,str(name)[:100],'failed');result={'content':[{'type':'text','text':'业务操作未完成，请检查参数或稍后重试。'}],'isError':True}
            else:return JSONResponse({'jsonrpc':'2.0','id':rid,'error':{'code':-32601,'message':'Method not found'}})
            return JSONResponse({'jsonrpc':'2.0','id':rid,'result':result})
        except (AttributeError,TypeError):return JSONResponse({'jsonrpc':'2.0','id':rid,'error':{'code':-32602,'message':'Invalid params'}})

    async def browser_identity(request):
        sid=request.cookies.get('llm_center_session_agent');family=request.cookies.get('llm_center_browser')
        if not sid or not family:raise HTTPException(401,'请从 Runhive 登录后进入 Agent 中心。')
        s=gateway_session(settings.gateway_db,sid=sid,family=family)
        await app.state.bridge.php(s,'catalog');return s
    def csrf(session,rid):return hmac.new(app.state.bridge.internal_key.encode(),(session['sid_hash']+':'+rid).encode(),hashlib.sha256).hexdigest()
    async def browser_write(request,s):
        origin=request.headers.get('origin','')
        if urlsplit(origin).netloc!=request.headers.get('host','') or urlsplit(origin).scheme not in ['http','https']:raise HTTPException(403,'请求来源无效。')
        if not hmac.compare_digest(request.headers.get('x-platform-csrf',''),csrf(s,'platform')):raise HTTPException(403,'请求校验失败，请刷新页面。')
    @app.get(PREFIX+'/session')
    async def browser_session(request:Request):
        s=await browser_identity(request);return JSONResponse({'tenant_id':s['tenant_id'],'csrf':csrf(s,'platform'),'route_contract':ROUTE_CONTRACT},headers={'Cache-Control':'no-store'})
    from assistant_service import install as install_assistant
    from platform_drafts import install as install_drafts
    install_assistant(app,PREFIX,browser_identity,browser_write,bounded_json)
    install_drafts(app,PREFIX,browser_identity,browser_write,bounded_json)
    from workbench_api import install as install_workbench
    install_workbench(app,PREFIX,browser_identity,browser_write,bounded_json)
    @app.get(PREFIX+'/routes/{route_id}')
    async def route_get(route_id:str,request:Request):
        s=await browser_identity(request);v=await invoke('platform_query',{'resource':'routes','id':route_id},s,app.state.bridge,app.state.ops)
        if not v.get('list'):raise HTTPException(404,'航线不存在。')
        return JSONResponse(v['list'][0],headers={'Cache-Control':'no-store'})
    @app.post(PREFIX+'/routes/validate')
    async def route_validate(request:Request):
        s=await browser_identity(request);await browser_write(request,s);return await invoke('platform_validate_route',await bounded_json(request),s,app.state.bridge,app.state.ops)
    @app.post(PREFIX+'/routes')
    async def route_create(request:Request):
        s=await browser_identity(request);await browser_write(request,s)
        v=await invoke('platform_manage',{'resource':'routes','action':'create','data':await bounded_json(request)},s,app.state.bridge,app.state.ops)
        return JSONResponse(v,status_code=201,headers={'Cache-Control':'no-store','Location':PREFIX+'/routes/'+str(v['route']['id'])})
    @app.put(PREFIX+'/routes/{route_id}')
    @app.patch(PREFIX+'/routes/{route_id}')
    async def route_update(route_id:str,request:Request):
        s=await browser_identity(request);await browser_write(request,s)
        return await invoke('platform_manage',{'resource':'routes','action':'update','id':route_id,'data':await bounded_json(request)},s,app.state.bridge,app.state.ops)
    @app.get(PREFIX+'/requests/{rid}')
    async def review(rid:str,request:Request):
        s=await browser_identity(request);r=app.state.ops.get(s['tenant_id'],rid);data=json.loads(r['payload']);entities=json.loads(r['entities'])
        labels={'name':'任务名称','equipment_id':'设备 ID','airline_id':'航线 ID','task_type':'执行方式','execute_time':'执行时间','rth_altitude':'返航高度（米）','rth_mode':'返航高度模式','out_of_control_action':'遥控器失控动作','exit_wayline_when_rc_lost':'航线失控动作','wayline_precision_type':'航线精度'}
        data['task_type']='立即执行' if data['task_type']==0 else '定时执行'
        data['execute_time']='确认后执行' if data['task_type']=='立即执行' else time.strftime('%Y-%m-%d %H:%M:%S',time.localtime(data['execute_time']))
        fields=''.join('<tr><th>'+html.escape(labels.get(k,k))+'</th><td>'+html.escape(str(v))+'</td></tr>' for k,v in data.items())
        names='<p>设备：'+html.escape(str(entities['devices'].get('nickname',data['equipment_id'])))+'　航线：'+html.escape(str(entities['routes'].get('name',data['airline_id'])))+'</p>'
        pending=r['status']=='pending' and r['expires']>int(time.time())
        form=('<form method="post"><input type="hidden" name="csrf" value="'+csrf(s,rid)+'"><button name="action" value="approve">确认下发</button><button class="secondary" name="action" value="reject">取消</button></form>') if pending else '<p>当前状态：'+html.escape(r['status'])+'</p>'
        content='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>飞行任务确认</title><style>body{margin:0;background:#f5f8fc;color:#263445;font:14px system-ui}main{max-width:760px;margin:48px auto;padding:28px;background:white;border:1px solid #e3e8ef;border-radius:12px}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #edf0f5;overflow-wrap:anywhere}th{width:45%;color:#68778b}form{display:flex;gap:12px;margin-top:24px}button{border:0;border-radius:6px;background:#409eff;color:white;padding:10px 20px;cursor:pointer}.secondary{background:#edf1f6;color:#455468}</style><main><h1>飞行任务确认</h1><p>确认后将向所选设备下发飞行任务。请核对设备、航线、执行时间和返航高度。</p>'+names+'<table>'+fields+'</table>'+form+'</main></html>'
        return HTMLResponse(content,headers={'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'})
    @app.post(PREFIX+'/requests/{rid}')
    async def confirm(rid:str,request:Request):
        s=await browser_identity(request);r=app.state.ops.get(s['tenant_id'],rid)
        origin=request.headers.get('origin');host=request.headers.get('host','')
        if not origin or urlsplit(origin).netloc!=host or urlsplit(origin).scheme not in ['http','https']:raise HTTPException(403,'确认请求来源无效。')
        raw=bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw)>4096:raise HTTPException(413,'确认请求内容过大。')
        form=parse_qs(raw.decode('utf-8'))
        if not hmac.compare_digest(form.get('csrf',[''])[0],csrf(s,rid)):raise HTTPException(403,'确认请求无效，请重新打开确认页面。')
        action=form.get('action',[''])[0]
        if action not in ['approve','reject']:raise HTTPException(400,'确认操作无效。')
        if not app.state.ops.claim(s['tenant_id'],rid):raise HTTPException(409,'任务已处理或确认已过期。')
        if action=='reject':app.state.ops.finish(s['tenant_id'],rid,'cancelled',{'dispatched':False});message='任务已取消，未下发到设备。'
        else:
            try:
                data=json.loads(r['payload']);result=await app.state.bridge.php(s,'flight_dispatch',{'resource':'flight_tasks','data':data})
                app.state.ops.finish(s['tenant_id'],rid,'completed',result['result']);message='飞行任务已提交。请在飞控页面查看设备执行状态。'
            except HTTPException as e:
                app.state.ops.finish(s['tenant_id'],rid,'failed',{'detail':str(e.detail),'automatic_retry':False});message='下发未完成：'+str(e.detail)
        return HTMLResponse('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>飞行任务结果</title><p>'+html.escape(message)+'</p></html>',headers={'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"})
    return app

app=create_app()


def compact_route_query(value):
    value=json.loads(json.dumps(value))
    for row in value.get('list',[]) if isinstance(value,dict) else []:
        raw=row.pop('kmz_json',None)
        try:doc=json.loads(raw) if isinstance(raw,str) else raw
        except (TypeError,ValueError):doc={}
        points=(doc or {}).get('Folder',{}).get('Placemark',[])
        row['waypoint_count']=len(points) if isinstance(points,list) else 0
        row['geometry_available']=bool(raw)
        row['native_editor']='使用 assistant_prepare(kind=route,data={action:update,id:此id,data:{}}) 打开原航线页；不用复制航线 JSON。'
    return value
