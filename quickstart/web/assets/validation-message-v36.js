const names={name:'航线名称',project_id:'所属项目',airline_floder_id:'航线库',revision:'航线版本',longitude:'经度',latitude:'纬度',executeHeight:'航点高度',height:'高度',waypointSpeed:'飞行速度',autoFlightSpeed:'全局速度',gimbalPitchAngle:'云台俯角',takeOffRefPoint:'起飞参考点'};
export function validationMessage(value,fallback='航线操作未完成。'){
 const detail=value?.detail??value?.data??value,base=typeof detail==='string'?detail:detail?.message||value?.message||value?.msg||fallback;
 const errors=detail?.errors||value?.errors;
 if(!Array.isArray(errors)||!errors.length)return String(base);
 const fields=errors.slice(0,8).map(e=>{const field=String(e.field||''),point=field.match(/Placemark\[(\d+)\]/),key=field.split(/[.\[]/).filter(Boolean).at(-1)?.replace(/\]$/,''),label=point?`航点 ${Number(point[1])+1} · ${names[key]||key}`:names[field]||names[key]||field;return `${label}：${String(e.message||'请检查此参数。')}`});
 return [...new Set(fields)].join('\n');
}
