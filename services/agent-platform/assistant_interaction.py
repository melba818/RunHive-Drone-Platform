"""Bounded, account-scoped questions for the assistant's step-by-step UI.

This tool only presents choices. It cannot submit or approve a business task.
Resource options are read from the same catalog used by draft validation.
"""
from __future__ import annotations
import math,re,secrets
from typing import Literal
from fastapi import HTTPException
from pydantic import BaseModel,ConfigDict,Field,ValidationError,model_validator

SOURCES=['datasets','dataset_classes','annotation_models','training_architectures','initial_weights','tune_models','tune_datasets','devices','routes','media','images','vision_models','missions','workflow_templates']

class Option(BaseModel):
    model_config=ConfigDict(extra='forbid')
    value:str=Field(min_length=1,max_length=240)
    label:str=Field(min_length=1,max_length=100)
    description:str=Field(default='',max_length=180)

class Question(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id:str=Field(pattern=r'^[a-z][a-z0-9_]{0,47}$')
    title:str=Field(min_length=1,max_length=100)
    hint:str=Field(default='',max_length=240)
    type:Literal['choice','resource','number','text']='choice'
    source:Literal['datasets','dataset_classes','annotation_models','training_architectures','initial_weights','tune_models','tune_datasets','devices','routes','media','images','vision_models','missions','workflow_templates']|None=None
    depends_on:str|None=Field(default=None,pattern=r'^[a-z][a-z0-9_]{0,47}$')
    options:list[Option]=Field(default_factory=list,max_length=40)
    recommended:str|None=Field(default=None,max_length=240)
    required:bool=True
    allow_custom:bool=False
    minimum:float|None=None
    maximum:float|None=None
    integer:bool=False
    max_length:int=Field(default=240,ge=1,le=2000)

    @model_validator(mode='after')
    def coherent(self):
        if self.type=='resource':
            if self.source is None or self.options or self.allow_custom:raise ValueError('Resource choices must use the real catalog')
            if (self.source=='dataset_classes')!=(self.depends_on is not None):raise ValueError('Only dataset classes depend on the dataset question')
        elif self.source or self.depends_on:raise ValueError('Only resource choices have a source')
        if self.type=='choice':
            values=[o.value for o in self.options]
            if not values or len(values)!=len(set(values)):raise ValueError('Choice values must be unique')
            if self.recommended and self.recommended not in values:raise ValueError('Recommended option must exist')
        elif self.options:raise ValueError('Only choices accept options')
        for n in [self.minimum,self.maximum]:
            if n is not None and not math.isfinite(n):raise ValueError('Range must be finite')
        if self.minimum is not None and self.maximum is not None and self.minimum>self.maximum:raise ValueError('Invalid range')
        if self.type=='number' and self.recommended is not None:
            n=float(self.recommended)
            if not math.isfinite(n) or (self.integer and not n.is_integer()) or (self.minimum is not None and n<self.minimum) or (self.maximum is not None and n>self.maximum):raise ValueError('Recommendation exceeds range')
        return self

class ChoiceRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    title:str=Field(min_length=1,max_length=100)
    summary:str=Field(default='',max_length=360)
    goal:Literal['annotation','training','tune','routes','flight','other']='other'
    questions:list[Question]=Field(min_length=1,max_length=8)

    @model_validator(mode='after')
    def ordered(self):
        seen={}
        for q in self.questions:
            if q.id in seen:raise ValueError('Question IDs must be unique')
            if q.depends_on and (q.depends_on not in seen or seen[q.depends_on].source!='datasets'):raise ValueError('Choose a dataset before its classes')
            seen[q.id]=q
        return self

def input_schema():
    # The configured inference adapter requires self-contained tool schemas.
    schema=ChoiceRequest.model_json_schema();definitions=schema.pop('$defs',{})
    def inline(value):
        if isinstance(value,list):return [inline(v) for v in value]
        if not isinstance(value,dict):return value
        if '$ref' in value:
            key=value['$ref'].removeprefix('#/$defs/')
            return inline({**definitions[key],**{k:v for k,v in value.items() if k!='$ref'}})
        return {k:inline(v) for k,v in value.items()}
    return inline(schema)

def validation_error(exc):
    raise HTTPException(422,{'code':'INVALID_INTERACTION','message':'选择步骤的参数无效。','errors':[{'field':'.'.join(map(str,e['loc'])),'message':'请检查此步骤的选项和范围。'} for e in exc.errors()]}) from None

def option(value,label,description=''):
    return {'value':str(value),'label':str(label)[:100],'description':str(description)[:180]}

def catalog_options(source,catalog):
    if source=='datasets':return [option(d['id'],d.get('name') or d['id'],f"图片 {d.get('num_images',0)} · 已标注 {d.get('num_annotations',0)}") for d in catalog.get('datasets',[])]
    if source=='annotation_models':return [option(m['id'],m.get('name') or m['id'],'远程服务' if m.get('remote') else '本地模型') for m in catalog.get('annotation_models',[])]
    if source=='training_architectures':return [option(a['value'],a['label'],a.get('params','')) for a in catalog.get('training_architectures',[])]
    if source=='initial_weights':return [option(w['name'],w['name'],w.get('architecture') or w.get('kind','')) for w in catalog.get('initial_weights',[])]
    if source=='tune_models':return [option(m['path'],m['id'],'支持 CPU' if m.get('cpu') else '需要 GPU') for m in catalog.get('models',[]) if m.get('trainable')]
    if source=='tune_datasets':
        datasets=catalog.get('datasets',{})
        if isinstance(datasets,dict):return [option(name,name) for name in datasets]
        return [option(d['name'],d.get('display_name') or d['name']) for d in datasets if not d.get('archived')]
    return []

async def prepare_choices(service,s,args):
    try:request=ChoiceRequest.model_validate(args)
    except ValidationError as e:validation_error(e)
    await service.bridge.php(s,'catalog')
    catalogs={};questions=[];defaults={};seen_sources={} ;aliases={}
    for q in request.questions:
        if q.type=='resource' and q.source in seen_sources and q.source not in {'images','media','missions'}:
            aliases[q.id]=seen_sources[q.source];continue
        if request.goal in {'training','tune'} and q.type=='number' and q.recommended is not None:
            defaults[q.id]=int(float(q.recommended)) if q.integer else float(q.recommended);continue
        value=q.model_dump(exclude_none=True)
        if q.depends_on:value['depends_on']=aliases.get(q.depends_on,q.depends_on)
        if q.type=='resource':seen_sources[q.source]=q.id
        if q.type=='resource':
            module='tune' if q.source.startswith('tune_') else 'runos'
            if q.source in {'devices','routes','missions'}:
                rows=await service.bridge.php(s,'query',{'resource':'flight_tasks' if q.source=='missions' else q.source,'page':1,'limit':100})
                rows=rows.get('result',rows)
                items=rows.get('list',[]) if isinstance(rows,dict) else rows if isinstance(rows,list) else []
                value['options']=[option(i['id'],i.get('name') or i.get('nickname') or str(i['id'])) for i in items if i.get('id') is not None]
            elif q.source in {'media','images','vision_models','workflow_templates'}:
                from workbench_resources import resource_json
                if q.source=='workflow_templates':
                    from workflow_templates import templates
                    value['options']=[option(t['id'],t['name'],t['description']) for t in templates()]
                elif q.source=='vision_models':
                    items=(await resource_json(service,s,'GET','/catalog'))['vision_models']
                    value['options']=[option(i['id'],i['name'],i['model']) for i in items]
                else:
                    items=(await resource_json(service,s,'GET','?limit=100'))['items']
                    value['options']=[option(i['id'],i['name'],i['kind']) for i in items if i['kind']=='image' or (q.source=='media' and i['kind']=='video')]
            else:
                if module not in catalogs:
                    catalogs[module]=await (service.bridge.runtime(s,'GET','/assistant/catalog') if module=='tune' else service.runos(s,'GET','/api/assistant/catalog'))
                catalog=catalogs[module]
                if q.source=='dataset_classes':
                    value['groups']={d['id']:[option(str(c),str(c)) for c in d.get('classes',[])] for d in catalog.get('datasets',[])}
                    value['options']=[]
                else:value['options']=catalog_options(q.source,catalog)
            if len(value['options'])>300:raise HTTPException(422,'选项数量过多，请缩小资源范围。')
            if q.recommended and q.source!='dataset_classes' and q.recommended not in {o['value'] for o in value['options']}:
                value.pop('recommended',None)
        questions.append(value)
    if not questions:raise HTTPException(422,'请至少提供一个需要用户决定的资源或选项。')
    return {'interaction':{'id':secrets.token_hex(16),'version':1,'title':request.title,'summary':request.summary,'goal':request.goal,'questions':questions,'defaults':defaults,'aliases':aliases,
            'confirmation':'prepare_only'},'instruction':'等待用户逐步选择并确认后再继续。此次工具调用不生成草稿、不提交任务；不要继续输出参数清单或替用户选择。'}
