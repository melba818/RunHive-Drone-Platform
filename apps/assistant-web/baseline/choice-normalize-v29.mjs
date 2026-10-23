export const questionKey=q=>q.type==='resource'?'resource:'+q.source+':'+(q.source==='dataset_classes'?'dataset':''):q.type==='map_point'?'map_point':q.id
export function normalizeInteraction(input){
 const interaction=structuredClone(input),questions=[],seen=new Map(),aliases={...input.aliases};
 for(const q of interaction.questions){const key=questionKey(q);if(seen.has(key)){aliases[q.id]=seen.get(key).id;continue}if(q.options)q.options=q.options.filter((o,i,a)=>a.findIndex(v=>v.value===o.value)===i);if(q.groups)for(const k of Object.keys(q.groups))q.groups[k]=q.groups[k].filter((o,i,a)=>a.findIndex(v=>v.value===o.value)===i);seen.set(key,q);questions.push(q)}
 for(const q of questions)if(q.depends_on)q.depends_on=aliases[q.depends_on]||q.depends_on
 const axis=q=>{const s=(q.id+' '+q.title).toLowerCase();return /longitude|经度|(?:^|[ _])lng(?:$|[ _])|(?:^|[ _])lon(?:$|[ _])/.test(s)?'lng':/latitude|纬度|(?:^|[ _])lat(?:$|[ _])/.test(s)?'lat':null};
 const lng=questions.find(q=>axis(q)==='lng'),lat=questions.find(q=>axis(q)==='lat');
 if(lng&&lat){const index=Math.min(questions.indexOf(lng),questions.indexOf(lat));interaction.questions=questions.filter(q=>q!==lng&&q!==lat);interaction.questions.splice(index,0,{id:'map_reference',type:'map_point',title:'选择地图位置',required:lng.required||lat.required,coordinate_ids:{lng:lng.id,lat:lat.id}})}else interaction.questions=questions;
 interaction.aliases=aliases;return interaction
}
export function interactionKey(v){return v.goal+':'+v.questions.map(questionKey).join('|')}
export function carryAnswers(previous,next){const answers={};for(const q of next.questions){const old=previous.questions.find(p=>questionKey(p)===questionKey(q));if(old&&previous.answers[old.id]!=null)answers[q.id]=previous.answers[old.id]}return {...previous.snapshot(),answers,step:Math.min(previous.step,next.questions.length)}}
export function validMapPoint(p){return !!p&&typeof p==='object'&&[p.lat,p.lng].every(Number.isFinite)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180}
export function expandedAnswers(interaction,answers){const result={...answers};for(const q of interaction.questions)if(q.type==='map_point'&&validMapPoint(answers[q.id])){result[q.coordinate_ids.lng]=answers[q.id].lng;result[q.coordinate_ids.lat]=answers[q.id].lat;delete result[q.id]}for(const [alias,id] of Object.entries(interaction.aliases||{}))if(id in result)result[alias]=result[id];return result}
