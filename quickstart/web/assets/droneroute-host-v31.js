import {W as BackendApi,u as useAdminInfo} from '/assets/index-D5rXB33a.js'
import {m as mars} from '/assets/mars3d-D9h0wQWm.js'
import {attachMarsRoute} from './mars-route-v31.js'
import {uiClipPath} from './ui-regions-v31.js'
const BASE='/llm-center/agent/platform',copy=v=>JSON.parse(JSON.stringify(v)),hex=v=>/^[a-f0-9]{32}$/.test(v||'')
let context=null,frame=null,bridge=null,binding=null,selection=null
const identity=()=>{const a=useAdminInfo();return `${a.id}:${a.token}`}
async function api(path,method='GET',body){const own=identity(),a=useAdminInfo();let csrf='';if(method!=='GET'){const r=await fetch(BASE+'/session',{credentials:'same-origin',cache:'no-store'}),s=await r.json();if(!r.ok||s.tenant_id!==Number(a.id))throw Error('请重新连接平台助手。');csrf=s.csrf}const r=await fetch(BASE+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(csrf?{'X-Platform-CSRF':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)}),v=await r.json();if(own!==identity())throw Error('登录状态已更新。');if(!r.ok)throw Error(v.message||v.detail?.message||'航线操作未完成。');return v}
const backend=()=>new BackendApi('/admin/Airline/')
async function read(id){const r=await backend().edit({id});if(!r.data?.row)throw Error('航线已不可用。');return r.data.row}
function currentRow(){const c=context;if(!c)throw Error('航线页面尚未连接。');return {...copy(c.lanes.subForm),kmz_json:copy(c.lanes.shipForm)}}
function send(type,data={}){if(frame&&bridge)frame.contentWindow?.postMessage({source:'runhive-droneroute-host',type,channel:bridge.channel,...data},location.origin)}
function routeReply(type,data={}){const c=context;if(c)window.dispatchEvent(new CustomEvent('runhive-native-response',{detail:{source:'runhive-native-page',kind:'route',type,admin_id:Number(useAdminInfo().id),channel:c.channel,...data}}))}
async function save(body){
 const own=identity(),draftId=binding?.id;
 const id=body.id==null?null:String(body.id);if(id&&!/^\d+$/.test(id))throw Error('航线标识无效。')
 const original=id?await read(id):currentRow(),payload={name:body.name,project_id:original.project_id,airline_floder_id:original.airline_floder_id||0,kmz_json:body.kmz_json,...(id?{id,revision:body.revision}:{} )}
 if(own!==identity())throw Error('登录状态已更新。')
 if(id&&!body.revision)throw Error('请重新读取航线后再保存。')
 let result
 if(binding&&(id===String(binding.routeId)||!id&&!binding.routeId)){
  if(binding.identity!==identity())throw Error('登录状态已更新。')
  let draft=await api('/prepared/'+binding.id)
  if(draft.status==='submitted')result=draft.result
  else {if(draft.status!=='prepared')throw Error('草稿状态待核查，请查看任务记录。');if(id&&body.revision!==draft.data.revision)throw Error('航线版本已更新，请重新准备参数。');const preparedPayload={...payload};delete preparedPayload.id;delete preparedPayload.revision;draft=await api('/prepared/'+binding.id,'PUT',{revision:draft.revision,data:{...draft.data,data:preparedPayload}});draft=await api('/prepared/'+binding.id+'/execute','POST',{revision:draft.revision});result=draft.result}
  binding=null
 }else {const r=await backend().postData(id?'edit':'add',payload);if(r.code!==1)throw Error(r.msg||'航线未能保存。');result=r.data}
 const savedId=result?.id||result?.route?.id||result?.row?.id||id;if(!savedId)throw Error('保存结果缺少航线标识，请查看航线列表。')
 const fresh=await read(savedId);if(own!==identity())throw Error('登录状态已更新。');context.lanes.subForm={...context.lanes.subForm,...fresh};context.lanes.showShipForm(typeof fresh.kmz_json==='string'?JSON.parse(fresh.kmz_json):fresh.kmz_json);context.planner.dirty=false
 if(own!==identity())throw Error('登录状态已更新。')
 send('saved',{message:'航线已保存。可继续查看和编辑。'});routeReply('native-saved',{route_id:String(savedId),revision:fresh.revision,draft_id:draftId});return {id:String(savedId),revision:fresh.revision}
}
export function attachDroneRouteFrame(element){
 frame=element;let mapAdapter=null,lastMapState=null,lastReference=false;const mapTimer=setInterval(()=>{if(!mapAdapter&&context?.map()){mapAdapter=attachMarsRoute(context.map(),mars,send);if(lastMapState)mapAdapter.update(lastMapState);mapAdapter.referenceMode(lastReference)}},100);bridge={channel:crypto.randomUUID().replaceAll('-',''),identity:identity()};let disposed=false
 const initialize=()=>{if(!disposed&&context&&bridge.identity===identity())send('initialize',{row:currentRow(),load_id:context.loadId,guide:binding?'请检查航点、动作和高级参数，再点击保存。':'在地图上选择或拖动航点，在航点列表中编辑动作。',pick:selection})}
 const listen=async event=>{
  const d=event.data;if(disposed||event.source!==element.contentWindow||event.origin!==location.origin||d?.source!=='runhive-droneroute'||bridge?.identity!==identity())return
  if(d.type==='ready'){initialize();return}if(d.channel!==bridge.channel)return
  if(d.type==='mission-state'){lastMapState=d.state;mapAdapter?.update(d.state);return}
  if(d.type==='preview-state'){mapAdapter?.template(d.preview);return}
  if(d.type==='reference-mode'){lastReference=!!d.active;mapAdapter?.referenceMode(lastReference);return}
  if(d.type==='camera-view'){mapAdapter?.camera();return}
  if(d.type==='ui-bounds'){const clip=uiClipPath(d.rects,element.clientWidth,element.clientHeight);if(clip)element.style.clipPath=clip;return}
  if(d.type==='dirty'){context.planner.dirty=!!d.value;return}
  if(d.type==='close'){if(context.planner.dirty&&!confirm('航线尚未保存，确定退出编辑？'))return;context.planner.dirty=false;context.mode.value='';return}
  if(d.type==='loaded'){if(!context.loadId||d.load_id===context.loadId)context.loaded=d.load_id||true;return}
  if(d.type==='map-location-selected'&&selection&&d.interaction_id===selection.interaction_id){const p=d.point;if(!p||![p.lat,p.lng].every(Number.isFinite)||Math.abs(p.lat)>90||Math.abs(p.lng)>180)return;routeReply('map-location-selected',{interaction_id:selection.interaction_id,point:p});selection=null;return}
  if(d.type!=='request'||!hex(d.request_id)||!['list','save','delete'].includes(d.method))return
  const own=identity();try{let result;if(d.method==='list'){const r=await backend().index({limit:100});result=r.data?.list||[]}else if(d.method==='save')result=await save(d.body||{});else {const id=String(d.body?.id||'');if(!/^\d+$/.test(id))throw Error('航线标识无效。');await read(id);const r=await backend().del([id]);result=r.data}if(own===identity())send('response',{request_id:d.request_id,result})}catch(e){if(own===identity())send('response',{request_id:d.request_id,error:e.message})}
 }
 window.addEventListener('message',listen);element.addEventListener('load',initialize)
 return ()=>{disposed=true;clearInterval(mapTimer);mapAdapter?.close();window.removeEventListener('message',listen);element.removeEventListener('load',initialize);if(frame===element){frame=null;bridge=null}}
}
async function openRow(row){
 const c=context;await c.projects.getProjectList();const p=c.projects.projectList.find(p=>String(p.id)===String(row.project_id));if(!p)throw Error('当前账号无法打开该航线所属项目。')
 if(c.planner.dirty&&!confirm('当前航线尚未保存，是否放弃修改并打开所选航线？'))throw Error('已保留当前航线。')
 c.projects.currentProject=p;c.projects.isShowProject=false;c.left.value=true;c.tab.value=2;await c.projects.getShipLanesFolderList()
 c.lanes.showShipForm(typeof row.kmz_json==='string'?JSON.parse(row.kmz_json):copy(row.kmz_json));c.lanes.subForm={...row};delete c.lanes.subForm.kmz_json
 c.mode.value=row.id?'edit':'add';await c.nextTick();c.planner.dirty=false
 const load_id=crypto.randomUUID().replaceAll('-','');c.loadId=load_id;c.loaded=false;send('load',{row,load_id,pick:selection,guide:'请检查地图、航点、动作和高级设置，再点击保存。'})
 const start=Date.now();while(!c.loaded&&Date.now()-start<30000)await new Promise(r=>setTimeout(r,150));if(!c.loaded)throw Error('DroneRoute 未完成加载，请重新连接。')
 if(selection)send('pick-location',selection)
}
export function attachRouteAssistant(ctx){
 context={...ctx,channel:crypto.randomUUID().replaceAll('-',''),loaded:false};const c=context;let busy=false
 const active=()=>c.root()?.getBoundingClientRect().width>100
 const listen=async e=>{const d=e.detail,a=useAdminInfo();if(context!==c||!active()||!a.token||d?.source!=='runhive-platform-assistant'||d.kind!=='route'||d.admin_id!==Number(a.id))return;if(d.type==='native-ping'){routeReply('native-ready');return}if(d.type!=='native-nav'||d.channel!==c.channel||!hex(d.request_id)||!['edit','pick-location'].includes(d.view))return;if(busy){routeReply('native-navigation-error',{request_id:d.request_id,message:'航线正在载入，请稍候。'});return}busy=true;const own=identity();try{
  if(d.view==='pick-location'){
   binding=null;
   if(!hex(d.interaction_id))throw Error('位置选择已失效。');selection={interaction_id:d.interaction_id}
   if(d.route_id)await openRow(await read(d.route_id));else if(frame){send('pick-location',selection)}else {await c.projects.getProjectList();const project=c.projects.currentProject?.id?c.projects.currentProject:c.projects.projectList[0];if(!project)throw Error('请先创建航线所属项目。');const fresh=copy(c.lanes.shipForm);await openRow({name:'新航线',project_id:project.id,kmz_json:fresh})}
  }else {selection=null;if(!hex(d.draft_id))throw Error('草稿标识无效。');const draft=await api('/prepared/'+d.draft_id);if(draft.kind!=='route'||!['prepared','submitted'].includes(draft.status))throw Error('请选择可核对的航线草稿。');const plan=draft.data,existing=plan.action==='update'?await read(plan.id):{};if(draft.status==='prepared'&&plan.action==='update'&&existing.revision!==plan.revision)throw Error('航线已被修改，请重新准备参数。');const row={...existing,...plan.data};if(draft.status==='prepared')binding={id:draft.id,routeId:row.id||null,identity:own};else binding=null;await openRow(row)}
  if(own!==identity())throw Error('登录状态已更新。');routeReply('native-navigated',{request_id:d.request_id,view:d.view})
 }catch(error){selection=null;binding=null;routeReply('native-navigation-error',{request_id:d.request_id,message:error.message})}finally{busy=false}}
 window.addEventListener('runhive-native-request',listen);return ()=>{window.removeEventListener('runhive-native-request',listen);if(context===c){context=null;binding=null;selection=null}}
}
