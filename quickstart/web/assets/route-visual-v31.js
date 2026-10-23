// Shared by the route library and editor. Heights stay in the route's original datum.
export function routeLineStyle(mars,positions,color='#409eff'){
 let metres=0;
 for(let i=1;i<positions.length;i++){
  const a=positions[i-1],b=positions[i],lat=(a[1]+b[1])*Math.PI/360;
  metres+=Math.hypot((b[0]-a[0])*111320*Math.cos(lat),(b[1]-a[1])*111320,b[2]-a[2]);
 }
 return {width:4,clampToGround:false,materialType:mars.MaterialType.LineFlow,materialOptions:{image:'/assets/route-dash-v31.png',color,speed:12,repeat:new mars.Cesium.Cartesian2(Math.max(2,Math.min(250,metres/24)),1)}};
}
export function groundLineStyle(mars){return {width:2,clampToGround:false,materialType:mars.MaterialType.PolylineDash,materialOptions:{color:'#ffffff',dashLength:14,dashPattern:255}}}
export function waypointStyle(index,chosen=false){return {pixelSize:chosen?17:12,color:chosen?'#096dd9':'#409eff',outlineColor:'#fff',outlineWidth:2,label:{text:String(index+1),font_size:15,color:'#00386d',outline:true,outlineColor:'#fff',outlineWidth:3,pixelOffsetY:-20}}}
