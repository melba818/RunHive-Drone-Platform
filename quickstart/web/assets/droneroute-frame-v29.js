import {m as h} from '/assets/vue-FCF7ynEj.js'
import {attachDroneRouteFrame} from './droneroute-host-v29.js'
export default {name:'DroneRouteOriginal',mounted(){this.cleanup=attachDroneRouteFrame(this.$refs.frame)},beforeUnmount(){this.cleanup?.()},render(){return h('iframe',{ref:'frame',src:'/droneroute-v29/index.html',title:'DroneRoute 航线规划',style:'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:80;background:white',allow:'fullscreen'})}}
