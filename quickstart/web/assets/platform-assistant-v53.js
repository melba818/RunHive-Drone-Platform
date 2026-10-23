import {assistantBounds,orderedActions,routeChoiceAllowed,taskFromRouteIntent} from '/assets/assistant-guide-v52.js'
import { W as BackendApi, d as createAxios, u as useAdminInfo, r as appRouter } from '/assets/index-D5rXB33a.js'
import { ChoiceFlow, optionsFor, displayText, conciseText, TranscriptGate } from '/assets/assistant-flow-v29.js?v=original1'
import {normalizeInteraction,interactionKey,carryAnswers} from '/assets/choice-normalize-v46.js'

import {routeIntent,createRouteChoice,seedFromChoice} from '/assets/route-intent-v36.js'
import {routeResources} from '/assets/route-resources-v36.js'
import {selectedRouteId as originalSelectedRouteId,canOpenRouteDirectly as originalCanOpenRouteDirectly} from '/assets/route-choice-target-v36.js'
const BASE='/llm-center/agent/platform',NATIVE='/llm-center/agent/ui/api',VERSION='25'
const host=document.createElement('runhive-platform-assistant'),root=host.attachShadow({mode:'open'});host.dataset.docked='true'
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/assets/platform-assistant-v29.css?v=original1';root.append(sheet);const routeSheet=document.createElement('link');routeSheet.rel='stylesheet';routeSheet.href='/assets/assistant-route-guide-v44.css';root.append(routeSheet);const guideSheet=document.createElement('link');guideSheet.rel='stylesheet';guideSheet.href='/assets/assistant-v53.css';root.append(guideSheet)
const el=(tag,props={},text='')=>{const n=document.createElement(tag);Object.assign(n,props);if(text)n.textContent=text;return n}
const state={account:null,identity:'',csrf:'',ready:false,opening:false,expanded:false,sid:'',running:false,unread:0,stream:null,messages:[],partial:null,files:[],drafts:new Map(),choices:new Map(),gate:new TranscriptGate(),model:null,bootstrap:null,jobTimer:null,workbench:null,context:null,nativeConnections:new Map(),nativeFlow:null,nativeContext:null,seenDraftIds:new Set(),workbenchActions:[]}
const bubble=el('button',{className:'bubble',title:'打开 Copilot 助手；可上下拖动位置',ariaLabel:'打开 Copilot 助手'})
const pet=el('span',{className:'copilot-mark',ariaHidden:'true'}),petCaption=el('span',{className:'copilot-caption'},'Copilot 助手');pet.innerHTML='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 6.8 9.2 6.1v7L16 26l-9.2-6.1v-7L16 6.8Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="m16 11.2 1.35 3.45L20.8 16l-3.45 1.35L16 20.8l-1.35-3.45L11.2 16l3.45-1.35L16 11.2Z" fill="currentColor"/><path d="m23.8 5.5.55 1.65L26 7.7l-1.65.55-.55 1.65-.55-1.65-1.65-.55 1.65-.55.55-1.65Z" fill="currentColor"/><circle cx="8.2" cy="23.4" r="1.15" fill="currentColor"/></svg>';bubble.append(pet,petCaption)
const windowEl=el('section',{className:'window',hidden:true,ariaLabel:'Copilot 助手'}),head=el('header',{className:'head'}),brand=el('span',{className:'brand'},'Copilot 助手')
const max=el('button',{title:'最大化',ariaLabel:'最大化'},'□'),min=el('button',{title:'收起',ariaLabel:'收起'},'−')
head.append(brand,max,min);const context=el('div',{className:'context'}),toolbar=el('div',{className:'toolbar'}),models=el('select',{ariaLabel:'选择助手模型'})
const newChat=el('button',{},'新对话'),historyButton=el('button',{},'历史'),tasksButton=el('button',{},'任务'),reconnect=el('button',{title:'重新连接助手'},'↻')
toolbar.append(models,newChat,historyButton,tasksButton,reconnect)
const body=el('main',{className:'body'}),status=el('div',{className:'status',role:'status'}),composer=el('div',{className:'composer'})
const attachments=el('div',{className:'attachments'}),input=el('textarea',{placeholder:'告诉 Copilot 要完成什么，Enter 发送',ariaLabel:'Copilot 助手输入'}),inputActions=el('div',{className:'input-actions'})
const fileInput=el('input',{type:'file',multiple:true,hidden:true}),attach=el('button',{title:'添加图片或文件',ariaLabel:'添加图片或文件'},'+'),hint=el('span',{className:'hint'},'Shift+Enter 换行'),send=el('button',{className:'primary'},'发送'),stop=el('button',{hidden:true},'停止')
inputActions.append(attach,hint,stop,send);composer.append(attachments,input,inputActions,fileInput)
windowEl.append(head,context,toolbar,body,status,composer);root.append(bubble,windowEl);document.body.append(host)
let maximized=false,normalSize=null,activePanel=null,lastAuthCheck=0
function notice(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
function key(name){return `runhive-assistant-v${VERSION}:${state.account?.id||0}:${name}`}
function pageContext(){if(state.routeModeActive)return {path:location.pathname+location.hash.split('?')[0],title:'航线规划',stage:state.routeWorkflow?.stage||'resources'};return state.workbench?.context||(activeApplicationFrame()&&state.nativeContext)||{path:location.pathname+location.hash.split('?')[0],title:(document.querySelector('main h1,main h2,.llm-center h1')?.textContent||document.title).trim().slice(0,120)}}
function place(saved){
  const w=state.expanded?windowEl.offsetWidth:bubble.offsetWidth||168,h=state.expanded?windowEl.offsetHeight:bubble.offsetHeight||54
  const x=state.expanded?Math.max(8,Math.min(saved?.x??innerWidth-w-20,innerWidth-w-8)):Math.max(0,innerWidth-w)
  const y=Math.max(8,Math.min(saved?.y??((innerHeight-h)/2+(state.expanded?0:48)),innerHeight-h-8))
  host.style.left=x+'px';host.style.top=y+'px';host.style.right='auto';host.style.bottom='auto'
}
function positionKey(){return key('position-'+(state.expanded?'v26-window':'v53-copilot-dock'))}
function persistPosition(){const r=host.getBoundingClientRect();localStorage.setItem(positionKey(),JSON.stringify({x:r.x,y:r.y,width:windowEl.offsetWidth,height:windowEl.offsetHeight}))}
function restorePosition(){let p;try{p=JSON.parse(localStorage.getItem(positionKey())||'null')}catch{};if(state.expanded&&!maximized){const bounds=assistantBounds({width:innerWidth,height:innerHeight},p||{});windowEl.style.width=bounds.width+'px';windowEl.style.height=bounds.height+'px';place(bounds)}else place(p)}
function expanded(value){if(state.expanded&&!value)persistPosition();state.expanded=value;host.dataset.docked=String(!value);windowEl.hidden=!value;bubble.hidden=value;restorePosition();if(value){state.unread=0;input.focus();if(!state.ready)void connect().catch(e=>notice(e.message,true))}renderBadge()}
function renderBadge(){const pending=[...state.choices.values()].some(v=>!v.flow.confirmed);bubble.dataset.state=state.running?'running':pending?'review':state.unread?'waving':'idle';petCaption.textContent=state.running?'Copilot · 处理中':pending?'Copilot · 待选择':state.unread?`Copilot · 新消息 ${state.unread}`:'Copilot 助手';bubble.setAttribute('aria-label','打开 Copilot 助手，'+petCaption.textContent)}
function drag(target){let origin;target.addEventListener('pointerdown',e=>{if(e.target.closest('button')&&target!==bubble)return;if(e.button!==0)return;origin={x:e.clientX,y:e.clientY,left:host.offsetLeft,top:host.offsetTop,moved:false};if(target===bubble)bubble.dataset.dragging='true';target.setPointerCapture(e.pointerId)});target.addEventListener('pointermove',e=>{if(!origin)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y;if(Math.abs(dx)+Math.abs(dy)>4)origin.moved=true;if(origin.moved)place({x:origin.left+dx,y:origin.top+dy})});target.addEventListener('pointerup',e=>{if(!origin)return;const moved=origin.moved;origin=null;delete bubble.dataset.dragging;persistPosition();if(target===bubble&&!moved)expanded(true)});target.addEventListener('pointercancel',()=>{origin=null;delete bubble.dataset.dragging})}
drag(head);drag(bubble);min.onclick=()=>expanded(false);max.onclick=()=>{maximized=!maximized;if(maximized){normalSize={w:windowEl.style.width,h:windowEl.style.height};windowEl.style.width=Math.min(innerWidth-32,860)+'px';windowEl.style.height=(innerHeight-32)+'px';place({x:16,y:16})}else{windowEl.style.width=normalSize?.w||'420px';windowEl.style.height=normalSize?.h||'600px';restorePosition()}max.title=maximized?'还原':'最大化'}
bubble.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();expanded(true)}}
new ResizeObserver(()=>{if(state.expanded){place({x:host.offsetLeft,y:host.offsetTop});persistPosition()}}).observe(windowEl)
addEventListener('resize',()=>restorePosition());addEventListener('hashchange',()=>{context.textContent='当前页面：'+pageContext().title})

async function request(url,method='GET',data,extra={}){
  const identity=state.identity
  if(url.startsWith(BASE)&&method!=='GET'){
    const r=await fetch(BASE+'/session',{credentials:'same-origin',cache:'no-store'}),session=await r.json()
    if(identity!==state.identity||!r.ok||session.tenant_id!==Number(state.account?.id))throw Error('助手登录已更新，请重新连接。')
    state.csrf=session.csrf
  }
  const r=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(url.startsWith(BASE)&&method!=='GET'?{'X-Platform-CSRF':state.csrf}:{}),...extra},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(100000)})
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
  state.opening=true;notice('正在连接 Copilot 助手…')
  try{
    let session=await fetch(BASE+'/session',{credentials:'same-origin',cache:'no-store'}).then(async r=>r.ok?r.json():null)
    if(identity!==state.identity)throw Error('登录状态已更新。')
    if(!session||session.tenant_id!==Number(state.account.id)){
      const launch=await createAxios({url:'/admin/Llmcenter/launch',method:'post',data:{module:'agent'}},{showSuccessMessage:false,cancelDuplicateRequest:false})
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
function renderEmpty(){body.replaceChildren();const welcome=el('div',{className:'empty'});welcome.append(el('strong',{},'选择要处理的任务'),el('p',{},'逐步选择资源和参数，核对后确认执行。'));const suggestions=el('div',{className:'suggestions'});for(const [label,text] of [['自动标注','帮我准备自动标注，请分步让我选择数据集、模型和目标类别。'],['准备训练','帮我准备应用训练，请分步让我选择数据集、架构、权重和参数。'],['大模型微调','帮我准备微调，请分步让我选择模型、数据集和训练参数。'],['创建道路巡检航线','我要创建道路巡检航线'],['创建河流巡检航线','我要创建河流巡检航线'],['设备与航线','查看设备状态与飞行任务']]){const b=el('button',{},label);b.onclick=()=>void submit({text});suggestions.append(b)}welcome.append(suggestions);body.append(welcome)}
function renderMessage(n,text,role){n.replaceChildren();const value=displayText(text,role);if(!value){n.remove();return}const {brief,detail}=role==='assistant'?conciseText(value):{brief:value,detail:''};n.append(el('div',{},brief));if(detail){const d=el('details',{className:'message-detail'});d.append(el('summary',{},'查看详情'),el('div',{},detail));n.append(d)}}
function addMessage(role,text){const n=el('div',{className:'message '+(role==='user'?'user':'assistant')});body.append(n);if(text)renderMessage(n,text,role);body.scrollTop=body.scrollHeight;return n}
function unwrap(output){try{const v=JSON.parse(output);if(v.content?.[0]?.text)return JSON.parse(v.content[0].text);return v}catch{return null}}
function choiceKey(id){return key('choice:'+state.sid+':'+id)}
function addChoice(interaction){
  if(!/^[a-f0-9]{32}$/.test(interaction?.id)||!Array.isArray(interaction.questions)||!interaction.questions.length||interaction.questions.length>8)return
  if(state.choices.has(interaction.id))return
  interaction=normalizeInteraction(interaction)
  const active=[...state.choices.values()].filter(v=>!v.flow.confirmed)
  const previous=active.find(v=>interactionKey(v.flow.interaction)===interactionKey(interaction))
  for(const prior of active){prior.element.remove();state.choices.delete(prior.flow.interaction.id);if(state.pendingResource?.entry===prior)state.pendingResource=null;if(state.pendingMap?.entry===prior)state.pendingMap=null}
  let saved=previous?carryAnswers(previous.flow,interaction):{};try{const stored=JSON.parse(localStorage.getItem(choiceKey(interaction.id))||'null');if(stored)saved=stored}catch{}
  const c=el('section',{className:'card choice-card',ariaLabel:interaction.title}),flow=new ChoiceFlow(interaction,saved)
  const entry={flow,element:c,context:saved.context||state.context||pageContext(),sid:state.sid};state.choices.set(interaction.id,entry);body.append(c)
  const persist=()=>localStorage.setItem(choiceKey(interaction.id),JSON.stringify({...flow.snapshot(),context:entry.context}))
  const draw=()=>{
    syncWorkbenchActions();c.replaceChildren();c.append(el('strong',{},interaction.title))
    if(flow.confirmed){const d=el('details');d.append(el('summary',{},flow.cancelled?'已取消选择':'已确认选择'),el('p',{},flow.summary().map(a=>a.title+'：'+a.label).join('；')));c.append(d);const change=el('button',{},flow.cancelled?'重新选择':'修改选择');change.onclick=()=>{for(const other of state.choices.values())if(other!==entry&&!other.flow.confirmed){other.element.remove();state.choices.delete(other.flow.interaction.id)}state.pendingMap=null;state.pendingResource=null;flow.confirmed=false;flow.cancelled=false;flow.step=0;persist();draw();renderBadge()};d.append(change);const route_id=selectedRouteId(flow,state.lastRouteId);if(route_id)addRouteOpenButton(c,entry,route_id);return}
    const total=flow.questions.length,progress=el('div',{className:'choice-progress'},flow.step<total?`第 ${flow.step+1} / ${total} 步`:'最后一步 · 核对选择')
    c.append(progress);const track=el('div',{className:'step-track',ariaHidden:'true'});for(let i=0;i<=total;i++)track.append(el('span',{className:i<=flow.step?'done':''}));c.append(track)
    if(flow.step===total&&interaction.defaults&&Object.keys(interaction.defaults).length)c.append(el('p',{},'其余参数已使用建议值，可在业务页面的高级设置中调整。'))
    const err=el('p',{className:'choice-error',role:'alert'}),controls=el('div',{className:'choice-controls'})
    if(flow.step<total){
      const q=flow.questions[flow.step],fieldset=el('fieldset'),legend=el('legend',{},q.title);fieldset.append(legend)
      const save=value=>{flow.set(q.id,value);err.textContent='';persist()}
      if(q.type==='map_point'){
        const point=flow.answers[q.id],hint=el('p',{},point?'已在地图确认位置，可重新选择。':'在地图上点击位置，再确认使用。'),pick=el('button',{},point?'重新在地图选择':'打开地图选点')
        pick.onclick=async()=>{try{state.pendingMap={entry,question:q.id,identity:state.identity};const rq=flow.questions.find(v=>v.source==='routes'),route_id=rq?flow.answers[rq.id]:state.lastRouteId;await navigateOwnedPage('route',{view:'pick-location',interaction_id:interaction.id,...(route_id?{route_id}: {})})}catch(error){err.textContent=error.message}}
        fieldset.append(hint,pick)
      }else if(q.type==='choice'){
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
        const typed=el('input',{type:'text',ariaLabel:'输入'+q.title+'名称',placeholder:'也可输入名称或 ID 查找',maxLength:240})
        typed.oninput=()=>{const matches=options.filter(o=>o.label===typed.value.trim()||o.value===typed.value.trim());if(matches.length===1){select.value=matches[0].value;save(matches[0].value);details.textContent=matches[0].description||''}else if(typed.value.trim()){select.value='';save('');details.textContent=matches.length?'名称重复，请在列表中选择。':'请输入已有资源名称；新数据请先导入。'}}
        const extra=el('details');extra.append(el('summary',{},'搜索或刷新选项'),typed)
        const resourceActions=el('div',{className:'choice-controls'})
        if(['datasets','tune_datasets','dataset_classes'].includes(q.source)){
          const add=el('button',{},q.source==='dataset_classes'?'添加类别':'导入／填写数据集')
          add.onclick=async()=>{try{state.pendingResource={entry,source:q.source,question:q.id};if(q.source==='tune_datasets')await navigateOwnedPage('tune',{view:'data'});else await navigateApplicationResource(q.source==='dataset_classes'?'classes':'datasets',q.source==='dataset_classes'?flow.answers[q.depends_on]:undefined)}catch(error){err.textContent=error.message}}
          if(q.source==='dataset_classes'&&!flow.answers[q.depends_on])add.disabled=true
          resourceActions.append(add)
        }
        const refresh=el('button',{},'刷新选项');refresh.onclick=async()=>{refresh.disabled=true;try{await refreshChoiceResources(entry);draw()}catch(error){err.textContent=error.message}finally{refresh.disabled=false}}
        extra.append(refresh);fieldset.append(resourceActions,extra)
        if(!options.length)fieldset.append(el('p',{},q.source==='dataset_classes'?'所选数据集暂无类别，可添加类别后继续。':'暂无可用数据，可导入后继续当前选择。'))
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
      const directRoute=canOpenRouteDirectly(flow,state.lastRouteId),confirm=el('button',{className:'primary choice-confirm',disabled:state.running&&!directRoute},directRoute?'确认并打开航线编辑':'确认选择并继续');confirm.dataset.routeDirect=String(directRoute);confirm.onclick=async()=>{
        const problem=flow.error();if(problem){err.textContent=problem;return}
        if(entry.sid!==state.sid){err.textContent='会话已切换，请重新打开此会话。';return}
        if(state.running&&!canOpenRouteDirectly(flow,state.lastRouteId)){err.textContent='助手仍在处理，请稍候再确认。';return}
        confirm.disabled=true
        const selectedRoute=flow.questions.find(q=>q.source==='routes');if(selectedRoute&&routeChoiceAllowed(flow,entry.context))state.lastRouteId=flow.answers[selectedRoute.id]
        if(createRouteChoice(flow)){try{await openRouteWorkflow(seedFromChoice(flow));flow.confirmed=true;persist();draw()}catch(error){err.textContent=error.message;confirm.disabled=false}return}
        if(canOpenRouteDirectly(flow,state.lastRouteId)){try{await openSelectedRoute(entry,selectedRouteId(flow,state.lastRouteId));flow.confirmed=true;persist();draw();renderBadge()}catch(error){err.textContent=error.message;confirm.disabled=false}return}
        if(await submit({text:flow.reply(),frozen:entry.context,preserveInput:true})){flow.confirmed=true;persist();draw();renderBadge()}else confirm.disabled=false
      };controls.append(confirm)
    }
    const back=el('button',{disabled:flow.step===0},'上一步');back.onclick=()=>{flow.back();persist();draw()};controls.prepend(back)
    const cancel=el('button',{className:'text-button'},'取消');cancel.onclick=()=>{flow.confirmed=true;flow.cancelled=true;persist();draw();renderBadge()};controls.append(cancel)
    c.append(err,controls);renderBadge()
  }
  entry.draw=draw;entry.persist=persist;draw();body.scrollTop=body.scrollHeight
}
async function refreshChoiceResources(entry){
  if(entry.sid!==state.sid)throw Error('会话已切换，请重新打开此会话。')
  for(const q of entry.flow.questions.filter(q=>q.type==='resource')){const data=await request(BASE+'/assistant/choice-options/'+q.source);q.options=data.options||[];if(q.source==='dataset_classes')q.groups=data.groups||{}}
  for(const q of entry.flow.questions){const value=entry.flow.answers[q.id];if(q.type==='resource'&&value!=null&&!optionsFor(q,entry.flow.answers).some(o=>o.value===String(value)))entry.flow.set(q.id,'')}
  entry.persist();entry.draw()
}
async function returnToChoices(){
  const pending=state.pendingResource;if(!pending)return
  expanded(true);try{await refreshChoiceResources(pending.entry);pending.entry.element.scrollIntoView({block:'nearest'});notice('资源已刷新，请继续当前选择。')}catch(e){notice(e.message,true)}
}
function refreshChoiceButtons(){syncWorkbenchActions();root.querySelectorAll('.choice-confirm').forEach(b=>b.disabled=state.running&&b.dataset.routeDirect!=='true')}
function acceptMessage(message,live=false){
  const p=message.payload;if(!p||message.origin?.length)return
  if(!state.gate.accept(p)){if(p.type==='text'&&state.partial){state.partial.remove();state.partial=null}return}
  if(p.type==='partial_text'){
    if([...state.choices.values()].some(v=>!v.flow.confirmed))return
    if(p.event_type==='start'||!state.partial)state.partial=addMessage('assistant','')
    if(p.event_type==='delta'){state.partial.dataset.full=(state.partial.dataset.full||'')+(p.text||'');state.partial.textContent=displayText(state.partial.dataset.full).slice(0,360)}
    body.scrollTop=body.scrollHeight;return
  }
  if(p.type==='text'){
    if(p.role==='user'&&!p.text?.includes('[已确认的分步选择]')){state.workbenchActions=[];body.querySelector('.workbench-results')?.remove()}

    if(p.role==='user'&&p.text?.includes('\n\n[页面上下文，仅供定位]\n')){try{const frozen=JSON.parse(p.text.split('\n\n[页面上下文，仅供定位]\n')[1]);if(typeof frozen.title==='string'&&typeof frozen.path==='string')state.context={...frozen,title:frozen.title.slice(0,120)}}catch{}}
    if(p.role==='user'&&p.text?.includes('[已确认的分步选择]')){try{const selected=JSON.parse(p.text.split('[已确认的分步选择]\n')[1].split('\n')[0]),entry=state.choices.get(selected.interaction_id);if(selected.goal==='routes'){const route_id=entry?selectedRouteId({...entry.flow,answers:selected.answers,questions:entry.flow.questions},state.lastRouteId):['route_id','airline_id','route'].map(k=>selected.answers?.[k]).find(v=>/^\d+$/.test(String(v||'')));if(route_id)state.lastRouteId=String(route_id)}if(entry){entry.flow.answers=selected.answers;entry.flow.confirmed=true;const route_id=selectedRouteId(entry.flow,state.lastRouteId);if(route_id)state.lastRouteId=route_id;entry.persist();entry.draw()}}catch{}}
    if(p.role==='assistant'&&/\[reached max turns \(\d+\); stopping\]/i.test(p.text||'')){state.partial?.remove();state.partial=null;addMessage('assistant',state.lastRouteId?'助手达到运行轮次上限，请点击“打开航线编辑”继续。':'助手达到运行轮次上限，请重新选择任务。');if(state.lastRouteId&&!body.querySelector('.route-open-button')){const card=el('div',{className:'card route-recovery'});body.append(card);addRouteOpenButton(card,{sid:state.sid},state.lastRouteId)}return}
    if(p.role==='assistant'&&[...state.choices.values()].some(v=>!v.flow.confirmed)){state.partial?.remove();state.partial=null;return}
    if(p.role==='assistant'&&state.partial){renderMessage(state.partial,p.text,p.role);state.partial=null}
    else if(['user','assistant'].includes(p.role))addMessage(p.role,p.text)
    if(live&&!state.expanded&&p.role==='assistant'){state.unread++;renderBadge()}
  }
  if(p.type==='image_url'&&p.image_url?.startsWith('data:image/')){const n=el('div',{className:'message user'});n.append(el('img',{src:p.image_url,alt:'附加图片'}));body.append(n)}
  if(p.type==='tool_call'&&live){notice('正在处理：'+(({'mcp__platform__assistant_catalog':'读取业务目录','mcp__platform__assistant_prepare':'校验参数草稿','mcp__platform__platform_query':'查询平台资源'})[p.name]||'调用平台工具'))}
  if(p.type==='tool_call_output'){
    const value=unwrap(p.output)
    if(value?.open_action?.type==='route_workflow'){const action=value.open_action;const key=JSON.stringify(action);if(live&&state.routeActionKey!==key){state.routeActionKey=key;void openRouteWorkflow(action.intent,action.route_id).catch(err=>notice(err.message,true))}else if(!live){const card=el('div',{className:'card route-recovery'}),open=el('button',{className:'primary'},'继续航线引导');open.onclick=()=>void openRouteWorkflow(action.intent,action.route_id).catch(err=>notice(err.message,true));card.append(open);body.append(card)}}
    if(value?.open_action?.type==='workbench'){
      state.workbenchActions.push(value.open_action);syncWorkbenchActions();
    }
    if(value?.interaction)addChoice(value.interaction)
    if(value?.draft&&value.open_action){addDraft(value.draft,value.open_action);const fresh=!state.seenDraftIds.has(value.draft.id);state.seenDraftIds.add(value.draft.id);if(live&&fresh&&value.draft.status==='prepared')void openNativeDraft(value.draft).catch(err=>notice(err.message,true))}
    if(value?.confirmation_url){const c=el('div',{className:'card'});c.append(el('strong',{},'飞行任务待确认'),el('p',{},'核对设备、航线与执行时间后下发。'));const b=el('button',{},'打开确认页面');b.onclick=()=>{const u=new URL(value.confirmation_url,location.origin);if(u.origin===location.origin&&/^\/llm-center\/agent\/platform\/requests\/[a-f0-9]{48}$/.test(u.pathname))window.open(u.href,'_blank','noopener')};c.append(b);body.append(c)}
  }
  if(p.type==='request_end'&&p.stop_reason&&p.stop_reason!=='completed')notice(p.stop_reason==='retryable'?'模型请求未完成，正在重试。':'模型请求未完成，请检查连接或调整参数。',true)
}
async function loadSession(id){
  if(state.routeMount&&state.routeMount.dataset.conversationId!==id||state.routeSetup&&state.routeSetup.sid!==id)detachRoute();
  state.stream?.close();state.sid=id;localStorage.setItem(key('session'),id);body.replaceChildren(...(state.routeMount?[state.routeMount]:state.routeSetup?[state.routeSetup.card]:[]));state.partial=null;state.choices.clear();state.lastRouteId=null;state.routeWorkflow=null;state.routeActionKey=null;state.seenDraftIds.clear();state.workbenchActions=[];state.gate=new TranscriptGate()
  const snapshot=await request(NATIVE+'/sessions/'+encodeURIComponent(id))
  state.running=['running','compacting'].includes(snapshot.session?.status);stop.hidden=!state.running;send.disabled=state.running;models.disabled=state.running;renderBadge()
  const result=await request(NATIVE+'/sessions/'+encodeURIComponent(id)+'/messages?tailLimit=120')
  for(const message of result.messages||[])acceptMessage(message)
  if(snapshot.session?.status==='compacting')state.gate.compacting=true
  for(const message of result.live?.fragments||[])acceptMessage(message)
  syncWorkbenchActions();restoreRouteConversation();const stream=new EventSource(NATIVE+'/sessions/'+encodeURIComponent(id)+'/stream');state.stream=stream
  stream.onmessage=e=>{try{acceptMessage(JSON.parse(e.data),true)}catch{}}
  stream.addEventListener('server_event',e=>{try{const v=JSON.parse(e.data);if(v.type==='task_state'){state.running=v.state==='running'||v.state==='compacting';state.gate.compacting=v.state==='compacting';stop.hidden=!state.running;send.disabled=state.running;models.disabled=state.running;refreshChoiceButtons();renderBadge();notice(state.running?v.state==='compacting'?'正在整理上下文…':'任务运行中…':'已就绪');if(!state.running)void refreshDrafts()}else if(v.type==='approval_request'){notice('该工具需要在 Agent 中心确认后继续。',true)}}catch{}})
  stream.onerror=()=>notice('连接中断，正在恢复…')
}
async function submit(override={}){
  if(!(override.text??input.value).trim()&&!state.files.length)return false;if(state.running||send.disabled)return false
  const text=(override.text??input.value).trim(),fromRoute=!state.files.length&&taskFromRouteIntent(text),intent=!fromRoute&&!state.files.length&&!/(?:任务计划|任务规划|工作流|周期性|触发式|(?:规划|安排).{0,8}任务)/.test(text)&&!['resource_search','task_plan'].includes(override.frozen?.task)?routeIntent(text,state.routeWorkflow||{}):null,frozen=override.frozen||pageContext();send.disabled=true;if(!text.includes('[已确认的分步选择]')){state.workbenchActions=[];body.querySelector('.workbench-results')?.remove()}notice('正在提交…')
  try{
    if(!state.ready)await connect()
    if(fromRoute){await startTaskFromRoute(text);if(!override.preserveInput)input.value='';send.disabled=false;return true}
    if(intent){await ensureRouteSession();body.querySelector('.empty')?.remove();addMessage('user',text);state.routeMessages=[...(state.routeMessages||[]),text];await openRouteWorkflow(intent);if(!override.preserveInput)input.value='';send.disabled=false;return true}
    if(!state.sid){const model=JSON.parse(models.value);const r=await request(NATIVE+`/projects/${state.bootstrap.project}/agents/${state.bootstrap.profile}/sessions`,'POST',{...model,workspace:'/workspace',approvalMode:'read-only'});await loadSession(r.session.sessionId)}
    const parts=[{type:'text',text:(text||'请检查所附资料。')+'\n\n[页面上下文，仅供定位]\n'+JSON.stringify(frozen)},...(override.preserveInput?[]:state.files.map(f=>f.part))]
    await request(NATIVE+'/sessions/'+state.sid+'/tasks','POST',{input:parts})
    if(!override.preserveInput){input.value='';state.files=[];renderAttachments()}state.context=frozen;context.textContent='任务目标：'+frozen.title;state.running=true;stop.hidden=false;syncWorkbenchActions();renderBadge();return true
  }catch(e){notice(e.message,true);send.disabled=false;return false}
}
send.onclick=()=>void submit();input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void submit()}}
stop.onclick=async()=>{try{await request(NATIVE+'/sessions/'+state.sid+'/abort','POST',{});notice('已请求停止。')}catch(e){notice(e.message,true)}}
newChat.onclick=()=>{detachRoute();body.querySelectorAll('.route-resource-card').forEach(n=>n.remove());state.stream?.close();state.sid='';state.running=false;state.partial=null;state.choices.clear();state.lastRouteId=null;state.routeWorkflow=null;state.routeActionKey=null;state.seenDraftIds.clear();state.workbenchActions=[];state.gate=new TranscriptGate();localStorage.removeItem(key('session'));renderEmpty();send.disabled=false;stop.hidden=true;models.disabled=false;renderBadge()}
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
  const actions=el('div',{className:'actions'}),open=el('button',{},draft.kind==='annotation'?'打开标注界面':draft.kind==='training'?'打开模型训练':draft.status==='prepared'?'打开参数表单':'查看任务')
  open.onclick=()=>void openDraft(draft.id);actions.append(open)
  if(draft.offer_review){const review=el('button',{className:'primary'},'查看效果并继续');review.onclick=()=>void openNativeDraft(draft).catch(e=>notice(e.message,true));actions.append(review)}
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
    const prior=state.drafts.get(d.id);addDraft(v,{type:['annotation','training'].includes(d.kind)?'runos_draft':'platform_draft',id:d.id},!!(prior&&v.offer_review&&!prior.offer_review))
    if(v.offer_training&&!prior?.offer_training&&!state.expanded){state.unread++;renderBadge()}
  }
  }finally{state.refreshing=false}
}
tasksButton.onclick=async()=>{const p=panel('业务草稿与任务');await refreshDrafts();for(const d of state.drafts.values()){const b=el('button',{className:'history-item'},`${({annotation:'标注',training:'训练',tune:'微调',route:'航线'})[d.kind]} · ${d.data?.dataset_id||d.data?.data?.name||d.data?.args?.dataset||d.id.slice(0,8)} · ${taskStatus(d.job?.status||d.status)}`);b.onclick=()=>{p.remove();activePanel=null;void openDraft(d.id)};p.append(b)}if(!state.drafts.size)p.append(el('p',{},'暂无参数草稿。'))}
function createWorkbench(title,contextValue){
  state.workbench?.element.remove();const w=el('section',{className:'workbench',role:'dialog',ariaLabel:title}),h=el('header'),close=el('button',{},'关闭');h.append(el('strong',{},title),close);w.append(h);root.append(w);state.workbench={element:w,context:contextValue};close.onclick=()=>{w.remove();state.workbench=null};return w
}
function activeApplicationFrame(){return [...document.querySelectorAll('iframe.runos-frame')].find(f=>{try{const u=new URL(f.src,location.origin);return u.hostname===location.hostname&&['14000','4000'].includes(u.port)&&f.getBoundingClientRect().width>100&&f.getBoundingClientRect().height>100}catch{return false}})}
addEventListener('message',e=>{
  const frame=activeApplicationFrame();if(!frame||e.source!==frame.contentWindow||e.origin!==new URL(frame.src).origin||e.data?.source!=='runos-native-assistant'||Number(e.data.admin_id)!==Number(state.account?.id)||!/^[a-f0-9]{32}$/.test(e.data.channel||''))return
  const d=e.data
  if(d.type==='native-ready')state.nativeConnections.set(frame.contentWindow,{channel:d.channel,origin:e.origin,account:state.identity})
  const connection=state.nativeConnections.get(frame.contentWindow);if(!connection||connection.channel!==d.channel||connection.account!==state.identity)return
  if(['workflow-state','native-navigated'].includes(d.type)&&d.flow){state.nativeFlow=d.flow;state.nativeContext={path:'/application/'+(d.view||'annotate'),title:({annotate:'应用中心 · 标注',split:'应用中心 · 训练／验证／测试',training:'应用中心 · 模型训练'})[d.view]||'应用中心',flow_id:d.flow.id,dataset_id:d.flow.target_dataset_id||d.flow.source_dataset_id,stage:d.flow.stage}}
  if(d.type==='workflow-closed'){state.nativeFlow=null;state.nativeContext=null}
  if(d.kind==='route'&&d.type==='route-workflow'){const c=ownedConnections.get('route');if(c?.channel===d.channel&&c.identity===state.identity){state.routeWorkflow=d.state;if(d.state?.route_id)state.lastRouteId=d.state.route_id}}
  if(d.type==='resource-return')void returnToChoices()
  if(d.type==='workflow-ask-training'&&d.flow_id===state.nativeFlow?.id&&d.dataset_id===state.nativeFlow?.target_dataset_id){expanded(true);if(state.running){notice('助手仍在处理，请稍后再次选择训练模型与参数。');return}void submit({text:`标注效果已经由我确认，数据划分已完成。请读取标注草稿 ${d.flow_id} 的真实 workflow，仅为划分后的数据集 ${d.dataset_id} 分步选择训练架构、初始权重和训练参数，不重复选择源数据集。生成草稿后进入应用中心原模型训练页面，等待我确认执行。`,preserveInput:true,frozen:state.nativeContext})}
})
async function navigateApplication(draft,flow,resource){
  const identity=state.identity,route=appRouter.getRoutes().find(r=>/^\/admin\/appcenter(?:\/index)?\/?$/i.test(r.path));if(!route)throw Error('当前账号没有应用中心入口。')
  if(appRouter.currentRoute.value.path!==route.path)await appRouter.push(route.path)
  const started=Date.now()
  while(Date.now()-started<30000){
    if(identity!==state.identity)throw Error('账号已更新，请重新打开应用中心。')
    const frame=activeApplicationFrame()
    if(frame){
      const origin=new URL(frame.src).origin;frame.contentWindow.postMessage({source:'runhive-platform-assistant',type:'native-ping'},origin)
      const c=state.nativeConnections.get(frame.contentWindow)
      if(c?.account===identity){
        const request_id=crypto.randomUUID().replaceAll('-',''),payload={source:'runhive-platform-assistant',type:'native-nav',channel:c.channel,admin_id:Number(state.account.id),request_id,...(resource?{view:resource.view,dataset_id:resource.dataset_id}:{view:draft.kind==='training'?'training':'annotate',draft_id:draft.id,flow_id:flow?.id||(draft.kind==='annotation'?draft.id:undefined)})}
        await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{removeEventListener('message',reply);reject(Error('应用页面未响应，请刷新后重试。'))},15000);const reply=e=>{if(e.source!==frame.contentWindow||e.origin!==c.origin||e.data?.request_id!==request_id||e.data?.channel!==c.channel||identity!==state.identity)return;if(e.data.type==='native-navigated'){clearTimeout(timer);removeEventListener('message',reply);resolve()}else if(e.data.type==='native-navigation-error'){clearTimeout(timer);removeEventListener('message',reply);reject(Error(e.data.message||'页面定位未完成。'))}};addEventListener('message',reply);frame.contentWindow.postMessage(payload,c.origin)})
        notice(resource?'已打开资源管理页，添加完成后返回助手继续。':draft.kind==='annotation'?'已定位标注页，核对后点击“批量标注数据集”。':'已定位模型训练页，核对后确认执行。');expanded(false);return
      }
    }
    await new Promise(resolve=>setTimeout(resolve,300))
  }
  throw Error('应用中心加载超时，请检查页面连接后重试。')
}
async function openNativeDraft(draft){
  if(!state.ready)await connect()
  if(draft.kind==='tune'){const latest=await request(BASE+'/prepared/'+draft.id);await navigateOwnedPage('tune',{view:latest.data.operation==='eval'?'eval':latest.data.operation==='export'?'export':'train',draft_id:latest.id});return}
  if(draft.kind==='route'){await navigateOwnedPage('route',{view:'edit',draft_id:draft.id});return}
  let flow
  if(draft.kind==='annotation')flow=await request(BASE+'/assistant/flows/'+draft.id)
  else if(activeApplicationFrame()&&state.nativeFlow){flow=await request(BASE+'/assistant/flows/'+state.nativeFlow.id);if(flow.training_draft!==draft.id){if(draft.status==='submitted')flow=undefined;else{if(!['split_done','training_ready'].includes(flow.stage))throw Error('请先在标注页确认效果，并完成数据划分。');if(flow.target_dataset_id!==draft.data.dataset_id)throw Error('该训练草稿未使用本流程划分后的数据集，请重新准备。');flow=await request(BASE+'/assistant/flows/'+flow.id+'/bind-training','POST',{revision:flow.revision,draft_id:draft.id})}}}
  await navigateApplication(draft,flow)
}
async function openDraft(id){const draft=state.drafts.get(id);if(!draft)return;try{await openNativeDraft(draft)}catch(e){notice(e.message,true)}}
async function openSelectedRoute(entry,route_id){
  const identity=state.identity,sid=state.sid;if(entry.sid!==sid||!/^\d+$/.test(String(route_id||'')))throw Error('会话已切换，请重新选择航线。')
  if(state.running)await request(NATIVE+'/sessions/'+encodeURIComponent(sid)+'/abort','POST',{})
  if(identity!==state.identity||sid!==state.sid)throw Error('会话已切换，请重新选择航线。')
  await openRouteWorkflow({task:'edit',operation:'choose'},String(route_id));state.lastRouteId=String(route_id)
}
async function openRouteWorkflow(intent,route_id){
 if(!state.ready)await connect();await ensureRouteSession();if(state.running&&state.sid){await request(NATIVE+'/sessions/'+state.sid+'/abort','POST',{});state.running=false;stop.hidden=true}
 if(intent.task==='create'){state.lastRouteId=null;state.routeWorkflow=null;await startRouteResources(intent);return}
 if(intent.goal==='custom'&&state.routeWorkflow?.goal)intent={...intent,goal:state.routeWorkflow.goal};
 state.routeModeActive=true;body.querySelector('.empty')?.remove();rememberRoute({...intent,route_id:route_id||state.lastRouteId});routeMount();await navigateOwnedPage('route',{view:'workflow',intent:{...intent,conversation_id:state.sid},...((route_id||intent.route_id||state.lastRouteId)?{route_id:String(route_id||intent.route_id||state.lastRouteId)}:{})});expanded(true);notice('在助手中继续调整；地图与左侧航点设置会同步更新。')
}
async function startTaskFromRoute(text){
  if(!state.ready)await connect()
  const identity=state.identity,sid=state.sid
  body.querySelector('.assistant-task-plan-card')?.remove();body.querySelector('.empty')?.remove();addMessage('user',text)
  const card=el('section',{className:'card assistant-task-plan-card'}),title=el('strong',{},'根据已保存航线创建任务计划')
  const description=el('p',{},'选择已有航线，核对任务目标后准备草稿。飞行仍需在原任务页面人工确认。')
  const route=el('select',{ariaLabel:'选择已保存航线'}),device=el('select',{ariaLabel:'选择执行设备'})
  const name=el('input',{ariaLabel:'任务名称',maxLength:120,placeholder:'例如：河流巡检任务'})
  const objective=el('textarea',{ariaLabel:'任务目标',maxLength:2000,placeholder:'描述这次巡检需要采集和检查的内容'})
  const schedule=el('select',{ariaLabel:'任务方式'})
  schedule.append(el('option',{value:'manual'},'人工确认后执行'),el('option',{value:'periodic'},'按天周期准备计划'))
  const status=el('p',{className:'task-plan-status',role:'status'}),actions=el('div',{className:'task-plan-actions'})
  const refresh=el('button',{},'刷新航线'),cancel=el('button',{},'取消'),confirm=el('button',{className:'primary'},'创建任务计划草稿')
  const field=(label,control)=>{const wrapper=el('label',{className:'route-resource-field'});wrapper.append(el('span',{},label),control);return wrapper}
  card.append(title,description,field('已有航线',route),field('执行设备（可稍后选择）',device),field('任务名称',name),field('巡检目标',objective),field('执行方式',schedule),status,actions)
  actions.append(refresh,cancel,confirm);body.append(card);body.scrollTop=body.scrollHeight
  const current=()=>{if(identity!==state.identity||sid!==state.sid||!card.isConnected)throw Error('对话或账号已切换，请重新选择。')}
  const load=async()=>{
    refresh.disabled=true;status.textContent='正在读取当前账号的航线与设备…'
    try{
      const [routes,devices]=await Promise.all([request(BASE+'/assistant/choice-options/routes'),request(BASE+'/assistant/choice-options/devices')]);current()
      const previous=route.value,items=routes.options||[],equipment=devices.options||[]
      route.replaceChildren(el('option',{value:''},items.length?'请选择已保存航线':'暂无已保存航线'))
      for(const item of items)route.append(el('option',{value:String(item.value)},item.label))
      route.value=[previous,state.lastRouteId,state.routeWorkflow?.route_id].map(String).find(id=>items.some(item=>String(item.value)===id))||''
      device.replaceChildren(el('option',{value:''},'稍后选择设备'))
      for(const item of equipment)device.append(el('option',{value:String(item.value)},item.label))
      if(route.value&&!name.value){const selected=items.find(item=>String(item.value)===route.value);name.value=(selected?.label||'巡检航线')+'任务'}
      if(route.value&&!objective.value)objective.value='沿所选航线执行巡检，采集影像并复核归档。'
      status.textContent=items.length?route.value?'已选中当前对话保存的航线，请核对任务信息。':'请选择要执行的航线。':'当前航线尚未保存。请先在航线编辑页保存，再点击“刷新航线”。'
      confirm.disabled=!items.length
    }catch(error){if(card.isConnected){status.textContent=error.message;confirm.disabled=true}}finally{refresh.disabled=false}
  }
  card.refreshRoutes=load;refresh.onclick=()=>void load()
  route.onchange=()=>{const selected=[...route.options].find(item=>item.value===route.value);if(selected){name.value=selected.textContent+'任务';if(!objective.value)objective.value='沿所选航线执行巡检，采集影像并复核归档。'}status.textContent='请核对后创建任务计划草稿。'}
  cancel.onclick=()=>{card.remove();notice('已取消任务计划选择。')}
  confirm.onclick=async()=>{
    if(!route.value){status.textContent='请先选择已保存的航线。';return}
    if(!name.value.trim()||!objective.value.trim()){status.textContent='请填写任务名称和巡检目标。';return}
    confirm.disabled=true;status.textContent='正在准备任务计划草稿…'
    try{
      const plan=await request(BASE+'/task-plans','POST',{name:name.value.trim(),objective:objective.value.trim(),airline_id:route.value,...(device.value?{equipment_id:device.value}:{}),schedule:schedule.value==='periodic'?{kind:'periodic',interval_minutes:1440}:{kind:'manual'}});current()
      state.lastRouteId=route.value;detachRoute();card.replaceChildren(el('strong',{},'任务计划草稿已创建'),el('p',{},'已关联所选航线。请在任务计划页核对设备、步骤与执行方式；此操作不会下发飞行。'))
      const review=el('button',{className:'primary'},'核对任务计划');review.onclick=()=>void navigateWorkbench({type:'workbench',view:'plans',id:plan.id}).catch(error=>notice(error.message,true));card.append(review)
      notice('任务计划草稿已准备，等待人工核对。')
    }catch(error){if(card.isConnected){status.textContent=error.message;confirm.disabled=false}}
  }
  await load()
}
function addRouteOpenButton(card,entry,route_id){
  body.querySelectorAll('.route-open-button').forEach(b=>b.remove());const open=el('button',{className:'primary route-open-button'},'打开航线编辑')
  open.onclick=async()=>{open.disabled=true;try{await openSelectedRoute(entry,route_id)}catch(e){notice(e.message,true)}finally{open.disabled=false}};card.append(open)
}
function navigateApplicationResource(view,dataset_id){return navigateApplication(null,null,{view,dataset_id})}
const ownedConnections=new Map()
addEventListener('runhive-native-response',event=>{
  const d=event.detail;if(d?.source!=='runhive-native-page'||d.admin_id!==Number(state.account?.id)||!['tune','route'].includes(d.kind)||!/^[a-f0-9]{32}$/.test(d.channel||''))return
  if(d.type==='native-ready')ownedConnections.set(d.kind,{channel:d.channel,identity:state.identity})
  if(d.kind==='route'&&d.type==='route-workflow'){const c=ownedConnections.get('route');if(c?.channel===d.channel&&c.identity===state.identity){state.routeWorkflow=d.state;if(d.state?.route_id)state.lastRouteId=d.state.route_id}}
  if(d.type==='resource-return')void returnToChoices()
  if(d.kind==='route'&&d.type==='native-saved'){const c=ownedConnections.get('route');if(c?.channel!==d.channel||c.identity!==state.identity||!/^\d+$/.test(String(d.route_id||'')))return;state.lastRouteId=d.route_id;if(state.routeModeActive)rememberRoute({task:'edit',operation:'choose',route_id:d.route_id});void refreshDrafts();void body.querySelector('.assistant-task-plan-card')?.refreshRoutes?.();notice('航线已保存，助手任务记录已更新。')}
  if(d.type==='map-location-selected'){
    const pending=state.pendingMap,c=ownedConnections.get('route');if(!pending||pending.identity!==state.identity||pending.entry.sid!==state.sid||state.choices.get(d.interaction_id)!==pending.entry||pending.entry.flow.interaction.id!==d.interaction_id||c?.channel!==d.channel)return
    pending.entry.flow.set(pending.question,d.point);pending.entry.persist();pending.entry.draw();state.pendingMap=null;expanded(true);notice('已确认地图位置，请继续当前选择。')
  }
})
async function navigateOwnedPage(kind,payload){
  const identity=state.identity,route=appRouter.getRoutes().find(r=>kind==='tune'?/^\/admin\/llmcenter(?:\/index)?\/?$/i.test(r.path):/^\/admin\/(?:flight|flyspace|flightspace|fly|flycontrol)(?:\/index)?\/?$/i.test(r.path))
  if(!route)throw Error(kind==='tune'?'当前账号没有大模型中心入口。':'当前账号没有航线规划入口。')
  ownedConnections.delete(kind);if(appRouter.currentRoute.value.path!==route.path)await appRouter.push(route.path)
  const start=Date.now()
  while(Date.now()-start<60000){
    if(identity!==state.identity)throw Error('登录状态已更新。')
    window.dispatchEvent(new CustomEvent('runhive-native-request',{detail:{source:'runhive-platform-assistant',kind,type:'native-ping',admin_id:Number(state.account.id)}}))
    const c=ownedConnections.get(kind)
    if(c?.identity===identity){
      const request_id=crypto.randomUUID().replaceAll('-','')
      const navigation=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{removeEventListener('runhive-native-response',listen);reject(Error('业务页面未响应，请重新连接后重试。'))},90000)
        const listen=event=>{const d=event.detail;if(d?.source!=='runhive-native-page'||d.kind!==kind||d.admin_id!==Number(state.account.id)||d.channel!==c.channel||d.request_id!==request_id||identity!==state.identity)return;if(!['native-navigated','native-navigation-error'].includes(d.type))return;clearTimeout(timer);removeEventListener('runhive-native-response',listen);d.type==='native-navigated'?resolve(d):reject(Error(d.message||'页面定位未完成。'))}
        addEventListener('runhive-native-response',listen)
        window.dispatchEvent(new CustomEvent('runhive-native-request',{detail:{source:'runhive-platform-assistant',kind,type:'native-nav',admin_id:Number(state.account.id),channel:c.channel,request_id,...payload}}))
      })
      notice('已打开原业务页面，请核对参数后确认。');expanded(kind==='route');context.textContent='当前页面：'+pageContext().title;return navigation
    }
    await new Promise(resolve=>setTimeout(resolve,200))
  }
  throw Error('业务页面加载超时，请重新连接。')
}
function resetAccount(){detachRoute();state.stream?.close();clearInterval(state.jobTimer);state.ready=false;state.sid='';state.csrf='';state.bootstrap=null;state.running=false;state.unread=0;state.drafts.clear();state.choices.clear();state.seenDraftIds.clear();state.nativeConnections.clear();ownedConnections.clear();state.pendingResource=null;state.pendingMap=null;state.lastRouteId=null;state.nativeFlow=null;state.nativeContext=null;state.gate=new TranscriptGate();state.files=[];state.workbench?.element.remove();state.workbench=null;activePanel?.remove();activePanel=null;body.replaceChildren();input.value='';renderAttachments();expanded(false)}
setInterval(()=>{
  try{const account=useAdminInfo(),identity=`${account.id||0}:${account.token||''}`;state.account=account
    if(identity!==state.identity){resetAccount();state.identity=identity;host.hidden=!account.id||!account.token;restorePosition();if(account.id&&account.token&&localStorage.getItem(key('session')))void connect().catch(()=>{})}
  }catch{host.hidden=true}
},700)
host.hidden=true;place()

// This controller collects resources in the current assistant conversation.
// Once the editor is open, its existing React guide renders into this mount.
function routeJournalKey(){return key('route-journal:'+state.sid)}
function rememberRoute(intent){state.routeCommand={...intent};localStorage.setItem(routeJournalKey(),JSON.stringify({intent:state.routeCommand,messages:state.routeMessages||[]}))}
function routeMount(){
  if(!state.routeMount){state.routeMount=el('div');state.routeMount.dataset.routeGuide='';state.routeMount.dataset.adminId=String(state.account.id);state.routeMount.dataset.conversationId=state.sid}
  body.append(state.routeMount);return state.routeMount
}
function detachRoute(){
  const c=ownedConnections.get('route');if(c?.identity===state.identity)window.dispatchEvent(new CustomEvent('runhive-native-request',{detail:{source:'runhive-platform-assistant',kind:'route',type:'guide-detach',admin_id:Number(state.account?.id),channel:c.channel}}))
  state.routeSetup?.card.remove();state.routeMount?.remove();state.routeMount=null;state.routeSetup=null;state.routeCommand=null;state.routeMessages=[];state.routeModeActive=false
}
function restoreRouteConversation(){
  if(state.routeMount?.dataset.conversationId===state.sid||state.routeSetup?.sid===state.sid){for(const text of state.routeMessages||[])addMessage('user',text);if(state.routeMount)routeMount();else body.append(state.routeSetup.card);state.routeModeActive=true;return}
  let saved;try{saved=JSON.parse(localStorage.getItem(routeJournalKey())||'null')}catch{}
  if(!saved?.intent)return;state.routeMessages=saved.messages||[];state.routeCommand=saved.intent
  for(const text of state.routeMessages)addMessage('user',text)
  const card=el('section',{className:'card route-recovery'}),button=el('button',{className:'primary'},'继续航线创建／编辑');card.append(el('p',{},'接着在这个对话中规划，已保存的航线可以继续编辑。'),button);body.append(card)
  button.onclick=()=>{button.disabled=true;void openRouteWorkflow(saved.intent).then(()=>card.remove()).catch(e=>{notice(e.message,true);button.disabled=false})}
}
async function ensureRouteSession(){
  if(!state.sid){const model=JSON.parse(models.value);const r=await request(NATIVE+`/projects/${state.bootstrap.project}/agents/${state.bootstrap.profile}/sessions`,'POST',{...model,workspace:'/workspace',approvalMode:'read-only'});await loadSession(r.session.sessionId)}
}
async function startRouteResources(intent){
  const messages=state.routeMessages||[];detachRoute();state.routeMessages=messages;state.routeModeActive=true;rememberRoute(intent)
  body.querySelector('.empty')?.remove();const card=el('section',{className:'card route-resource-card'});body.append(card)
  const setup={intent,card,project:String(intent.project_id||''),library:String(intent.library_id||''),projects:[],libraries:[],name:'',point:null,newProject:false,newLibrary:false,busy:false,error:'',sid:state.sid,identity:state.identity};state.routeSetup=setup
  const current=()=>{if(state.routeSetup!==setup||state.sid!==setup.sid||state.identity!==setup.identity)throw Error('对话或账号已切换，请重新选择。')}
  const resource=(method,body={})=>routeResources(null,BackendApi,method,body,current)
  const run=async fn=>{if(setup.busy)return;setup.busy=true;setup.error='';draw();try{await fn();current()}catch(e){if(state.routeSetup===setup)setup.error=e.message}finally{if(state.routeSetup===setup){setup.busy=false;draw()}}}
  const persist=()=>rememberRoute({...setup.intent,project_id:setup.project,library_id:setup.library})
  const continuePlanning=()=>run(async()=>{
    const r=await resource('resources',{project_id:setup.project});if(!r.libraries.some(f=>String(f.id)===setup.library))throw Error('航线库已不可用，请重新选择。')
    const selected={...intent,project_id:setup.project,library_id:setup.library,conversation_id:state.sid,name:intent.name||(intent.goal==='river'?'河流巡检':intent.goal==='corridor'?'道路巡检':'新航线')};rememberRoute(selected);routeMount()
    try{await navigateOwnedPage('route',{view:'workflow',intent:selected});current();card.remove();state.routeSetup=null;notice('在助手里继续选择巡检范围；地图和左侧编辑器会同步预览。')}catch(e){state.routeMount?.remove();state.routeMount=null;throw e}
  })
  const field=(label,node)=>{const box=el('label',{className:'route-resource-field'});box.append(el('span',{},label),node);return box}
  function draw(){
    current();card.replaceChildren();card.append(el('strong',{},'创建'+(intent.goal==='river'?'河流巡检':intent.goal==='corridor'?'道路巡检':'')+'航线'),el('p',{},'先选项目和航线库，接着在地图上选范围。'))
    const project=el('select',{ariaLabel:'选择项目',disabled:setup.busy});project.append(el('option',{value:''},'请选择项目'));for(const p of setup.projects)project.append(el('option',{value:p.id},p.name));project.value=setup.project
    project.onchange=()=>{setup.project=project.value;setup.library='';setup.libraries=[];setup.newLibrary=false;persist();void run(async()=>{if(setup.project)setup.libraries=(await resource('resources',{project_id:setup.project})).libraries})};card.append(field('项目',project))
    const newProject=el('button',{disabled:setup.busy},setup.newProject?'取消新建项目':'新建项目');newProject.onclick=()=>{setup.newProject=!setup.newProject;setup.newLibrary=false;setup.name='';setup.point=null;draw()};card.append(newProject)
    if(setup.newProject){
      const name=el('input',{ariaLabel:'项目名称',value:setup.name,placeholder:'填写项目名称',disabled:setup.busy});name.oninput=()=>setup.name=name.value;card.append(field('项目名称',name))
      const pick=el('button',{disabled:setup.busy},setup.point?'重新选择项目位置':'地图选择项目位置');pick.onclick=()=>void run(async()=>{notice('在原地图点击项目位置，选择完成后继续当前对话。');const r=await navigateOwnedPage('route',{view:'project-location'});current();setup.point=r.point});card.append(pick)
      if(setup.point)card.append(el('p',{},'已选择地图位置。'))
      const create=el('button',{className:'primary',disabled:setup.busy||!setup.point},'创建并选用项目');create.onclick=()=>void run(async()=>{const r=await resource('create-project',{name:setup.name,point:setup.point,confirmed:true});setup.projects=r.projects;setup.project=r.project.id;setup.library='';setup.libraries=(await resource('resources',{project_id:setup.project})).libraries;setup.newProject=false;persist()});card.append(create)
    }
    if(setup.project&&!setup.newProject){
      const library=el('select',{ariaLabel:'选择航线库',disabled:setup.busy});library.append(el('option',{value:''},'请选择航线库'));for(const f of setup.libraries)library.append(el('option',{value:f.id},f.name));library.value=setup.library;library.onchange=()=>{setup.library=library.value;persist();if(setup.library)void continuePlanning();else draw()};card.append(field('航线库',library))
      const add=el('button',{disabled:setup.busy},setup.newLibrary?'取消新建航线库':'新建航线库');add.onclick=()=>{setup.newLibrary=!setup.newLibrary;setup.name='';draw()};card.append(add)
      if(setup.newLibrary){const name=el('input',{value:setup.name,ariaLabel:'航线库名称',placeholder:'填写航线库名称',disabled:setup.busy});name.oninput=()=>setup.name=name.value;card.append(field('航线库名称',name));const create=el('button',{disabled:setup.busy,className:'primary'},'创建并选用航线库');create.onclick=()=>void run(async()=>{const r=await resource('create-library',{project_id:setup.project,name:setup.name,confirmed:true});setup.libraries=r.libraries;setup.library=r.library.id;setup.newLibrary=false;persist()}).then(()=>{if(state.routeSetup===setup&&!setup.newLibrary&&setup.library)void continuePlanning()});card.append(create)}
    }
    const actions=el('div',{className:'route-resource-actions'}),next=el('button',{className:'primary',disabled:setup.busy||!setup.project||!setup.library||setup.newProject||setup.newLibrary},'下一步：地图规划')
    next.onclick=()=>void continuePlanning()
    const refresh=el('button',{disabled:setup.busy},'刷新资源');refresh.onclick=()=>void run(async()=>{const r=await resource('resources',{project_id:setup.project||undefined});setup.projects=r.projects;setup.libraries=r.libraries||[];if(!setup.projects.some(p=>p.id===setup.project)){setup.project='';setup.library=''}else if(!setup.libraries.some(f=>f.id===setup.library))setup.library='';persist()});actions.append(next,refresh);card.append(actions)
    if(setup.error)card.append(el('p',{className:'error',role:'alert'},setup.error));if(setup.busy)card.append(el('p',{role:'status'},'正在处理…'))
    context.textContent='任务目标：航线创建';body.scrollTop=body.scrollHeight
  }
  await run(async()=>{const r=await resource('resources',{project_id:setup.project||undefined});setup.projects=r.projects;setup.libraries=r.libraries||[]});expanded(true)
}

function selectedRouteId(flow,lastRouteId){return routeChoiceAllowed(flow,state.context||pageContext())?originalSelectedRouteId(flow,lastRouteId):null}
function canOpenRouteDirectly(flow,lastRouteId){return routeChoiceAllowed(flow,state.context||pageContext())&&originalCanOpenRouteDirectly(flow,lastRouteId)}
function syncWorkbenchActions(){
  body.querySelector('.workbench-results')?.remove();
  const actions=orderedActions(state.workbenchActions,state.running,[...state.choices.values()].some(v=>!v.flow.confirmed));
  if(!actions.length)return;
  const card=el('section',{className:'card workbench-results',ariaLabel:'本次准备结果'}),buttons=el('div',{className:'actions'});
  card.append(el('strong',{},'草稿已准备'),el('p',{},'选择已确认，请打开对应页面核对。'));
  for(const action of actions){const open=el('button',{className:'primary'},action.view==='resources'?'查看资源分析':action.view==='plans'?'核对任务计划':'核对工作流');open.onclick=()=>void navigateWorkbench(action).catch(err=>notice(err.message,true));buttons.append(open)}
  card.append(buttons);body.append(card);
}
async function navigateWorkbench(action){
  const identity=state.identity,target=action.view==='resources'?'resourcecenter':'workflowcenter';
  const route=appRouter.getRoutes().find(r=>new RegExp('^/admin/'+target+'(?:/index)?/?$','i').test(r.path));
  if(!route)throw Error('当前账号没有工作流或资源库入口。');
  if(appRouter.currentRoute.value.path!==route.path)await appRouter.push(route.path);
  if(identity!==state.identity)return;
  const detail={...action,admin_id:Number(state.account.id)};
  window.__runhiveWorkbenchAction=detail;
  window.dispatchEvent(new CustomEvent('runhive-workbench-open',{detail}));
  expanded(true);
}
addEventListener('runhive-assistant-compose',event=>{
  const d=event.detail;
  if(d?.source!=='runhive-workbench'||Number(d.admin_id)!==Number(state.account?.id)||typeof d.text!=='string'||d.text.length>3000)return;
  expanded(true);if(state.running){notice('助手仍在处理，请完成当前操作后再搜索。');return}
  void submit({text:d.text,preserveInput:true,frozen:{path:location.pathname+location.hash,title:d.context?.title||'工作流中心',...d.context}});
});
addEventListener('runhive-workbench-native-draft',async event=>{
  const d=event.detail;if(!['annotation','training','tune'].includes(d?.kind)||!/^[a-f0-9]{32}$/.test(d.id||''))return;
  try{expanded(true);if(!state.ready)await connect();const draft=await request(BASE+(d.kind==='tune'?'/prepared/':'/assistant/drafts/')+d.id);await openNativeDraft(draft)}catch(e){notice(e.message,true)}
});
