import {f as defineComponent,ap as inject,B as watch,R as onUnmounted,m as h} from './vue-FCF7ynEj.js';
import {av as useLanes} from './index-D5rXB33a.js';
import {m as mars} from './mars3d-D9h0wQWm.js';
import {attachMarsRoute} from './mars-route-v31.js';
import {previewState} from './route-preview-state-v31.js';
export const _=defineComponent({name:'RoutePreview',setup(){
 const map=inject('marsMap'),lanes=useLanes();let adapter,owner;
 const update=()=>{if(adapter)adapter.update(previewState(lanes.activeShipLanes?{...lanes.subForm,kmz_json:lanes.shipForm}:null))};
 const stopMap=watch(map,()=>{
  if(owner!==map.value){adapter?.close();owner=map.value;adapter=owner?attachMarsRoute(owner,mars,()=>{},{interactive:false,onRoutePositions:p=>{lanes.subForm.mileage=p.length>1?Number(mars.MeasureUtil.getDistance(p).toFixed(2)):0}}):null}
  update();
 },{immediate:true});
 const stop=watch(()=>[lanes.activeShipLanes,lanes.shipForm,lanes.subForm.id],update,{deep:true,immediate:true});
 onUnmounted(()=>{stop();stopMap();adapter?.close()});return ()=>h('span',{'aria-hidden':'true',class:'route-preview-controller'});
}});
