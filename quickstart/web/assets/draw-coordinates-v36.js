// Mars3D exports shape-dependent GeoJSON. Never treat the rectangle's two
// control points, a Feature array, or numeric-string coordinates as a ring.
const number=v=>typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN;
function point(v){const p=Array.isArray(v)?[number(v[0]),number(v[1])]:v&&[number(v.lng??v.longitude),number(v.lat??v.latitude)];return p&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85?p:null}
function coords(values){if(!Array.isArray(values))return null;const out=values.map(point);return out.every(Boolean)?out:null}
function geometries(json){if(Array.isArray(json))return json.flatMap(geometries);if(json?.geometry)return geometries(json.geometry);if(json?.type==='FeatureCollection')return json.features.flatMap(geometries);if(json?.type==='GeometryCollection')return json.geometries.flatMap(geometries);return json?.type&&json.coordinates?[json]:[]}
const read=(fn)=>{try{return fn()}catch{return undefined}};
function clean(line,closed){const out=[];for(const p of line)if(!out.length||Math.abs(out.at(-1)[0]-p[0])+Math.abs(out.at(-1)[1]-p[1])>1e-11)out.push(p);if(closed&&out.length>1&&Math.abs(out[0][0]-out.at(-1)[0])+Math.abs(out[0][1]-out.at(-1)[1])<1e-11)out.pop();if(new Set(out.map(p=>p.join(','))).size<(closed?3:2))return null;return closed?[...out,out[0].slice()]:out}
function rectangle(values){const p=coords(values);if(!p||p.length<2)return null;const xs=p.map(p=>p[0]),ys=p.map(p=>p[1]),west=Math.min(...xs),east=Math.max(...xs),south=Math.min(...ys),north=Math.max(...ys);if(east<=west||north<=south||east-west>180)return null;return [[west,south],[east,south],[east,north],[west,north],[west,south]]}
export function drawingCoordinates(graphic,type,mars){
 const json=read(()=>graphic.toGeoJSON({outline:true,closure:true,noAlt:true})),gs=geometries(json);
 // Native getters preserve the actual polygon/rectangle outline and avoid
 // GeoJSON formats that represent a shape by a point or two control points.
 let outline=read(()=>graphic.getOutlineCoordinates?.(true,true))||read(()=>graphic.outlineCoordinates);
 if(type==='rectangle'){
  let ring=coords(outline);if(ring&&ring.length>=3&&(ring=clean(ring,true)))return ring;
  const extent=read(()=>graphic.getRectangle?.({isFormat:true}));if(extent&&[extent.xmin,extent.ymin,extent.xmax,extent.ymax].every(v=>Number.isFinite(number(v)))){const r=rectangle([[extent.xmin,extent.ymin],[extent.xmax,extent.ymax]]);if(r)return r}
 }
 for(const g of gs){let values=g.type==='Polygon'?g.coordinates[0]:g.type==='MultiPolygon'?g.coordinates[0]?.[0]:g.type==='LineString'?g.coordinates:g.type==='MultiLineString'?g.coordinates[0]:null;if(type==='polyline'&&!['LineString','MultiLineString'].includes(g.type))continue;let p=coords(values);if(p){if(type==='rectangle'){if(p.length===2)p=rectangle(p);else p=clean(p,true)}else p=clean(p,type!=='polyline');if(p)return p}}
 let values=coords(read(()=>graphic.getCoord?.({noAlt:true})))||coords(read(()=>graphic.coordinates));
 if(type!=='polyline')values=coords(outline)||values;
 if(!values){const positions=type==='rectangle'?read(()=>graphic.outlinePositions)||read(()=>graphic.positionsShow):read(()=>graphic.positionsShow)||read(()=>graphic.positions);if(Array.isArray(positions))values=coords(positions.map(p=>read(()=>mars.LngLatPoint.fromCartesian(p))))}
 if(values){const result=type==='rectangle'?rectangle(values):clean(values,type!=='polyline');if(result)return result}
 throw Error(type==='polyline'?'手绘线段尚未完成，请选择至少两个地图点并双击结束。':'框选范围尚未完成，请重新选择矩形两个角点，或完成至少三个顶点的多边形。');
}
