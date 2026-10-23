import {d as defineStore,q as ref} from './vue-FCF7ynEj.js';
import {W as BackendApi,u as useAdminInfo} from './index-D5rXB33a.js';
import {projectLoader} from './project-load-v33.js';
const useProject=defineStore('project',()=>{
 const isShowProject=ref(true),projectList=ref([]),currentProject=ref(null),aerodromeList=ref([]),addProjectPop=ref(false),addProjectPopType=ref('add'),shipLanesFolderList=ref([]),currentShipLanesFolder=ref(null);
 const account=()=>{const a=useAdminInfo();return {identity:`${a.id}:${a.token}`}};
 const scope=()=>({...account(),project_id:currentProject.value?.id});
 const getProjectList=projectLoader(account,()=>new BackendApi('/admin/Project/').index(),r=>{projectList.value=r.data.list});
 const getAerodromeList=projectLoader(scope,s=>new BackendApi('/admin/Equipment/').index({search:[{field:'project_id',val:s.project_id,operator:'='}]}),r=>{aerodromeList.value=r.data.list});
 const getShipLanesFolderList=projectLoader(scope,s=>new BackendApi('/admin/airline.Floder/').index({search:[{field:'project_id',val:s.project_id,operator:'='}]}),r=>{shipLanesFolderList.value=r.data.list});
 return {isShowProject,projectList,currentProject,addProjectPop,aerodromeList,shipLanesFolderList,currentShipLanesFolder,addProjectPopType,getProjectList,
  searchProject:async name=>{const own=account().identity,r=await new BackendApi('/admin/Project/').index({search:[{field:'name',val:name,operator:'LIKE'}]});if(own===account().identity)projectList.value=r.data.list},
  getAerodromeList,getShipLanesFolderList,submitProjectSuccess:async()=>{await getProjectList()},
  reset:()=>{getProjectList.invalidate();getAerodromeList.invalidate();getShipLanesFolderList.invalidate();isShowProject.value=true;currentProject.value=null;addProjectPop.value=false}
 };
});
export {useProject as u};
