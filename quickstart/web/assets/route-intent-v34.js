const number=v=>/^\d+$/.test(v)?Number(v):({'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'第一个':1}[v]);
export function routeIntent(text,context={}){
 const t=String(text||'').trim();if(!t||t.startsWith('[已确认')||/^(为什么|怎么回事|是否|能不能介绍)/.test(t))return null;
 const related=/道路|公路|航线|航点|起飞点|巡检|巡查|河流|河道/.test(t)||context.stage&&/继续|下一步|保存|动作|拍照|录像|模板/.test(t);if(!related)return null;
 const m=t.match(/航点\s*([\d一二三四五六七八九十]+)|第([\d一二三四五六七八九十]+)个航点/),waypoint=m?number(m[1]||m[2]):undefined;
 const create=/创建|新建|规划|设计/.test(t)&&/航线|巡检|巡查/.test(t)||/沿.{0,20}(河|岸|道路|管线).{0,20}(巡检|巡查)/.test(t)||/自动.{0,10}(生成|规划).{0,10}航线/.test(t);
 const operation=/位置|移动|挪|选点|坐标/.test(t)&&m?'position':/动作|拍照|录像|悬停|云台|变焦|对焦/.test(t)?'actions':/删除|移除/.test(t)&&m?'delete':/排序|顺序|前移|后移/.test(t)?'reorder':/新增|添加/.test(t)&&/航点/.test(t)?'add':/模板/.test(t)?'template':/高度|速度|参数|航向|返航/.test(t)?'parameters':/起飞|参考点/.test(t)?'reference':/保存|完成|核对/.test(t)?'review':'choose';
 if(!create&&!/编辑|修改|调整|继续|添加|新增|删除|移除|排序|设置|保存|完成|核对|使用|选择|我要|想要|帮我/.test(t))return null;
 const goal=/河流|河道|沿河|沿.{0,10}河|河岸/.test(t)?'river':/道路|管线|走廊/.test(t)?'corridor':/区域|网格|测绘/.test(t)?'survey':/建筑|立面/.test(t)?'facade':/环绕|绕飞/.test(t)?'orbit':'custom';
 return {task:create?'create':'edit',operation: create?'choose':operation,waypoint,goal,objective:t.slice(0,500)};
}
export function createRouteChoice(flow){return !flow.cancelled&&!flow.questions.some(q=>q.source==='routes')&&/创建|新建|规划/.test(flow.interaction.title||'')&&['routes','other'].includes(flow.interaction.goal)}
export function seedFromChoice(flow){const out={task:'create',operation:'choose',goal:'custom',objective:flow.note||flow.interaction.title};for(const q of flow.questions){const v=flow.answers[q.id];if(q.type==='map_point'&&v)out.point=v;else if(/name|名称/.test(q.id+' '+q.title)&&typeof v==='string')out.name=v}return out}
