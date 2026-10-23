// Only existing, selected routes can take this deterministic navigation path.
export function selectedRouteId(flow,lastRouteId){
 if(flow?.interaction?.goal!=='routes'||flow.cancelled)return null;
 const question=flow.questions.find(q=>q.source==='routes');
 const value=question?flow.answers[question.id]:lastRouteId;
 if(!/^\d+$/.test(String(value||'')))return null;
 if(question&&!question.options?.some(o=>String(o.value)===String(value)))return null;
 return String(value);
}
export function canOpenRouteDirectly(flow,lastRouteId){
 const id=selectedRouteId(flow,lastRouteId);if(!id||flow.note?.trim())return false;
 return flow.questions.every(q=>{
  if(q.source==='routes')return true;
  const value=flow.answers[q.id];
  if(['modify_name','modify_kmz'].includes(q.id))return ['no','false','keep'].includes(String(value));
  if(['operation','action'].includes(q.id))return String(value)==='edit';
  return ['new_name','name','route_name'].includes(q.id)&&q.type==='text'&&!String(value??'').trim();
 });
}
