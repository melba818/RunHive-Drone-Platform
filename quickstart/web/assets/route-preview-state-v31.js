import {fromDocument} from './route-contract-v31.js';
export function previewState(row){
 const empty={missionId:null,config:{},waypoints:[],pois:[],selected:[],tools:{addingWaypoint:false,addingPoi:false,template:null}};
 if(!row)return empty;
 try{const mission=fromDocument(row,{},{}),ref=String(mission.config._runhive.document.missionConfig.takeOffRefPoint||'').split(',');return {...empty,missionId:String(row.id),config:{heightMode:mission.config.heightMode,referenceHeight:ref[2]?Number(ref[2]):undefined},waypoints:mission.waypoints,pois:mission.pois}}catch{return empty}
}
