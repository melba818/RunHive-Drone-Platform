import {Ft,Pt,Se,Ie,ee,ke} from './route_core.mjs';
import fs from 'node:fs';
const contract=JSON.parse(fs.readFileSync(new URL('./route-contract.json',import.meta.url),'utf8'));
const invalid=(field,message,code='INVALID_VALUE')=>{const e=new Error(message);e.field=field;e.code=code;throw e;};
const number=(v,field)=>{if(typeof v==='string'&&v.trim()!==''&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v))v=Number(v);if(typeof v!=='number'||!Number.isFinite(v))invalid(field,'此字段须为有效数值。','INVALID_NUMBER');return v;};
try {
  const raw=fs.readFileSync(0,'utf8');
  if(Buffer.byteLength(raw)>contract.max_bytes) invalid('$','航线参数不能超过 4 MB。','TOO_LARGE');
  const data=JSON.parse(raw);
  const allowed=contract.create_fields;
  if(!data||Array.isArray(data)||Object.keys(data).some(k=>!allowed.includes(k))) throw new Error('航线参数无效。');
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>80||/[<>:"/\\|?*\x00-\x1f]/.test(data.name)||data.name.includes('..')) throw new Error('航线名称无效。');
  data.project_id=number(data.project_id,'project_id');
  if(!Number.isSafeInteger(data.project_id)||data.project_id<1) invalid('project_id','请选择有效项目。');
  if(!Array.isArray(data.waypoints)||data.waypoints.length<2||data.waypoints.length>contract.max_points) invalid('waypoints','航线需要 2 至 5000 个航点。');
  for(const [k,v] of Object.entries(data.settings??{})) if(['altitude_m','speed_mps','heading_deg','gimbal_pitch_deg','drone_enum','drone_sub_enum','payload_enum','payload_sub_enum'].includes(k))data.settings[k]=number(v,'settings.'+k);
  const draft=Ft({name:data.name,settings:data.settings??{},geometry:data.takeoff?{takeoff:data.takeoff}:{}});
  if(Object.keys(draft.settings).some(k=>!['altitude_m','speed_mps','heading_mode','heading_deg','gimbal_pitch_deg','altitude_mode','finish_action','drone_enum','drone_sub_enum','payload_enum','payload_sub_enum'].includes(k))) throw new Error('航线设置无效。');
  draft.waypoints=data.waypoints.map((p,i)=>{
    if(!p||Array.isArray(p)||Object.keys(p).some(k=>!['lng','lat','altitude_m','speed_mps','heading_deg','gimbal_pitch_deg','heading_mode','poi'].includes(k))) throw new Error('航点参数无效。');
    for(const k of ['lng','lat','altitude_m','speed_mps','heading_deg','gimbal_pitch_deg'])if(k in p)p[k]=number(p[k],`waypoints[${i}].${k}`);
    const base=Pt({lng:p.lng,lat:p.lat},draft.settings);
    return {...base,...p,id:base.id,actions:[]};
  });
  Se(draft); const metrics=ke(draft);
  process.stdout.write(JSON.stringify({name:data.name,project_id:data.project_id,template_xml:ee(draft),wayline_xml:ee(draft,true),kmz_json:Ie(draft),point_num:metrics.waypoint_count,total_point:metrics.waypoint_count,mileage:metrics.distance_m,execution_time:Math.ceil(metrics.duration_s)}));
} catch(e) { process.stderr.write(JSON.stringify({code:'VALIDATION_FAILED',message:'航线参数校验未通过。',errors:[{field:e.field??'waypoints',code:e.code??'INVALID_VALUE',message:String(e.message).slice(0,500)}]})); process.exitCode=1; }
