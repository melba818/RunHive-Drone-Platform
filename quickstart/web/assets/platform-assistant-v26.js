import { W as BackendApi, u as useAdminInfo } from '/assets/index-D5rXB33a.js'
import { ChoiceFlow, optionsFor, displayText, conciseText, TranscriptGate } from '/assets/assistant-flow-v26.js?v=steps3'

const BASE='/llm-center/agent/platform',NATIVE='/llm-center/agent/ui/api',VERSION='25'
const host=document.createElement('runhive-platform-assistant'),root=host.attachShadow({mode:'open'})
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/assets/platform-assistant-v26.css?v=steps3';root.append(sheet)
const el=(tag,props={},text='')=>{const n=document.createElement(tag);Object.assign(n,props);if(text)n.textContent=text;return n}
const state={account:null,identity:'',csrf:'',ready:false,opening:false,expanded:false,sid:'',running:false,unread:0,stream:null,messages:[],partial:null,files:[],drafts:new Map(),choices:new Map(),gate:new TranscriptGate(),model:null,bootstrap:null,jobTimer:null,workbench:null,context:null}
const bubble=el('button',{className:'bubble',title:'打开平台助手；可拖动调整位置',ariaLabel:'打开平台助手'})
const pet=el('span',{className:'pet-sprite',ariaHidden:'true'}),petCaption=el('span',{className:'pet-caption'},'平台助手');bubble.append(pet,petCaption)
const windowEl=el('section',{className:'window',hidden:true,ariaLabel:'平台助手'}),head=el('header',{className:'head'}),brand=el('span',{className:'brand'},'✦ 平台助手')
const max=el('button',{title:'最大化',ariaLabel:'最大化'},'□'),min=el('button',{title:'收起',ariaLabel:'收起'},'−')
head.append(brand,max,min);const context=el('div',{className:'context'}),toolbar=el('div',{className:'toolbar'}),models=el('select',{ariaLabel:'选择助手模型'})
const newChat=el('button',{},'新对话'),historyButton=el('button',{},'历史'),tasksButton=el('button',{},'任务'),reconnect=el('button',{title:'重新连接助手'},'↻')
toolbar.append(models,newChat,historyButton,tasksButton,reconnect)
const body=el('main',{className:'body'}),status=el('div',{className:'status',role:'status'}),composer=el('div',{className:'composer'})
const attachments=el('div',{className:'attachments'}),input=el('textarea',{placeholder:'描述要处理的任务，Enter 发送',ariaLabel:'平台助手输入'}),inputActions=el('div',{className:'input-actions'})
const fileInput=el('input',{type:'file',multiple:true,hidden:true}),attach=el('button',{title:'添加图片或文件',ariaLabel:'添加图片或文件'},'+'),hint=el('span',{className:'hint'},'Shift+Enter 换行'),send=el('button',{className:'primary'},'发送'),stop=el('button',{hidden:true},'停止')
inputActions.append(attach,hint,stop,send);composer.append(attachments,input,inputActions,fileInput)
windowEl.append(head,context,toolbar,body,status,composer);root.append(bubble,windowEl);document.body.append(host)
let maximized=false,normalSize=null,activePanel=null,lastAuthCheck=0
function notice(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
function key(name){return `runhive-assistant-v${VERSION}:${state.account?.id||0}:${name}`}
function pageContext(){return state.workbench?.context||{path:location.pathname+location.hash.split('?')[0],title:(document.querySelector('main h1,main h2,.llm-center h1')?.textContent||document.title).trim().slice(0,120)}}
function place(saved){
  const w=state.expanded?windowEl.offsetWidth:104,h=state.expanded?windowEl.offsetHeight:128
  const x=Math.max(8,Math.min(saved?.x??innerWidth-w-20,innerWidth-w-8)),y=Math.max(8,Math.min(saved?.y??(innerHeight-h)/2,innerHeight-h-8))
  host.style.left=x+'px';host.style.top=y+'px';host.style.right='auto';host.style.bottom='auto'
}
function positionKey(){return key('position-v26-'+(state.expanded?'window':'pet'))}
function persistPosition(){const r=host.getBoundingClientRect();localStorage.setItem(positionKey(),JSON.stringify({x:r.x,y:r.y,width:windowEl.offsetWidth,height:windowEl.offsetHeight}))}
function restorePosition(){let p;try{p=JSON.parse(localStorage.getItem(positionKey())||'null')}catch{};if(p&&state.expanded){windowEl.style.width=Math.min(p.width||420,innerWidth-24)+'px';windowEl.style.height=Math.min(p.height||600,innerHeight-24)+'px'}place(p)}
function expanded(value){if(state.expanded&&!value)persistPosition();state.expanded=value;windowEl.hidden=!value;bubble.hidden=value;restorePosition();if(value){state.unread=0;input.focus();if(!state.ready)void connect().catch(e=>notice(e.message,true))}renderBadge()}
function renderBadge(){const pending=[...state.choices.values()].some(v=>!v.flow.confirmed);bubble.dataset.state=state.running?'running':pending?'review':state.unread?'waving':'idle';petCaption.textContent=state.running?'处理中':pending?'等待选择':state.unread?`新消息 ${state.unread}`:'平台助手';bubble.setAttribute('aria-label','打开平台助手，'+petCaption.textContent)}
function drag(target){let origin;target.addEventListener('pointerdown',e=>{if(e.target.closest('button')&&target!==bubble)return;if(e.button!==0)return;origin={x:e.clientX,y:e.clientY,left:host.offsetLeft,top:host.offsetTop,moved:false};target.setPointerCapture(e.pointerId)});target.addEventListener('pointermove',e=>{if(!origin)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y;if(Math.abs(dx)+Math.abs(dy)>4)origin.moved=true;if(origin.moved)place({x:origin.left+dx,y:origin.top+dy})});target.addEventListener('pointerup',e=>{if(!origin)return;const moved=origin.moved;origin=null;persistPosition();if(target===bubble&&!moved)expanded(true)});target.addEventListener('pointercancel',()=>origin=null)}
drag(head);drag(bubble);min.onclick=()=>expanded(false);max.onclick=()=>{maximized=!maximized;if(maximized){normalSize={w:windowEl.style.width,h:windowEl.style.height};windowEl.style.width=Math.min(innerWidth-32,860)+'px';windowEl.style.height=(innerHeight-32)+'px';place({x:16,y:16})}else{windowEl.style.width=normalSize?.w||'420px';windowEl.style.height=normalSize?.h||'600px';place()}max.title=maximized?'还原':'最大化'}
bubble.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();expanded(true)}}
new ResizeObserver(()=>{if(state.expanded){place({x:host.offsetLeft,y:host.offsetTop});persistPosition()}}).observe(windowEl)
addEventListener('resize',()=>restorePosition());addEventListener('hashchange',()=>{context.textContent='当前页面：'+pageContext().title})

async function request(url,method='GET',data,extra={}){
  const identity=state.identity,r=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(url.startsWith(BASE)&&method!=='GET'?{'X-Platform-CSRF':state.csrf}:{}),...extra},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(100000)})
  const value=r.status===204?{}:await r.json().catch(()=>({message:'服务返回内容无效。'}))
  if(identity!==state.identity)throw Error('登录状态已更新。')
  if(!r.ok){const message=typeof value.detail==='string'?value.detail:value.message||value.detail?.message||'请求未完成，请稍后重试。';throw Error(/[\u3400-\u9fff]/u.test(message)?message:'助手请求未完成，请检查模型连接或稍后重试。')}
  return value
}
async function connect(){
  if(state.connectPromise)return state.connectPromise
  const task=connectNow();state.connectPromise=task
  try{return await task}finally{if(state.connectPromise===task)state.connectPromise=null}
}
async function connectNow(){
  const identity=state.identity
  state.opening=true;notice('正在连接平台助手…')
  try{
    let session=await fetch(BASE+'/session',{credentials:'same-origin',cache:'no-store'}).then(async r=>r.ok?r.json():null)
    if(identity!==state.identity)throw Error('登录状态已更新。')
    if(!session||session.tenant_id!==Number(state.account.id)){
      const launch=await new BackendApi('/admin/Llmcenter/').postData('launch',{module:'agent'})
      if(Number(launch.data?.admin_id)!==Number(state.account.id))throw Error('账号登录信息无效。')
      await request('/llm-center/agent/auth/exchange','POST',{ticket:launch.data.ticket})
      session=await request(BASE+'/session')
    }
    state.csrf=session.csrf;state.bootstrap=await request(BASE+'/assistant/bootstrap','POST',{})
    const me=await request(NATIVE+'/me');state.uploadLimits=me.uploadLimits||{}
    models.replaceChildren()
    for(const model of state.bootstrap.models){const option=el('option',{value:JSON.stringify({provider:model.provider,modelId:model.modelId})},model.displayName||model.name||model.modelId);models.append(option)}
    if(state.bootstrap.default_model){const d=state.bootstrap.default_model,v=JSON.stringify({provider:d.provider,modelId:d.modelId});if([...models.options].some(o=>o.value===v))models.value=v}
    if(!models.value&&models.options.length)models.selectedIndex=0
    state.ready=true;state.sid=localStorage.getItem(key('session'))||''
    if(state.sid&&!state.bootstrap.history.sessions?.some(s=>s.sessionId===state.sid))state.sid=''
    if(state.sid)await loadSession(state.sid);else renderEmpty()
    context.textContent='当前页面：'+pageContext().title;notice('已连接 · 参数核对后确认执行')
    void refreshDrafts();clearInterval(state.jobTimer);state.jobTimer=setInterval(()=>{if(state.ready)void refreshDrafts()},12000)
  }finally{state.opening=false}
}
function renderEmpty(){body.replaceChildren();const welcome=el('div',{className:'empty'});welcome.append(el('strong',{},'选择要处理的任务'),el('p',{},'逐步选择资源和参数，核对后确认执行。'));const suggestions=el('div',{className:'suggestions'});for(const [label,text] of [['自动标注','帮我准备自动标注，请分步让我选择数据集、模型和目标类别。'],['准备训练','帮我准备应用训练，请分步让我选择数据集、架构、权重和参数。'],['大模型微调','帮我准备微调，请分步让我选择模型、数据集和训练参数。'],['设备与航线','查看设备状态与飞行任务']]){const b=el('button',{},label);b.onclick=()=>void submit({text});suggestions.append(b)}welcome.append(suggestions);body.append(welcome)}
function renderMessage(n,text,role){n.replaceChildren();const value=displayText(text,role);if(!value){n.remove();return}const {brief,detail}=role==='assistant'?conciseText(value):{brief:value,detail:''};n.append(el('div',{},brief));if(detail){const d=el('details',{className:'message-detail'});d.append(el('summary',{},'查看详情'),el('div',{},detail));n.append(d)}}
function addMessage(role,text){const n=el('div',{className:'message '+(role==='user'?'user':'assistant')});body.append(n);if(text)renderMessage(n,text,role);body.scrollTop=body.scrollHeight;return n}
function unwrap(output){try{const v=JSON.parse(output);if(v.content?.[0]?.text)return JSON.parse(v.content[0].text);return v}catch{return null}}
function choiceKey(id){return key('choice:'+state.sid+':'+id)}
function addChoice(interaction){
  if(!/^[a-f0-9]{32}$/.test(interaction?.id)||!Array.isArray(interaction.questions)||!interaction.questions.length||interaction.questions.length>8)return
  if(state.choices.has(interaction.id))return
  let saved={};try{saved=JSON.parse(localStorage.getItem(choiceKey(interaction.id))||'{}')}catch{}
  const c=el('section',{className:'card choice-card',ariaLabel:interaction.title}),flow=new ChoiceFlow(interaction,saved)
  const entry={flow,element:c,context:saved.context||state.context||pageContext(),sid:state.sid};state.choices.set(interaction.id,entry);body.append(c)
  const persist=()=>localStorage.setItem(choiceKey(interaction.id),JSON.stringify({...flow.snapshot(),context:entry.context}))
  const draw=()=>{
    c.replaceChildren();c.append(el('strong',{},interaction.title))
    if(flow.confirmed){const d=el('details');d.append(el('summary',{},flow.cancelled?'已取消选择':'已确认选择'),el('p',{},flow.summary().map(a=>a.title+'：'+a.label).join('；')));c.append(d);const change=el('button',{},flow.cancelled?'重新选择':'修改选择');change.onclick=()=>{flow.confirmed=false;flow.cancelled=false;flow.step=0;persist();draw();renderBadge()};c.append(change);return}
    const total=flow.questions.length,progress=el('div',{className:'choice-progress'},flow.step<total?`第 ${flow.step+1} / ${total} 步`:'最后一步 · 核对选择')
    c.append(progress);const track=el('div',{className:'step-track',ariaHidden:'true'});for(let i=0;i<=total;i++)track.append(el('span',{className:i<=flow.step?'done':''}));c.append(track)
    if(interaction.summary)c.append(el('p',{},interaction.summary))
    const err=el('p',{className:'choice-error',role:'alert'}),controls=el('div',{className:'choice-controls'})
    if(flow.step<total){
      const q=flow.questions[flow.step],fieldset=el('fieldset'),legend=el('legend',{},q.title);fieldset.append(legend);if(q.hint)fieldset.append(el('p',{},q.hint))
      const save=value=>{flow.set(q.id,value);err.textContent='';persist()}
      if(q.type==='choice'){
        for(const o of optionsFor(q,flow.answers)){
          const label=el('label',{className:'choice-option'}),radio=el('input',{type:'radio',name:interaction.id+'-'+q.id,value:o.value,checked:flow.answers[q.id]===o.value}),copy=el('span')
          const heading=el('span',{className:'option-title'},o.label);if(q.recommended===o.value)heading.append(el('small',{className:'recommended'},'推荐'))
          copy.append(heading);if(o.description)copy.append(el('span',{className:'option-desc'},o.description));label.append(radio,copy);radio.onchange=()=>save(o.value);fieldset.append(label)
        }
        if(q.allow_custom){const custom=el('input',{type:'text',placeholder:'也可以手动填写',ariaLabel:q.title+'，手动填写',maxLength:q.max_length||240,value:optionsFor(q,flow.answers).some(o=>o.value===flow.answers[q.id])?'':flow.answers[q.id]||''});custom.oninput=()=>{save(custom.value);fieldset.querySelectorAll('input[type=radio]').forEach(n=>n.checked=false)};fieldset.append(custom)}
      }else if(q.type==='resource'){
        const select=el('select',{ariaLabel:q.title}),options=optionsFor(q,flow.answers);select.append(el('option',{value:''},options.length?'请选择':'暂无可用选项'))
        for(const o of options)select.append(el('option',{value:o.value},o.label+(o.value===q.recommended?'（推荐）':'')))
        select.value=flow.answers[q.id]||'';select.onchange=()=>{save(select.value);details.textContent=options.find(o=>o.value===select.value)?.description||''}
        const details=el('p',{className:'option-desc'},options.find(o=>o.value===select.value)?.description||'');fieldset.append(select,details)
        if(!options.length)fieldset.append(el('p',{},q.source==='dataset_classes'?'所选数据集没有可选类别，请返回选择其他数据集或先完善类别。':'请先在对应业务页面添加资源，再重新发起选择。'))
      }else{
        const field=el(q.type==='text'&&q.max_length>240?'textarea':'input',{ariaLabel:q.title,value:flow.answers[q.id]??''});if(q.type==='number'){field.type='number';field.step=q.integer?'1':'any';if(q.minimum!=null)field.min=q.minimum;if(q.maximum!=null)field.max=q.maximum}else field.maxLength=q.max_length||240
        field.oninput=()=>save(field.value);fieldset.append(field)
        if(q.recommended!=null){const recommended=el('button',{className:'recommend-button'},'使用建议值：'+q.recommended);recommended.onclick=()=>{field.value=q.recommended;save(q.recommended)};fieldset.append(recommended)}
      }
      c.append(fieldset)
      const next=el('button',{className:'primary'},flow.step===total-1?'核对选择':'下一步');next.onclick=()=>{const problem=flow.next();if(problem)err.textContent=problem;else{persist();draw()}};controls.append(next)
    }else{
      const list=el('div',{className:'choice-review'})
      for(const [i,a] of flow.summary().entries()){const row=el('div'),copy=el('span');copy.append(el('small',{},a.title),el('span',{},a.label));const edit=el('button',{ariaLabel:'修改'+a.title},'修改');edit.onclick=()=>{flow.step=i;persist();draw()};row.append(copy,edit);list.append(row)}
      const note=el('textarea',{ariaLabel:'补充要求',placeholder:'补充要求（可选）',value:flow.note,maxLength:1000});note.oninput=()=>{flow.note=note.value;persist()};list.append(note);c.append(list,el('p',{className:'confirmation-note'},'确认后准备参数草稿。开始标注、训练或飞行前，还需在业务页面核对并确认执行。'))
      const confirm=el('button',{className:'primary choice-confirm',disabled:state.running},'确认选择并继续');confirm.onclick=async()=>{
        const problem=flow.error();if(problem){err.textContent=problem;return}
        if(entry.sid!==state.sid){err.textContent='会话已切换，请重新打开此会话。';return}
        if(state.running){err.textContent='助手仍在处理，请稍候再确认。';return}
        confirm.disabled=true
        if(await submit({text:flow.reply(),frozen:entry.context,preserveInput:true})){flow.confirmed=true;persist();draw();renderBadge()}else confirm.disabled=false
      };controls.append(confirm)
    }
    const back=el('button',{disabled:flow.step===0},'上一步');back.onclick=()=>{flow.back();persist();draw()};controls.prepend(back)
    const cancel=el('button',{className:'text-button'},'取消');cancel.onclick=()=>{flow.confirmed=true;flow.cancelled=true;persist();draw();renderBadge()};controls.append(cancel)
    c.append(err,controls);renderBadge()
  }
  draw();body.scrollTop=body.scrollHeight
}
function refreshChoiceButtons(){root.querySelectorAll('.choice-confirm').forEach(b=>b.disabled=state.running)}
function acceptMessage(message,live=false){
  const p=message.payload;if(!p||message.origin?.length)return
  if(!state.gate.accept(p)){if(p.type==='text'&&state.partial){state.partial.remove();state.partial=null}return}
  if(p.type==='partial_text'){
    if(p.event_type==='start'||!state.partial)state.partial=addMessage('assistant','')
    if(p.event_type==='delta'){state.partial.dataset.full=(state.partial.dataset.full||'')+(p.text||'');state.partial.textContent=displayText(state.partial.dataset.full).slice(0,360)}
    body.scrollTop=body.scrollHeight;return
  }
  if(p.type==='text'){
    if(p.role==='user'&&p.text?.includes('\n\n[页面上下文，仅供定位]\n')){try{const frozen=JSON.parse(p.text.split('\n\n[页面上下文，仅供定位]\n')[1]);if(typeof frozen.title==='string'&&typeof frozen.path==='string')state.context={...frozen,title:frozen.title.slice(0,120)}}catch{}}
    if(p.role==='user'&&p.text?.includes('[已确认的分步选择]')){try{const selected=JSON.parse(p.text.split('[已确认的分步选择]\n')[1].split('\n')[0]),entry=state.choices.get(selected.interaction_id);if(entry){entry.flow.answers=selected.answers;entry.flow.confirmed=true;entry.element.replaceChildren(el('strong',{},entry.flow.interaction.title),el('p',{},'已确认选择。'));localStorage.setItem(choiceKey(selected.interaction_id),JSON.stringify({...entry.flow.snapshot(),context:entry.context}))}}catch{}}
    if(p.role==='assistant'&&state.partial){renderMessage(state.partial,p.text,p.role);state.partial=null}
    else if(['user','assistant'].includes(p.role))addMessage(p.role,p.text)
    if(live&&!state.expanded&&p.role==='assistant'){state.unread++;renderBadge()}
  }
  if(p.type==='image_url'&&p.image_url?.startsWith('data:image/')){const n=el('div',{className:'message user'});n.append(el('img',{src:p.image_url,alt:'附加图片'}));body.append(n)}
  if(p.type==='tool_call'&&live){notice('正在处理：'+(({'mcp__platform__assistant_catalog':'读取业务目录','mcp__platform__assistant_prepare':'校验参数草稿','mcp__platform__platform_query':'查询平台资源'})[p.name]||'调用平台工具'))}
  if(p.type==='tool_call_output'){
    const value=unwrap(p.output)
    if(value?.interaction)addChoice(value.interaction)
    if(value?.draft&&value.open_action)addDraft(value.draft,value.open_action)
    if(value?.confirmation_url){const c=el('div',{className:'card'});c.append(el('strong',{},'飞行任务待确认'),el('p',{},'核对设备、航线与执行时间后下发。'));const b=el('button',{},'打开确认页面');b.onclick=()=>{const u=new URL(value.confirmation_url,location.origin);if(u.origin===location.origin&&/^\/llm-center\/agent\/platform\/requests\/[a-f0-9]{48}$/.test(u.pathname))window.open(u.href,'_blank','noopener')};c.append(b);body.append(c)}
  }
  if(p.type==='request_end'&&p.stop_reason&&p.stop_reason!=='completed')notice(p.stop_reason==='retryable'?'模型请求未完成，正在重试。':'模型请求未完成，请检查连接或调整参数。',true)
}
async function loadSession(id){
  state.stream?.close();state.sid=id;localStorage.setItem(key('session'),id);body.replaceChildren();state.partial=null;state.choices.clear();state.gate=new TranscriptGate()
  const snapshot=await request(NATIVE+'/sessions/'+encodeURIComponent(id))
  state.running=['running','compacting'].includes(snapshot.session?.status);stop.hidden=!state.running;send.disabled=state.running;models.disabled=state.running;renderBadge()
  const result=await request(NATIVE+'/sessions/'+encodeURIComponent(id)+'/messages?tailLimit=120')
  for(const message of result.messages||[])acceptMessage(message)
  if(snapshot.session?.status==='compacting')state.gate.compacting=true
  for(const message of result.live?.fragments||[])acceptMessage(message)
  const stream=new EventSource(NATIVE+'/sessions/'+encodeURIComponent(id)+'/stream');state.stream=stream
  stream.onmessage=e=>{try{acceptMessage(JSON.parse(e.data),true)}catch{}}
  stream.addEventListener('server_event',e=>{try{const v=JSON.parse(e.data);if(v.type==='task_state'){state.running=v.state==='running'||v.state==='compacting';state.gate.compacting=v.state==='compacting';stop.hidden=!state.running;send.disabled=state.running;models.disabled=state.running;refreshChoiceButtons();renderBadge();notice(state.running?v.state==='compacting'?'正在整理上下文…':'任务运行中…':'已就绪');if(!state.running)void refreshDrafts()}else if(v.type==='approval_request'){notice('该工具需要在 Agent 中心确认后继续。',true)}}catch{}})
  stream.onerror=()=>notice('连接中断，正在恢复…')
}
async function submit(override={}){
  if(!(override.text??input.value).trim()&&!state.files.length)return false;if(state.running||send.disabled)return false
  const text=(override.text??input.value).trim(),frozen=override.frozen||pageContext();send.disabled=true;notice('正在提交…')
  try{
    if(!state.ready)await connect()
    if(!state.sid){const model=JSON.parse(models.value);const r=await request(NATIVE+`/projects/${state.bootstrap.project}/agents/${state.bootstrap.profile}/sessions`,'POST',{...model,approvalMode:'read-only'});await loadSession(r.session.sessionId)}
    const parts=[{type:'text',text:(text||'请检查所附资料。')+'\n\n[页面上下文，仅供定位]\n'+JSON.stringify(frozen)},...(override.preserveInput?[]:state.files.map(f=>f.part))]
    await request(NATIVE+'/sessions/'+state.sid+'/tasks','POST',{input:parts})
    if(!override.preserveInput){input.value='';state.files=[];renderAttachments()}state.context=frozen;context.textContent='任务目标：'+frozen.title;state.running=true;stop.hidden=false;renderBadge();return true
  }catch(e){notice(e.message,true);send.disabled=false;return false}
}
send.onclick=()=>void submit();input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void submit()}}
stop.onclick=async()=>{try{await request(NATIVE+'/sessions/'+state.sid+'/abort','POST',{});notice('已请求停止。')}catch(e){notice(e.message,true)}}
newChat.onclick=()=>{state.stream?.close();state.sid='';state.running=false;state.partial=null;state.choices.clear();state.gate=new TranscriptGate();localStorage.removeItem(key('session'));renderEmpty();send.disabled=false;stop.hidden=true;models.disabled=false;renderBadge()}
models.onchange=async()=>{if(!state.sid)return;try{await request(NATIVE+'/sessions/'+state.sid+'/switch-model','POST',JSON.parse(models.value));notice('模型已切换。')}catch(e){notice(e.message,true)}}
reconnect.onclick=()=>{state.ready=false;state.stream?.close();void connect().catch(e=>notice(e.message,true))}
attach.onclick=()=>fileInput.click()
fileInput.onchange=async()=>{
  try{
    if(!state.ready)await connect()
    for(const f of Array.from(fileInput.files||[])){
      const image=f.type.startsWith('image/'),max=(image?state.uploadLimits.imageMaxMb:state.uploadLimits.attachmentMaxMb)||10
      if(f.size>max*1024*1024)throw Error(`文件“${f.name}”超过 ${max} MB 上限。`)
      if(state.files.length>=10)throw Error('每次最多添加 10 个附件。')
      const dataUrl=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)})
      state.files.push({name:f.name,part:image?{type:'image_url',imageUrl:dataUrl}:{type:'file',fileName:f.name,dataUrl}})
    }
    renderAttachments()
  }catch(e){notice(e.message,true)}finally{fileInput.value=''}
}
function renderAttachments(){attachments.replaceChildren();state.files.forEach((f,i)=>{const b=el('button',{title:'移除 '+f.name},f.name+' ×');b.onclick=()=>{state.files.splice(i,1);renderAttachments()};attachments.append(b)})}
function panel(title){activePanel?.remove();activePanel=el('section',{className:'panel'});const b=el('button',{className:'back'},'← 返回');b.onclick=()=>{activePanel.remove();activePanel=null};activePanel.append(b,el('h3',{},title));windowEl.append(activePanel);return activePanel}
historyButton.onclick=async()=>{const p=panel('助手会话');try{const result=await request(NATIVE+`/projects/${state.bootstrap.project}/agents/${state.bootstrap.profile}/sessions`);for(const s of result.sessions||[]){const b=el('button',{className:'history-item'},s.title||'新对话');b.onclick=()=>{p.remove();activePanel=null;void loadSession(s.sessionId)};p.append(b)}}catch(e){p.append(el('p',{},e.message))}}
const taskStatus=value=>({prepared:'待确认',submitted:'已提交',running:'运行中',starting:'启动中',pending:'等待中',done:'已完成',completed:'已完成',succeeded:'已完成',failed:'失败',cancelled:'已取消',paused:'已暂停',pausing:'暂停中',uncertain:'待核查'})[value]||'待核查'
function addDraft(draft,action,render=true){
  if(!/^[a-f0-9]{32}$/.test(draft.id))return
  state.drafts.set(draft.id,{...draft,action})
  let c=body.querySelector(`[data-draft="${draft.id}"]`)
  if(!c&&!render)return
  if(!c){c=el('div',{className:'card'});c.dataset.draft=draft.id;body.append(c)}
  c.replaceChildren();c.append(el('strong',{},({annotation:'标注参数草稿',training:'训练参数草稿',tune:'微调参数草稿',route:'航线参数草稿'})[draft.kind]||'业务参数草稿'))
  c.append(el('p',{},draft.data?.dataset_id?`数据集：${draft.data.dataset_id}`:draft.data?.args?.dataset?`数据集：${draft.data.args.dataset}`:'参数已校验，核对后执行。'))
  if(draft.job)c.append(el('p',{},`${taskStatus(draft.job.status)} · 进度 ${draft.job.processed??draft.job.progress??0}${draft.job.total?'/'+draft.job.total:''}`))
  const actions=el('div',{className:'actions'}),open=el('button',{},draft.status==='prepared'?'打开参数表单':'查看任务')
  open.onclick=()=>void openDraft(draft.id);actions.append(open)
  if(draft.offer_training){const b=el('button',{className:'primary'},'选择下一步');b.onclick=()=>{expanded(true);addChoice({id:draft.id,version:1,title:'标注已完成',source_draft:draft.id,summary:'请选择下一步。训练使用正式标注，待复核结果需先确认。',goal:'training',questions:[{id:'next_action',title:'如何处理标注结果？',type:'choice',required:true,max_length:240,recommended:'train',options:[{value:'train',label:'准备训练',description:'下一步选择架构、权重和训练参数。'},{value:'review',label:'先复核标注',description:'检查标注结果后再决定是否训练。'},{value:'later',label:'暂不训练',description:'保留结果，稍后处理。'}]}]})};actions.append(b)}
  c.append(actions)
}
async function refreshDrafts(){
  if(!state.ready||state.refreshing)return
  state.refreshing=true
  try{
  const identity=state.identity
  const results=await Promise.allSettled([request(BASE+'/assistant/drafts'),request(BASE+'/prepared')])
  if(identity!==state.identity)return
  if(results.every(r=>r.status==='fulfilled')){const ids=new Set(results.flatMap(r=>(r.value.drafts||[]).map(d=>d.id)));for(const id of state.drafts.keys())if(!ids.has(id)){state.drafts.delete(id);body.querySelector(`[data-draft="${id}"]`)?.remove()}}
  for(const result of results)if(result.status==='fulfilled')for(const d of result.value.drafts||[]){
    const v=d.status==='submitted'&&['annotation','training'].includes(d.kind)?await request(BASE+'/assistant/drafts/'+d.id).catch(()=>d):d
    const prior=state.drafts.get(d.id);addDraft(v,{type:['annotation','training'].includes(d.kind)?'runos_draft':'platform_draft',id:d.id},!!(v.offer_training&&!prior?.offer_training))
    if(v.offer_training&&!prior?.offer_training&&!state.expanded){state.unread++;renderBadge()}
  }
  }finally{state.refreshing=false}
}
tasksButton.onclick=async()=>{const p=panel('业务草稿与任务');await refreshDrafts();for(const d of state.drafts.values()){const b=el('button',{className:'history-item'},`${({annotation:'标注',training:'训练',tune:'微调',route:'航线'})[d.kind]} · ${d.data?.dataset_id||d.data?.data?.name||d.data?.args?.dataset||d.id.slice(0,8)} · ${taskStatus(d.job?.status||d.status)}`);b.onclick=()=>{p.remove();activePanel=null;void openDraft(d.id)};p.append(b)}if(!state.drafts.size)p.append(el('p',{},'暂无参数草稿。'))}
function createWorkbench(title,contextValue){
  state.workbench?.element.remove();const w=el('section',{className:'workbench',role:'dialog',ariaLabel:title}),h=el('header'),close=el('button',{},'关闭');h.append(el('strong',{},title),close);w.append(h);root.append(w);state.workbench={element:w,context:contextValue};close.onclick=()=>{w.remove();state.workbench=null};return w
}
async function openDraft(id){
  const draft=state.drafts.get(id);if(!draft)return
  try{
    if(['annotation','training'].includes(draft.kind)){
      const launch=await new BackendApi('/admin/Appcenter/').postData('launchRunos',{})
      const data=launch.data;if(Number(data.admin_id)!==Number(state.account.id)||typeof data.ticket!=='string')throw Error('应用登录信息无效。')
      const u=new URL(data.launch_url,location.origin)
      if(!['http:','https:'].includes(u.protocol)||u.hostname!==location.hostname||!['14000','4000'].includes(u.port))throw Error('应用启动地址无效。')
      u.pathname=draft.kind==='training'?'/training':'/annotate';u.search=new URLSearchParams({assistant_draft:id}).toString();u.hash=new URLSearchParams({ticket:data.ticket,admin_id:String(data.admin_id)}).toString()
      const w=createWorkbench(draft.kind==='training'?'应用训练 · 参数核对':'应用标注 · 参数核对',{path:u.pathname,title:draft.kind==='training'?'应用训练':'应用标注',dataset_id:draft.data.dataset_id,draft_id:id})
      w.append(el('iframe',{src:u.href,title:'业务参数表单',allow:'clipboard-write'}));notice('已打开参数表单，核对后确认执行。');expanded(false);return
    }
    const latest=await request(BASE+'/prepared/'+id),p=panel(latest.kind==='tune'?'微调参数核对':'航线参数核对'),text=el('textarea',{ariaLabel:'全部业务参数',value:JSON.stringify(latest.data,null,2)})
    p.append(el('p',{},'参数可编辑，保存时由服务器校验；确认后按当前参数提交。'),text)
    const execute=el('button',{className:'primary',disabled:latest.status!=='prepared'},'确认并执行'),message=el('p',{role:'status'})
    let current=latest
    const save=async()=>{current=await request(BASE+'/prepared/'+id,'PUT',{revision:current.revision,data:JSON.parse(text.value)});state.drafts.set(id,current);text.value=JSON.stringify(current.data,null,2);return current}
    execute.onclick=async()=>{execute.disabled=true;try{await save();current=await request(BASE+'/prepared/'+id+'/execute','POST',{revision:current.revision});message.textContent='已提交，请查看业务任务。';void refreshDrafts()}catch(e){message.textContent=e.message;execute.disabled=false}}
    p.append(execute,message)
    if(latest.kind==='tune'){const native=el('button',{},'打开微调表单');native.onclick=async()=>{try{await save();await openTuneForm(current)}catch(e){message.textContent=e.message}};p.append(native)}
  }catch(e){notice(e.message,true)}
}
async function openTuneForm(draft){
  const launch=await new BackendApi('/admin/Llmcenter/').postData('launch',{module:'tune',section:'train'}),d=launch.data
  if(d.admin_id!==Number(state.account.id)||d.module!=='tune')throw Error('微调工作区验证失败。')
  const u=new URL(d.launch_url,location.origin);if(u.origin!==location.origin||u.pathname!=='/llm-center/tune/')throw Error('微调启动地址无效。')
  u.hash=new URLSearchParams({ticket:d.ticket,admin_id:String(d.admin_id),module:'tune',section:'train'}).toString()
  const w=createWorkbench('大模型微调 · 参数核对',{path:'/tune/train',title:'大模型微调',draft_id:draft.id}),frame=el('iframe',{src:u.href,title:'大模型微调参数表单'})
  w.append(el('div',{className:'notice'},'助手参数将载入原微调表单。可修改后点击“开始任务”；该按钮即执行确认。'),frame)
  const listener=async e=>{
    if(e.source!==frame.contentWindow||e.origin!==location.origin||Number(e.data?.admin_id)!==Number(state.account.id)||e.data?.type!=='llm-section-ready'||e.data?.section!=='train')return
    removeEventListener('message',listener)
    try{const result=await request('/llm-center/tune/ui/api/workspace/prepare','POST',{kind:'configuration',action:'train',id:draft.id},{'X-Runhive-Workspace':'1'});frame.contentWindow.postMessage({source:'runhive-llm-shell',type:'llm-resource-apply',module:'tune',admin_id:Number(state.account.id),token:result.token},location.origin);const restore=el('button',{},'恢复回填前的表单');restore.onclick=()=>frame.contentWindow.postMessage({source:'runhive-llm-shell',type:'llm-resource-apply',module:'tune',admin_id:Number(state.account.id),token:result.restore_token},location.origin);w.querySelector('header').append(restore)}catch(err){notice(err.message,true)}
  }
  addEventListener('message',listener);setTimeout(()=>removeEventListener('message',listener),45000);expanded(false)
}
function resetAccount(){state.stream?.close();clearInterval(state.jobTimer);state.ready=false;state.sid='';state.csrf='';state.bootstrap=null;state.running=false;state.unread=0;state.drafts.clear();state.choices.clear();state.gate=new TranscriptGate();state.files=[];state.workbench?.element.remove();state.workbench=null;activePanel?.remove();activePanel=null;body.replaceChildren();input.value='';renderAttachments();expanded(false)}
setInterval(()=>{
  try{const account=useAdminInfo(),identity=`${account.id||0}:${account.token||''}`;state.account=account
    if(identity!==state.identity){resetAccount();state.identity=identity;host.hidden=!account.id||!account.token;restorePosition();if(account.id&&account.token&&localStorage.getItem(key('session')))void connect().catch(()=>{})}
  }catch{host.hidden=true}
},700)
host.hidden=true;place()
