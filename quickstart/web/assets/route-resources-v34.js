const id=v=>/^\d+$/.test(String(v||''))&&Number(v)>0?String(v):null;
const name=v=>{const n=String(v||'').trim();if(!n||n.length>100)throw Error('名称需为 1 至 100 个字符。');return n};
export async function routeResources(c,Backend,method,body={},assertCurrent=()=>{}){
 assertCurrent();
 const projects=async()=>{const r=await new Backend('/admin/Project/').index({limit:1000});assertCurrent();const rows=r.data?.list;if(!Array.isArray(rows))throw Error('项目列表未能读取。');return rows};
 const allowed=async value=>{const key=id(value),rows=await projects(),p=rows.find(p=>String(p.id)===key);if(!p)throw Error('请选择当前账号可访问的项目。');return p};
 const libraries=async p=>{const r=await new Backend('/admin/airline.Floder/').index({limit:1000,search:[{field:'project_id',val:p.id,operator:'='}]});assertCurrent();return (r.data?.list||[]).filter(f=>String(f.project_id)===String(p.id))};
 const publicProject=p=>({id:String(p.id),name:p.name,longitude:Number(p.longitude),latitude:Number(p.latitude)}),publicFolder=f=>({id:String(f.id),name:f.name,project_id:String(f.project_id)});
 if(method==='resources'){const rows=await projects();if(!body.project_id)return {projects:rows.map(publicProject)};const p=rows.find(p=>String(p.id)===id(body.project_id));if(!p)throw Error('项目已不可用，请重新选择。');return {projects:rows.map(publicProject),libraries:(await libraries(p)).map(publicFolder)}}
 if(method==='routes'){const owned=new Set((await projects()).map(p=>String(p.id))),r=await new Backend('/admin/Airline/').index({limit:1000});assertCurrent();return (r.data?.list||[]).filter(r=>owned.has(String(r.project_id))).map(r=>({id:String(r.id),name:r.name,project_id:String(r.project_id)}))}
 if(method==='create-project'){
  if(body.confirmed!==true)throw Error('请核对后点击创建项目。');const title=name(body.name),p=body.point;if(!p||![p.lat,p.lng].every(Number.isFinite)||Math.abs(p.lat)>85||Math.abs(p.lng)>180)throw Error('请先在地图上选择项目位置。');
  const old=new Set((await projects()).map(p=>String(p.id)));assertCurrent();await new Backend('/admin/Project/').add({name:title,introduction:String(body.introduction||'').slice(0,1000),longitude:p.lng,latitude:p.lat});const rows=await projects(),matches=rows.filter(p=>!old.has(String(p.id))&&p.name===title);if(matches.length!==1)throw Error('请刷新项目列表确认创建结果，再选择项目。');return {project:publicProject(matches[0]),projects:rows.map(publicProject)};
 }
 const p=await allowed(body.project_id);
 if(method==='create-library'){
  if(body.confirmed!==true)throw Error('请核对后点击创建航线库。');const title=name(body.name),old=new Set((await libraries(p)).map(f=>String(f.id)));assertCurrent();await new Backend('/admin/airline.Floder/').add({name:title,project_id:p.id});const rows=await libraries(p),matches=rows.filter(f=>!old.has(String(f.id))&&f.name===title);if(matches.length!==1)throw Error('请刷新航线库列表确认创建结果，再选择航线库。');return {library:publicFolder(matches[0]),libraries:rows.map(publicFolder)};
 }
 if(method==='select-resources'){
  const f=(await libraries(p)).find(f=>String(f.id)===id(body.library_id));if(!f)throw Error('请选择该项目中的航线库。');const rows=await projects();assertCurrent();c.projects.projectList=rows;c.projects.currentProject=p;await c.projects.getShipLanesFolderList();assertCurrent();if(String(c.projects.currentProject?.id)!==String(p.id))throw Error('项目已切换，请重新选择。');c.projects.currentShipLanesFolder=f;c.lanes.subForm={...c.lanes.subForm,project_id:p.id,airline_floder_id:f.id};return {project:publicProject(p),library:publicFolder(f)};
 }
 throw Error('资源操作不支持。');
}
