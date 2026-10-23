"""Factory-side API bridge; all lifecycle writes are authorized by Control."""
from pathlib import Path
from urllib.parse import urlencode
import json,secrets,time
from fastapi import Request
from starlette.responses import JSONResponse,FileResponse
import httpx

def install(application,api,tenant,manager,models,stages,gr):
    prepared={};backups={}
    editable=[e for e in manager.get_elem_list() if type(e).__name__ in {"Textbox","Slider","Number","Dropdown","Checkbox","CheckboxGroup","Radio"}]
    def error(e):
        status=getattr(e,'status',503 if isinstance(e,(OSError,httpx.HTTPError)) else 400)
        message=str(e)
        if not any('\u4e00'<=c<='\u9fff' for c in message):message='资源操作暂未完成，请稍后重试。'
        return JSONResponse({'detail':message},status_code=status,headers={'Cache-Control':'no-store'})
    def check(request):
        if request.headers.get('x-runhive-workspace')!='1':
            from fastapi import HTTPException
            raise HTTPException(403,'资源操作请求无效。')
    @application.post('/api/workspace/action')
    def action(body:dict,request:Request):
        check(request)
        try:
            if body.get('action')=='cancel':
                if set(body)!={'kind','id','action','revision'} or body['kind']!='job':raise ValueError('操作参数无效。')
                # Resolve exactly one owned job before using the existing cancel API.
                api('GET','workspace/detail?'+urlencode({'kind':'job','resource':body['id']}),timeout=15)
                api('POST','jobs/'+body['id']+'/cancel',timeout=45)
                return {'success':True}
            return api('POST','workspace/action',body,timeout=20)
        except (ValueError,OSError,httpx.HTTPError) as e:return error(e)
    @application.get('/api/workspace/detail')
    def detail(kind:str,resource:str):
        try:return api('GET','workspace/detail?'+urlencode({'kind':kind,'resource':resource}),timeout=15)
        except (ValueError,OSError,httpx.HTTPError) as e:return error(e)
    @application.get('/api/workspace/preview')
    def preview(resource:str,page:int=0):
        try:return api('GET','workspace/preview?'+urlencode({'resource':resource,'page':page}),timeout=15)
        except (ValueError,OSError,httpx.HTTPError) as e:return error(e)
    @application.get('/api/workspace/datasets/{resource}')
    def download(resource:str):
        try:
            api('GET','workspace/detail?'+urlencode({'kind':'dataset','resource':resource}),timeout=15)
            info=json.loads((tenant/'data/dataset_info.json').read_text('utf-8'))
            from workspace_store import file_path
            path=file_path(tenant/'data',info[resource]['file_name'])
            return FileResponse(path,filename=path.name,headers={'Cache-Control':'no-store'})
        except (ValueError,KeyError,OSError,httpx.HTTPError) as e:return error(e)
    @application.post('/api/workspace/prepare')
    def prepare(body:dict,request:Request):
        check(request)
        try:
            if set(body)!={'kind','id','action'}:raise ValueError('操作参数无效。')
            action=body['action'];updates={};section='train'
            catalog=api('GET','workspace/catalog',timeout=15)
            if body['kind']=='dataset' and action in {'train','eval'}:
                if body['id'] not in catalog:raise ValueError('数据集不可用，请先取消归档或重新选择。')
                section=action;updates[section+'.dataset']={'choices':list(catalog),'value':[body['id']]}
            elif (body['kind']=='job' and action=='reuse') or (body['kind']=='configuration' and action=='train'):
                if body['kind']=='configuration':
                    draft=api('GET','assistant/drafts/'+body['id'],timeout=15)
                    if draft['status']!='prepared' or draft['data']['operation']!='train':raise ValueError('请选择未提交的训练草稿。')
                    args=draft['data']['args'];section='train'
                else:
                    detail=api('GET','workspace/detail?'+urlencode({'kind':'job','resource':body['id']}),timeout=15)
                    args=detail['args'];groups=api('GET','workspace',timeout=15)['groups']
                    section=next(g['key'] for g in groups if any(i['kind']=='job' and i['id']==body['id'] for i in g['items']))
                model=next((n for n,v in models.items() if v['path']==args.get('model_name_or_path')),None)
                if model is None:raise ValueError('该任务使用的基础模型当前不可用。')
                updates['top.model_name']={'value':model};updates['top.model_path']={'value':models[model]['path']}
                known={manager.get_id_by_elem(elem) for elem in manager.get_elem_list()}
                # Reset real input defaults before applying a stored task. This
                # prevents controls absent from its args inheriting another form.
                defaults={}
                for eid in known:
                    if not eid.startswith(('top.',section+'.')) or eid in {'top.lang','top.model_path',section+'.config_path',section+'.dataset_dir'}:continue
                    elem=manager.get_elem_by_id(eid)
                    if type(elem).__name__ in {'Textbox','Slider','Number','Dropdown','Checkbox','CheckboxGroup','Radio'} and not callable(getattr(elem,'value',None)):
                        defaults[eid]={'value':getattr(elem,'value',None)}
                updates={**defaults,**updates}
                updates['top.platform_draft_id']={'value':draft['id'] if body['kind']=='configuration' else ''}
                updates['top.platform_draft_revision']={'value':draft['revision'] if body['kind']=='configuration' else 0}
                aliases={'stage':'training_stage','per_device_train_batch_size':'batch_size','per_device_eval_batch_size':'batch_size' if section=='eval' else 'per_device_eval_batch_size',
                    'neftune_noise_alpha':'neftune_alpha','pissa_init':'use_pissa'}
                top={'finetuning_type','template','rope_scaling','quantization_bit','quantization_method'}
                for key,value in args.items():
                    eid=('top.' if key in top else section+'.')+aliases.get(key,key)
                    if eid in known and key not in {'output_dir','export_dir','adapter_name_or_path','dataset_dir'}:
                        if key in {'dataset','eval_dataset'}:
                            value=str(value).split(',')
                            if any(v not in catalog for v in value):raise ValueError('关联数据集不可用，请先恢复或重新选择。')
                            updates[eid]={'choices':list(catalog),'value':value};continue
                        if key=='stage':value=next((k for k,v in stages.items() if v==value),value)
                        if key=='quantization_bit':value=str(value)
                        if key in {'image_max_pixels','image_min_pixels','video_max_pixels','video_min_pixels'}:value=str(value)
                        elem=manager.get_elem_by_id(eid)
                        if (type(elem).__name__=='CheckboxGroup' or getattr(elem,'multiselect',False)) and isinstance(value,str):value=value.split(',')
                        updates[eid]={'value':value}
                from runtime_common import ALLOWED_EXTRA
                extra={k:v for k,v in args.items() if k in ALLOWED_EXTRA}
                if section+'.extra_args' in known:updates[section+'.extra_args']={'value':json.dumps(extra,ensure_ascii=False)}
                prefix='/tenant/saves/'+model+'/'+str(args.get('finetuning_type','lora'))+'/'
                checkpoints=[p.removeprefix(prefix) for p in str(args.get('adapter_name_or_path','')).split(',') if p]
                if any('/' in p or p.startswith('.') for p in checkpoints):raise ValueError('该任务检查点需要在页面中重新选择。')
                updates['top.checkpoint_path']={'choices':checkpoints,'value':checkpoints or None}
                key='export_dir' if section=='export' else 'output_dir'
                updates[section+'.'+key]={'value':section+'_'+time.strftime('%Y%m%d_%H%M%S')+'_'+secrets.token_hex(3)}
                if section=='train':updates['train.compute_type']={'value':'pure_bf16' if args.get('pure_bf16') else 'bf16' if args.get('bf16') else 'fp16' if args.get('fp16') else 'fp32'}
            else:raise ValueError('操作参数无效。')
            now=time.time()
            for key in list(prepared):
                if prepared[key][0]<now-120:prepared.pop(key,None)
            if len(prepared)>=16:raise ValueError('配置请求较多，请稍后重试。')
            token=secrets.token_hex(24);prepared[token]=(now,updates)
            return {'token':token,'section':section,'restore_token':'restore:'+token}
        except (ValueError,KeyError,StopIteration,OSError,httpx.HTTPError) as e:return error(e)
    def apply(token,*current):
        token=str(token)
        restoring=token.startswith('restore:')
        value=(backups.pop(token[8:],None) if restoring else prepared.pop(token,None))
        if value is None or value[0]<time.time()-(900 if restoring else 120):raise gr.Error('配置请求已过期，请重新操作。')
        if not restoring:
            backups[token]=(time.time(),{manager.get_id_by_elem(elem):{'value':val} for elem,val in zip(editable,current)})
            for key in list(backups):
                if backups[key][0]<time.time()-900:backups.pop(key,None)
        result={}
        for eid,props in value[1].items():
            try:elem=manager.get_elem_by_id(eid)
            except (KeyError,ValueError):continue
            result[elem]=gr.update(**props)
        return result
    return apply
