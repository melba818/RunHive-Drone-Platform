// Data adapter only. DroneRoute's editors, store, map, templates and actions stay upstream.
export const clone=v=>JSON.parse(JSON.stringify(v))
const array=v=>v==null?[]:Array.isArray(v)?v:[v]
const num=(v,f=0)=>v==null||v===''?f:Number.isFinite(Number(v))?Number(v):f
const flag=(v,f=false)=>v==null?f:v===true||v===1||v==='1'
const actionTypes=new Set(['takePhoto','startRecord','stopRecord','gimbalRotate','gimbalEvenlyRotate','rotateYaw','hover','zoom','focus'])
const numericParams=new Set(['payloadPositionIndex','gimbalPitchRotateAngle','gimbalYawRotateAngle','gimbalRollRotateAngle','gimbalRotateTime','aircraftHeading','hoverTime','focalLength','focusX','focusY','gimbalPitchRotateEnable','gimbalRollRotateEnable','gimbalYawRotateEnable','gimbalRotateTimeEnable'])
function params(raw){const p=clone(raw||{});for(const k of Object.keys(p)){if(numericParams.has(k))p[k]=num(p[k]);if(['isPointFocus','isInfiniteFocus'].includes(k))p[k]=flag(p[k])}return p}
export function fromDocument(row,defaults,defaultWaypoint){
 const doc=typeof row.kmz_json==='string'?JSON.parse(row.kmz_json):clone(row.kmz_json)
 if(!doc?.missionConfig||!Array.isArray(doc?.Folder?.Placemark))throw Error('航线内容不完整。')
 const mc=doc.missionConfig,f=doc.Folder,pois=clone(doc.droneroute?.pois||[])
 const config={...defaults,droneEnumValue:num(mc.droneInfo?.droneEnumValue,defaults.droneEnumValue),droneSubEnumValue:num(mc.droneInfo?.droneSubEnumValue,defaults.droneSubEnumValue),payloadEnumValue:num(mc.payloadInfo?.payloadEnumValue,defaults.payloadEnumValue)}
 for(const k of ['flyToWaylineMode','finishAction','exitOnRCLost','executeRCLostAction'])if(mc[k]!=null)config[k]=mc[k]
 for(const k of ['takeOffSecurityHeight','globalTransitionalSpeed'])config[k]=num(mc[k],defaults[k])
 config.autoFlightSpeed=num(f.autoFlightSpeed,defaults.autoFlightSpeed);config.heightMode=f.waylineCoordinateSysParam?.heightMode||(f.executeHeightMode==='WGS84'?'EGM96':'relativeToStartPoint');config.globalHeadingMode=f.globalWaypointHeadingParam?.waypointHeadingMode||defaults.globalHeadingMode;config.globalTurnMode=f.globalWaypointTurnMode||defaults.globalTurnMode;config.gimbalPitchMode=f.gimbalPitchMode||defaults.gimbalPitchMode
 config._runhive={document:doc,revision:row.revision,id:String(row.id||''),project_id:row.project_id,airline_floder_id:row.airline_floder_id||0}
 const waypoints=f.Placemark.map((p,i)=>{
  const [longitude,latitude]=String(p.Point?.coordinates||'').split(',').map(Number)
  if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>90)throw Error(`航点 ${i+1} 的位置无效。`)
  const heading=p.waypointHeadingParam||f.globalWaypointHeadingParam||{},turn=p.waypointTurnParam||{}
  const actions=[],hidden=[];for(const [gi,g] of array(p.actionGroup).entries())for(const [ai,a] of array(g.action).entries()){
   const record={actionId:actions.length,actionType:a.actionActuatorFunc,params:params(a.actionActuatorFuncParam),_runhive:{group:gi,order:ai,original:clone(a)}}
   if(actionTypes.has(record.actionType))actions.push(record);else hidden.push(record)
  }
  let poiId;if(heading.waypointHeadingMode==='towardPOI'&&heading.waypointPoiPoint){const [lat,lng,h]=String(heading.waypointPoiPoint).split(',').map(Number);if(Number.isFinite(lat)&&Number.isFinite(lng)){const found=pois.find(p=>p.latitude===lat&&p.longitude===lng);poiId=found?.id||'poi-'+i;if(!found)pois.push({id:poiId,name:'兴趣点 '+(pois.length+1),latitude:lat,longitude:lng,height:num(h)})}}
  const wp={...defaultWaypoint,index:i,name:String(p.name||'航点 '+(i+1)),longitude,latitude,height:num(p.executeHeight??p.height??p.ellipsoidHeight,num(f.globalHeight,50)),speed:num(p.waypointSpeed,config.autoFlightSpeed),useGlobalSpeed:flag(p.useGlobalSpeed),useGlobalHeight:flag(p.useGlobalHeight),useGlobalHeadingParam:flag(p.useGlobalHeadingParam??p.useGlobalHeading,true),useGlobalTurnParam:flag(p.useGlobalTurnParam,true),headingMode:heading.waypointHeadingMode,headingAngle:num(heading.waypointHeadingAngle),turnMode:turn.waypointTurnMode||config.globalTurnMode,turnDampingDist:num(turn.waypointTurnDampingDist),gimbalPitchAngle:num(p.gimbalPitchAngle,-45),actions,...poiId?{poiId}:{} }
  wp._runhive={placemark:clone(p),index:i,actions:clone(actions),hidden};return wp
 })
 return {id:String(row.id||''),name:String(row.name||'新航线'),createdAt:new Date(num(row.create_time,Date.now()/1000)*1000).toISOString(),updatedAt:new Date(num(row.update_time,Date.now()/1000)*1000).toISOString(),config,waypoints,pois}
}
export function mergeDocument(mission,generated){
 const meta=mission.config._runhive,baseline=clone(meta?.document||{}),doc={...baseline,...clone(generated)}
 doc.missionConfig={...baseline.missionConfig,...generated.missionConfig,droneInfo:{...baseline.missionConfig?.droneInfo,...generated.missionConfig?.droneInfo},payloadInfo:{...baseline.missionConfig?.payloadInfo,...generated.missionConfig?.payloadInfo}}
 doc.Folder={...baseline.Folder,...generated.Folder,waylineCoordinateSysParam:{...baseline.Folder?.waylineCoordinateSysParam,...generated.Folder?.waylineCoordinateSysParam}}
 for(const key of ['globalWaypointHeadingParam','payloadParam'])if(baseline.Folder?.[key]||generated.Folder?.[key])doc.Folder[key]={...baseline.Folder?.[key],...generated.Folder?.[key]}
 if(baseline.Folder?.globalWaypointHeadingParam?.waypointHeadingPathMode)doc.Folder.globalWaypointHeadingParam.waypointHeadingPathMode=baseline.Folder.globalWaypointHeadingParam.waypointHeadingPathMode
 if(baseline.missionConfig?.payloadInfo?.payloadPositionIndex!=null)doc.missionConfig.payloadInfo.payloadPositionIndex=baseline.missionConfig.payloadInfo.payloadPositionIndex
 doc.Folder.Placemark=mission.waypoints.map((wp,i)=>{
  const old=wp._runhive?.placemark||{},gen=generated.Folder.Placemark[i],p={...clone(old),...clone(gen)};p.index=i;p.name=wp.name
  for(const k of ['Point','waypointHeadingParam','waypointTurnParam'])if(old[k]||gen[k])p[k]={...clone(old[k]||{}),...clone(gen[k]||{})}
  // A global setting can omit a per-point field from upstream XML. Clear stale overrides.
  p.waypointSpeed=wp.useGlobalSpeed?mission.config.autoFlightSpeed:wp.speed
  p.executeHeight=wp.height
  delete p.useGlobalHeading
  if(wp._runhive&&wp.height!==num(old.executeHeight??old.height??old.ellipsoidHeight,wp.height))p.useGlobalHeight=0
  if(old.waypointHeadingParam?.waypointHeadingPathMode)p.waypointHeadingParam.waypointHeadingPathMode=old.waypointHeadingParam.waypointHeadingPathMode
  const generatedActions=array(gen.actionGroup).flatMap(g=>array(g.action))
  const serialized=a=>{const generatedAction=generatedActions.find(v=>num(v.actionId)===a.actionId);const param={...clone(a._runhive?.original?.actionActuatorFuncParam||{}),...clone(generatedAction?.actionActuatorFuncParam||{}),...clone(a.params)};for(const k of ['isPointFocus','isInfiniteFocus'])if(k in param)param[k]=flag(param[k])?1:0;return {...clone(a._runhive?.original||{}),actionId:a.actionId,actionActuatorFunc:a.actionType,actionActuatorFuncParam:param}}
  const groups=[];for(const [gi,g] of array(old.actionGroup).entries()){
   const records=[...wp.actions.filter(a=>a._runhive?.group===gi),...(wp._runhive?.hidden||[]).filter(a=>a._runhive.group===gi)].sort((a,b)=>a._runhive.order-b._runhive.order)
   const kept=records.map(a=>actionTypes.has(a.actionType)?serialized(a):clone(a._runhive.original))
   if(kept.length){const copy=clone(g),shift=i-wp._runhive.index;copy.actionGroupStartIndex=num(copy.actionGroupStartIndex)+shift;copy.actionGroupEndIndex=num(copy.actionGroupEndIndex)+shift;if(copy.actionGroupEndIndex>=mission.waypoints.length||copy.actionGroupStartIndex<0)throw Error('航点顺序改变后，原动作组范围已不适用，请检查动作。');copy.action=kept;groups.push(copy)}
  }
  let nextGroup=Math.max(-1,...groups.map(g=>num(g.actionGroupId)))+1
  const fresh=wp.actions.filter(a=>!a._runhive);for(const smooth of [false,true]){const actions=fresh.filter(a=>(a.actionType==='gimbalEvenlyRotate')===smooth);if(!actions.length)continue;if(smooth&&i===mission.waypoints.length-1)throw Error('最后一个航点不能添加相邻航点间的云台平滑动作。');groups.push({actionGroupId:nextGroup++,actionGroupStartIndex:i,actionGroupEndIndex:smooth?i+1:i,actionGroupMode:'sequence',actionTrigger:{actionTriggerType:smooth?'betweenAdjacentPoints':'reachPoint'},action:actions.map(serialized)})}
  if(groups.length)p.actionGroup=groups.length===1?groups[0]:groups;else delete p.actionGroup
  if(wp.poiId){const poi=mission.pois?.find(p=>p.id===wp.poiId);if(poi)p.waypointHeadingParam={...p.waypointHeadingParam,waypointPoiPoint:`${poi.latitude},${poi.longitude},${poi.height}`}}
  return p
 })
 doc.shipLanes=mission.waypoints.map(w=>[w.longitude,w.latitude,w.height]);doc.shipStartPoint=baseline.shipStartPoint||[]
 doc.droneroute={version:'0.5.0',pois:clone(mission.pois||[])};delete doc.routePlanner
 return doc
}
