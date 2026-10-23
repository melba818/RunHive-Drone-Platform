"""RunOS presentation for official tuning widgets and their original callbacks.

Only layout contexts are rewritten. The factory's control objects, input sets,
event registrations and job adapters remain the source of task behavior.
"""
from __future__ import annotations
import ast,copy,functools,html,inspect,json,math,textwrap
from contextlib import contextmanager
from pathlib import Path
import gradio as gr

_data_root=Path('/tenant/data')
def configure_data_root(tenant):
 global _data_root
 _data_root=(Path(tenant)/'data').resolve()

def heading(title,description=''):
 return gr.HTML('<div class="rh-card-heading"><h2>'+html.escape(title)+'</h2>'+(('<p>'+html.escape(description)+'</p>') if description else '')+'</div>',padding=False)

@contextmanager
def card(title,description=''):
 with gr.Group(elem_classes=['rh-layout-card']):
  heading(title,description)
  yield

def _dataset_path(directory,datasets):
 if directory not in {'data','/tenant/data',str(_data_root)} or not isinstance(datasets,list) or not datasets:
  raise ValueError('请先选择当前账号的数据集。')
 info=json.loads((_data_root/'dataset_info.json').read_text('utf-8'))
 if datasets[0] not in info or 'file_name' not in info[datasets[0]]:raise ValueError('当前数据集暂不支持预览。')
 path=(_data_root/info[datasets[0]]['file_name']).resolve()
 if not path.is_relative_to(_data_root) or not path.exists():raise ValueError('数据集文件暂时不可用。')
 return path

def can_preview(directory,datasets):
 try:_dataset_path(directory,datasets);return gr.Button(interactive=True)
 except (ValueError,OSError,KeyError,TypeError):return gr.Button(interactive=False)

def _records(path):
 files=sorted(p for p in path.iterdir() if p.is_file()) if path.is_dir() else [path]
 records=[];size=0
 for source in files:
  if not source.resolve().is_relative_to(_data_root) or source.suffix not in {'.json','.jsonl'}:continue
  size+=source.stat().st_size
  if size>64*1024**2:raise ValueError('预览数据量较大，请拆分数据集后重试。')
  with source.open(encoding='utf-8') as stream:
   values=json.load(stream) if source.suffix=='.json' else [json.loads(line) for line in stream if line.strip()]
  if not isinstance(values,list):raise ValueError('数据集格式不正确，请使用记录列表。')
  records.extend(values)
 return records

def preview_html(records,page,name):
 total=len(records);pages=max(1,math.ceil(total/2));page=max(0,min(int(page or 0),pages-1))
 parts=['<div class="rh-preview-summary"><strong>'+html.escape(str(name))+'</strong><span>共 '+str(total)+' 条记录 · 第 '+str(page+1)+' / '+str(pages)+' 页</span></div>']
 labels={'instruction':'指令','input':'输入','output':'回答','conversations':'对话','messages':'对话','images':'图片','videos':'视频','audios':'音频','system':'系统提示'}
 for index,record in enumerate(records[page*2:page*2+2],start=page*2+1):
  parts.append('<article class="rh-sample-card"><h3>样本 '+str(index)+'</h3>')
  for key,value in (record.items() if isinstance(record,dict) else [('内容',record)]):
   if value in (None,'',[]):continue
   text=value if isinstance(value,str) else json.dumps(value,ensure_ascii=False,indent=2)
   if key in {'conversations','messages'} and isinstance(value,list):
    roles={'human':'用户','user':'用户','gpt':'助手','assistant':'助手','system':'系统','observation':'工具','tool':'工具'}
    text='\n\n'.join(roles.get(str(item.get('from',item.get('role',''))),'消息')+'：'+(item.get('value',item.get('content','')) if isinstance(item.get('value',item.get('content','')),str) else json.dumps(item.get('value',item.get('content','')),ensure_ascii=False)) for item in value if isinstance(item,dict))
   parts.append('<div class="rh-sample-field"><span>'+html.escape(labels.get(str(key),str(key)))+'</span><pre>'+html.escape(text)+'</pre></div>')
  parts.append('</article>')
 if not total:parts.append('<p class="rh-preview-empty">当前数据集没有可预览的记录。</p>')
 return page,''.join(parts)

def show_preview(directory,datasets,page):
 try:
  records=_records(_dataset_path(directory,datasets));page,content=preview_html(records,page,datasets[0])
  return len(records),page,content,gr.Column(visible=True),gr.Button(interactive=page>0),gr.Button(interactive=(page+1)*2<len(records))
 except (ValueError,OSError,KeyError,TypeError) as error:
  message=str(error) if isinstance(error,ValueError) and any('\u4e00'<=c<='\u9fff' for c in str(error)) else '数据集暂时无法预览，请检查文件格式后重试。'
  gr.Warning(message);return tuple(gr.skip() for _ in range(6))

def create_preview_box(dataset_dir,dataset,scope='train'):
 button=gr.Button('预览数据集',interactive=False,scale=0,min_width=128,elem_classes=['rh-preview-open'])
 with gr.Column(visible=False,elem_id='rh-preview-'+scope,elem_classes=['modal-box','rh-preview-dialog']) as box:
  heading('数据集预览','按页查看样本内容，确认数据格式与训练目标。')
  with gr.Row(visible=False):
   count=gr.Number(value=0,interactive=False,precision=0,visible=False)
   page=gr.Number(value=0,interactive=False,precision=0,visible=False)
  samples=gr.HTML(padding=False,elem_classes=['rh-preview-samples'])
  with gr.Row(elem_classes=['rh-dialog-actions']):
   prev=gr.Button('上一页',elem_classes=['rh-preview-prev'])
   next_=gr.Button('下一页',elem_classes=['rh-preview-next'])
   close=gr.Button('关闭',elem_classes=['rh-preview-close'])
 inputs=[dataset_dir,dataset,page];outputs=[count,page,samples,box,prev,next_]
 dataset.change(can_preview,[dataset_dir,dataset],[button],queue=False).then(lambda:0,outputs=[page],queue=False)
 button.click(show_preview,inputs,outputs,queue=False)
 prev.click(lambda p:max(0,int(p)-1),[page],[page],queue=False).then(show_preview,inputs,outputs,queue=False)
 next_.click(lambda p,n:min(max(0,math.ceil(n/2)-1),int(p)+1),[page,count],[page],queue=False).then(show_preview,inputs,outputs,queue=False)
 close.click(lambda:gr.Column(visible=False),outputs=[box],queue=False)
 return dict(data_preview_btn=button,preview_count=count,page_index=page,prev_btn=prev,next_btn=next_,close_btn=close,preview_samples=samples)

def _call(name,*args,**kwargs):
 return ast.Call(ast.Name(name,ast.Load()),[ast.Constant(a) for a in args],[ast.keyword(k,ast.Constant(v)) for k,v in kwargs.items()])
def _context(name,args,body,**kwargs):
 return ast.With([ast.withitem(_call(name,*args,**kwargs),None)],body)
def _gr_context(name,args,body,**kwargs):
 call=_call('unused',*args,**kwargs);call.func=ast.Attribute(ast.Name('gr',ast.Load()),name,ast.Load())
 return ast.With([ast.withitem(call,None)],body)
def _kind(node,name):
 return isinstance(node,ast.With) and any(isinstance(i.context_expr,ast.Call) and isinstance(i.context_expr.func,ast.Attribute) and isinstance(i.context_expr.func.value,ast.Name) and i.context_expr.func.value.id=='gr' and i.context_expr.func.attr==name for i in node.items)
def _has(node,name):
 return any(isinstance(n,ast.Name) and isinstance(n.ctx,ast.Store) and n.id==name for n in ast.walk(node))
def _wrap(node,title,description=''):
 return _context('_rh_card',[title,description],[node])

class _Rows(ast.NodeTransformer):
 def __init__(self,scope):self.scope=scope
 def visit_With(self,node):
  if self.scope=='chatbox' and _kind(node,'Column'):
   if any(isinstance(n,ast.Assign) and _has(n,'max_new_tokens') for n in node.body):
    clear=next(n for n in node.body if _has(n,'clear_btn'));node.body=[_gr_context('Accordion',['生成设置'],[n for n in node.body if n is not clear],open=False,elem_classes='rh-advanced'),clear]
   elif any(isinstance(n,ast.Assign) and _has(n,'role') for n in node.body):node.body=[_gr_context('Accordion',['对话提示设置'],node.body,open=False,elem_classes='rh-advanced')]
  self.generic_visit(node)
  if self.scope=='chatbox' and _kind(node,'Tab'):
   for item in node.items:
    call=item.context_expr
    if call.args and isinstance(call.args[0],ast.Constant) and call.args[0].value in {'Video','Audio'}:call.keywords.append(ast.keyword('visible',ast.Constant(False)))
  if _kind(node,'Row'):
   count=sum(_kind(n,'Column') or (isinstance(n,(ast.Assign,ast.AnnAssign)) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and isinstance(n.value.func.value,ast.Name) and n.value.func.value.id=='gr' and n.value.func.attr not in {'Markdown','HTML','State','Plot'}) for n in node.body)
   columns=max(1,min(3,count));classes=['rh-fields-grid','rh-grid-'+str(columns)]
   if _has(node,'dataset'):classes=['rh-dataset-row']
   if _has(node,'start_btn') or _has(node,'load_btn'):classes=['rh-actionbar']
   if self.scope=='chatbox' and _has(node,'query'):classes=['rh-chat-input']
   for item in node.items:
    if getattr(item.context_expr.func,'attr','')=='Row' and not any(k.arg=='elem_classes' for k in item.context_expr.keywords):item.context_expr.keywords.append(ast.keyword('elem_classes',ast.List([ast.Constant(c) for c in classes],ast.Load())))
  return node
 def visit_Call(self,node):
  self.generic_visit(node)
  if isinstance(node.func,ast.Name) and node.func.id=='create_preview_box':node.keywords.append(ast.keyword('scope',ast.Constant(self.scope)))
  if self.scope=='chatbox' and isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name) and node.func.value.id=='gr' and node.func.attr=='Chatbot':
   node.keywords.append(ast.keyword('label',ast.Constant('对话记录')))
   node.keywords.append(ast.keyword('placeholder',ast.Constant('输入消息后，模型回复将显示在这里。')))
  return node

def _layout(function,scope):
 tree=ast.parse(textwrap.dedent(inspect.getsource(function)));definition=next(n for n in tree.body if isinstance(n,ast.FunctionDef));definition.decorator_list=[]
 if scope=='top':
  rows=[n for n in definition.body if _kind(n,'Row')];assert len(rows)==3 and _has(rows[0],'lang') and _has(rows[-1],'booster')
  rows[0].body.extend(rows[1].body);definition.body.remove(rows[1])
  rows[0].items[0].context_expr.keywords.append(ast.keyword('elem_classes',ast.List([ast.Constant('rh-fields-grid'),ast.Constant('rh-grid-3'),ast.Constant('rh-model-row')],ast.Load())))
  definition.body.insert(0,ast.Expr(_call('_rh_heading','基础模型','选择基础模型、微调方式与检查点。')))
  definition.body=[_gr_context('Accordion',['模型高级设置'],[n],open=False,elem_classes='rh-advanced') if n is rows[-1] else n for n in definition.body]
 elif scope=='train':
  accordions=[i for i,n in enumerate(definition.body) if _kind(n,'Accordion')];assert len(accordions)>=7
  first,last=accordions[0],accordions[-1];definition.body[first:last+1]=[_gr_context('Accordion',['高级配置'],definition.body[first:last+1],open=False,elem_classes='rh-advanced')]
  action=next(n for n in definition.body if _kind(n,'Row') and _has(n,'start_btn'))
  result=next(n for n in definition.body if _kind(n,'Row') and _has(n,'loss_viewer'))
  columns=[n for n in result.body if _kind(n,'Column')];assert len(columns)==2
  main_rows=[n for n in columns[0].body if _kind(n,'Row')];assert len(main_rows)==4
  setup=_context('_rh_card',['保存与输出','设置输出目录；参数配置可保存后再次使用。'],[main_rows[0],_gr_context('Accordion',['分布式训练设置'],[main_rows[1]],open=False,elem_classes='rh-advanced')])
  status=_context('_rh_card',['运行状态','查看任务进度、运行结果与训练曲线。'],[main_rows[2],main_rows[3],columns[1]])
  new=[]
  for n in definition.body:
   if n is action:new.append(setup);new.append(n)
   elif n is result:new.append(status)
   elif _kind(n,'Row') and _has(n,'training_stage'):new.append(_wrap(n,'训练数据','选择训练阶段与数据集，可先预览样本内容。'))
   elif _kind(n,'Row') and _has(n,'learning_rate'):new.append(_wrap(n,'训练参数','设置学习率、训练轮数与样本数量。'))
   elif _kind(n,'Row') and _has(n,'cutoff_len'):new.append(_wrap(n,'批次与验证','调整序列长度、批次大小及验证集比例。'))
   else:new.append(n)
  definition.body=new
 elif scope=='eval':
  cards={'dataset_dir':('评估数据','选择数据集并检查样本内容。'),'cutoff_len':('评估参数','设置输入长度、样本数量与处理批次。'),'max_new_tokens':('生成与输出','设置生成参数及评估结果的保存位置。'),'output_box':('运行结果','查看评估进度与结果。')}
  definition.body=[next((_wrap(n,*value) for key,value in cards.items() if _kind(n,'Row') and _has(n,key)),n) for n in definition.body]
 elif scope=='infer':
  settings=next(n for n in definition.body if _kind(n,'Row') and _has(n,'infer_backend'));actions=next(n for n in definition.body if _kind(n,'Row') and _has(n,'load_btn'));info=next(n for n in definition.body if isinstance(n,ast.Assign) and _has(n,'info_box'))
  definition.body=[_context('_rh_card',['模型连接','选择上方模型后连接，即可开始对话测试。'],[actions,info,_gr_context('Accordion',['连接高级选项'],[settings],open=False,elem_classes='rh-advanced')]) if n is settings else _context('_rh_card',['对话测试','连接模型后输入消息，支持文本与图片。'],[n]) if isinstance(n,ast.Assign) and _has(n,'chat_elems') else n for n in definition.body if n not in [actions,info]]
 elif scope=='export':
  definition.body=[_wrap(n,'导出设置','配置模型分片大小、导出设备与文件格式。') if _kind(n,'Row') and _has(n,'export_size') else _wrap(n,'保存位置','导出成果保存在当前账号的独立空间。') if _kind(n,'Row') and _has(n,'export_dir') else _context('_rh_card',['导出状态','查看导出任务的执行结果。'],[n]) if _has(n,'info_box') and isinstance(n,ast.Assign) else n for n in definition.body]
 tree=_Rows(scope).visit(tree);ast.fix_missing_locations(tree)
 namespace=dict(function.__globals__);namespace.update(_rh_card=card,_rh_heading=heading,create_preview_box=create_preview_box)
 if scope=='infer':namespace['create_chat_box']=_layout(function.__globals__['create_chat_box'],'chatbox')
 exec(compile(tree,'<Runhive '+scope+' layout>','exec'),namespace)
 return namespace[definition.name]

def set_props(element,**values):
 for key,value in values.items():setattr(element,key,value)
 if hasattr(element,'constructor_args'):element.constructor_args.update(values)

def layout_factory(function,scope):
 rendered=_layout(function,scope)
 @functools.wraps(function)
 def build(*args,**kwargs):
  elements=rendered(*args,**kwargs)
  hidden={'top':{'lang','model_path','hub_name'},'train':{'dataset_dir','preview_count','page_index'},'eval':{'dataset_dir','preview_count','page_index'},'infer':{'tools','video','audio'},'export':{'export_quantization_dataset','export_hub_model_id'}}.get(scope,set())
  for name,element in elements.items():
   classes=list(element.elem_classes or []);classes.append('rh-control-'+scope+'-'+name.replace('_','-'))
   if type(element).__name__=='Accordion':classes.append('rh-advanced')
   props={'elem_id':'rh-control-'+scope+'-'+name.replace('_','-'),'elem_classes':classes}
   if name in hidden:props['visible']=False
   if name in {'progress_bar','output_box','loss_viewer','preview_samples'}:classes.append('rh-full-width')
   set_props(element,**props)
  return elements
 return build
