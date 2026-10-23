import {W as BackendApi,u as useAdminInfo} from '/assets/index-D5rXB33a.js'
const BASE='/llm-center/agent/platform'
let binding=null
const copy=value=>JSON.parse(JSON.stringify(value))
async function api(path,method='GET',body){
  const account=useAdminInfo(),identity=`${account.id}:${account.token}`;let csrf=''
  if(method!=='GET'){const r=await fetch(BASE+'/session',{credentials:'same-origin',cache:'no-store'}),s=await r.json();if(!r.ok||s.tenant_id!==Number(account.id))throw Error('助手登录已更新，请重新连接。');csrf=s.csrf}
  const r=await fetch(BASE+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(csrf?{'X-Platform-CSRF':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  const value=await r.json();if(identity!==`${account.id}:${account.token}`)throw Error('登录状态已更新。');if(!r.ok)throw Error(value.message||value.detail?.message||value.detail||'航线操作未完成。');return value
}
export const hasRouteAssistant=()=>!!binding
export async function saveAssistantRoute(payload){
  const b=binding;if(!b)throw Error('请重新打开航线参数。')
  const account=useAdminInfo();if(b.identity!==`${account.id}:${account.token}`)throw Error('登录状态已更新。')
  let draft=await api('/prepared/'+b.id)
  if(draft.status==='submitted'){b.onSaved();return {code:1,data:draft.result}}
  if(draft.status!=='prepared')throw Error('此航线草稿状态待核查，请查看任务记录。')
  const data={...draft.data,data:{name:payload.name,project_id:payload.project_id,airline_floder_id:payload.airline_floder_id,kmz_json:payload.kmz_json}}
  draft=await api('/prepared/'+b.id,'PUT',{revision:draft.revision,data})
  draft=await api('/prepared/'+b.id+'/execute','POST',{revision:draft.revision})
  if(binding===b)b.onSaved()
  return {code:1,data:draft.result}
}
export function attachRouteAssistant(ctx){
  const account=useAdminInfo(),channel=crypto.randomUUID().replaceAll('-','');let busy=false,guide=null
  const active=()=>ctx.root()?.getBoundingClientRect().width>100&&ctx.root()?.getBoundingClientRect().height>100
  const identity=()=>`${account.id}:${account.token}`
  const reply=(type,data={})=>window.dispatchEvent(new CustomEvent('runhive-native-response',{detail:{source:'runhive-native-page',kind:'route',type,admin_id:Number(account.id),channel,...data}}))
  const remove=()=>{guide?.remove();guide=null;ctx.root()?.classList.remove('rh-route-assistant-active');binding=null}
  const show=(text,restore)=>{
    remove();const parent=ctx.root();guide=document.createElement('div');guide.className='rh-route-assistant-guide';guide.setAttribute('role','region');guide.setAttribute('aria-label','航线参数引导')
    const strong=document.createElement('strong');strong.textContent='航线参数核对';const message=document.createElement('span');message.textContent=text;guide.append(strong,message)
    for(const [label,callback] of [['恢复回填前的参数',restore],['暂停引导',remove]]){const button=document.createElement('button');button.textContent=label;button.onclick=callback;guide.append(button)}
    parent.append(guide);parent.classList.add('rh-route-assistant-active');return message
  }
  const listen=async event=>{
    const d=event.detail;if(!active()||!account.token||d?.source!=='runhive-platform-assistant'||d.kind!=='route'||d.admin_id!==Number(account.id))return
    if(d.type==='native-ping'){reply('native-ready');return}
    if(d.type!=='native-nav'||d.channel!==channel||d.view!=='edit'||!/^[a-f0-9]{32}$/.test(d.draft_id||'')||!/^[a-f0-9]{32}$/.test(d.request_id||''))return
    if(busy){reply('native-navigation-error',{request_id:d.request_id,message:'航线正在载入，请稍候。'});return}
    busy=true;const own=identity()
    try{
      const draft=await api('/prepared/'+d.draft_id);if(draft.kind!=='route'||!['prepared','submitted'].includes(draft.status))throw Error('请选择可核对的航线草稿。')
      if(ctx.planner.dirty&&!await ctx.planner.close())throw Error('已保留当前未保存的航线，请保存后再打开草稿。')
      const plan=draft.data;let row,doc
      if(plan.action==='update'){
        if(!/^\d+$/.test(String(plan.id)))throw Error('航线标识无效。')
        const result=await new BackendApi('/admin/Airline/').edit({id:plan.id});row=result.data?.row
        if(!row)throw Error('航线已不可用。')
        if(draft.status==='prepared'&&row.revision!==plan.revision)throw Error('航线已被修改，请重新准备参数。')
        row={...row,...plan.data};doc=typeof row.kmz_json==='string'?JSON.parse(row.kmz_json):row.kmz_json
      }else{row={...plan.data};doc=row.kmz_json}
      if(!doc?.missionConfig||!Array.isArray(doc?.Folder?.Placemark))throw Error('航线内容不完整，请重新读取。')
      await ctx.projects.getProjectList();const project=ctx.projects.projectList.find(p=>String(p.id)===String(row.project_id));if(!project)throw Error('当前账号无法打开该航线所属项目。')
      const start=Date.now();while(!ctx.map()&&Date.now()-start<30000)await new Promise(r=>setTimeout(r,150));if(!ctx.map())throw Error('地图尚未加载完成，请稍后重试。')
      if(own!==identity()||!active())throw Error('页面或登录状态已更新。')
      const previous={project:ctx.projects.currentProject,showProject:ctx.projects.isShowProject,left:ctx.left.value,tab:ctx.tab.value,mode:ctx.mode.value,form:copy(ctx.lanes.shipForm),meta:copy(ctx.lanes.subForm),route:ctx.planner.route?copy(ctx.planner.route):null,dirty:ctx.planner.dirty}
      ctx.projects.currentProject=project;ctx.projects.isShowProject=false;ctx.left.value=true;ctx.tab.value=2;await ctx.nextTick()
      await ctx.projects.getShipLanesFolderList()
      ctx.lanes.showShipForm(copy(doc));ctx.lanes.subForm={id:row.id||'',name:row.name,project_id:row.project_id,airline_floder_id:row.airline_floder_id||'',scene:row.scene||'0',type:row.type||'0',revision:row.revision}
      ctx.mode.value=plan.action==='update'?'edit':'add';await ctx.nextTick()
      const payload=doc.missionConfig.payloadInfo||{},drone=doc.missionConfig.droneInfo||{}
      ctx.planner.begin(copy(doc),{...ctx.lanes.subForm},{drone_enum:Number(drone.droneEnumValue),drone_sub_enum:Number(drone.droneSubEnumValue),payload_enum:Number(payload.payloadEnumValue),payload_sub_enum:Number(payload.payloadSubEnumValue??0)})
      // The original watcher initializes the original planner, including actions.
      if(!ctx.planner.route||ctx.planner.error)throw Error(ctx.planner.error||'航线编辑器未能载入参数。')
      const point=ctx.planner.route.waypoints?.[0];if(point)ctx.map().flyToPoint([point.lng,point.lat,Math.max(300,point.altitude_m+200)])
      const message=show('航线已载入。请检查地图、航点、动作及高级设置，再点击原编辑器的“保存”。',async()=>{
        if(ctx.planner.dirty&&!await ctx.planner.close())return
        remove();ctx.projects.currentProject=previous.project;ctx.projects.isShowProject=previous.showProject;ctx.left.value=previous.left;ctx.tab.value=previous.tab;ctx.lanes.showShipForm(previous.form);ctx.lanes.subForm=previous.meta;ctx.mode.value=previous.mode;await ctx.nextTick();ctx.planner.route=previous.route;ctx.planner.dirty=previous.dirty
      })
      if(draft.status==='prepared')binding={id:draft.id,identity:own,onSaved:()=>{message.textContent='航线已保存。可继续在当前页面查看；再次修改前请重新打开航线。';binding=null}}
      else message.textContent='此航线已保存，当前显示实际航线供查看。'
      reply('native-navigated',{request_id:d.request_id,view:'edit'})
    }catch(error){reply('native-navigation-error',{request_id:d.request_id,message:error.message})}finally{busy=false}
  }
  window.addEventListener('runhive-native-request',listen)
  return ()=>{window.removeEventListener('runhive-native-request',listen);remove()}
}
