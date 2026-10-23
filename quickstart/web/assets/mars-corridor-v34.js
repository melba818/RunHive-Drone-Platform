// Adds temporary survey layers to the existing Mars3D map. Owns no map or tiles.
import {validPoint} from './corridor-plan-v34.js';
export function attachCorridor(map,mars,send){
 const draw=new mars.layer.GraphicLayer({name:'巡检范围与手工中心线'}),chosen=new mars.layer.GraphicLayer({name:'选中巡检地物'});map.addLayer(draw);map.addLayer(chosen);
 let vectors=[],collection={type:'FeatureCollection',features:[]},selected=new Set(),disposed=false,drawTask=null;
 const emit=()=>send('corridor-data',{collection,selected:[...selected]});
 function highlight(){chosen.clear();for(const f of collection.features)if(selected.has(String(f.id)))chosen.addGraphic(new mars.graphic.PolylineEntity({positions:f.geometry.coordinates,style:{color:'#ffee58',width:7,clampToGround:true},attr:{corridor_id:String(f.id)}}));emit()}
 function toggle(e){const id=e.graphic?.attr?.id||e.graphic?.attr?.corridor_id;if(!id||!collection.features.some(f=>String(f.id)===String(id)))return;selected.has(String(id))?selected.delete(String(id)):selected.add(String(id));highlight()}
 chosen.on(mars.EventType.click,toggle);
 function show(data){if(disposed)return;for(const l of vectors)map.removeLayer(l,true);vectors=[];collection=data;selected=new Set([...selected].filter(id=>data.features.some(f=>String(f.id)===id)));
  for(const [kind,color] of [['road','#ff981f'],['river','#00b9dd'],['manual','#9067e7']]){const features=data.features.filter(f=>f.properties.kind===kind);if(!features.length)continue;const layer=new mars.layer.GeoJsonLayer({name:kind==='road'?'OSM 道路':kind==='river'?'OSM 河流':'手工中心线',data:{type:'FeatureCollection',features},symbol:{type:'polyline',styleOptions:{color,width:4,clampToGround:true}},flyTo:false});layer.on(mars.EventType.click,toggle);map.addLayer(layer);vectors.push(layer)}highlight()
 }
 async function start(type){if(disposed)throw Error('地图已关闭。');cancel();const task={};drawTask=task;draw.clear();send('corridor-drawing',{active:true});try{
  const graphic=await Promise.race([draw.startDraw({type,style:{color:'#339dff',opacity:type==='polyline'?1:.16,width:4,outline:true,outlineColor:'#339dff',outlineWidth:2,clampToGround:true}}),new Promise((_,reject)=>{task.reject=reject})]);
  if(disposed||drawTask!==task)throw Error('已取消绘制。');const json=graphic.toGeoJSON(),geometry=json.geometry||json.features?.[0]?.geometry;
  const coords=type==='polyline'?geometry?.coordinates:geometry?.coordinates?.[0];if(!Array.isArray(coords)||!coords.every(validPoint))throw Error('未获取到有效 WGS84 地图位置，请重新绘制。');return coords.map(p=>p.slice(0,2))
 }finally{if(drawTask===task){drawTask=null;send('corridor-drawing',{active:false})}}}
 function cancel(){const task=drawTask;drawTask=null;task?.reject?.(Error('已取消绘制。'));draw.stopDraw();send('corridor-drawing',{active:false})}
 return {snapshot(){return {collection,selected:[...selected]}},manual(line,name){const id='manual-'+crypto.randomUUID();const f={type:'Feature',id,properties:{id,name,kind:'manual',source:'手工'},geometry:{type:'LineString',coordinates:line}};selected.add(id);show({...collection,features:[...collection.features,f]});return {id}},area:shape=>start(shape==='polygon'?'polygon':'rectangle'),line:()=>start('polyline'),show,select(ids){selected=new Set(ids.filter(id=>collection.features.some(f=>String(f.id)===String(id))).map(String));highlight()},remove(id){show({...collection,features:collection.features.filter(f=>String(f.id)!==String(id))})},cancel,clear(){cancel();draw.clear();show({type:'FeatureCollection',features:[]})},close(){disposed=true;cancel();chosen.off(mars.EventType.click,toggle);for(const l of [...vectors,draw,chosen])map.removeLayer(l,true);vectors=[]}}
}
