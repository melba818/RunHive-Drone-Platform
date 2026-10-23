// Pure interaction state, shared by the UI and contract tests.
export function optionsFor(question, answers){
  return question.groups ? question.groups[answers[question.depends_on]] || [] : question.options || []
}
export function validateAnswer(q,value,answers={}){
  const empty=value===undefined||value===null||String(value).trim()===''
  if(empty)return q.required?'请完成当前选择。':''
  if(q.type==='choice'||q.type==='resource'){
    if(optionsFor(q,answers).some(o=>o.value===String(value)))return ''
    if(q.type==='choice'&&q.allow_custom&&String(value).trim().length<=q.max_length)return ''
    return '所选资源已不可用，请重新选择。'
  }
  if(q.type==='number'){
    const n=Number(value)
    if(!Number.isFinite(n)||(q.integer&&!Number.isInteger(n)))return q.integer?'请输入整数。':'请输入有效数值。'
    if(q.minimum!=null&&n<q.minimum)return `数值不能小于 ${q.minimum}。`
    if(q.maximum!=null&&n>q.maximum)return `数值不能大于 ${q.maximum}。`
  }
  if(String(value).length>(q.max_length||240))return '内容过长，请精简后继续。'
  return ''
}
export class ChoiceFlow {
  constructor(interaction,saved={}){
    this.interaction=interaction;this.answers={...saved.answers};this.note=String(saved.note||'').slice(0,1000)
    this.step=Math.max(0,Math.min(Number(saved.step)||0,interaction.questions.length));this.confirmed=!!saved.confirmed;this.cancelled=!!saved.cancelled
    for(const q of interaction.questions)if(this.answers[q.id]!=null&&validateAnswer(q,this.answers[q.id],this.answers))delete this.answers[q.id]
  }
  get questions(){return this.interaction.questions}
  set(id,value){
    this.answers[id]=value
    for(const q of this.questions)if(q.depends_on===id&&validateAnswer(q,this.answers[q.id],this.answers))delete this.answers[q.id]
  }
  error(){return this.step<this.questions.length?validateAnswer(this.questions[this.step],this.answers[this.questions[this.step].id],this.answers):this.questions.map(q=>validateAnswer(q,this.answers[q.id],this.answers)).find(Boolean)||''}
  next(){const error=this.error();if(error)return error;this.step=Math.min(this.step+1,this.questions.length);return ''}
  back(){this.step=Math.max(0,this.step-1)}
  summary(){return this.questions.map(q=>({id:q.id,title:q.title,value:this.answers[q.id]??'',label:optionsFor(q,this.answers).find(o=>o.value===String(this.answers[q.id]))?.label||String(this.answers[q.id]??'未填写')}))}
  snapshot(){return {answers:this.answers,step:this.step,confirmed:this.confirmed,cancelled:this.cancelled,note:this.note}}
  reply(){const next=this.answers.next_action;const instruction=next==='later'?'保留标注结果，暂不准备训练参数，也不要启动任务。':next==='review'?'请打开标注复核入口，不准备训练或启动任务。':'请依照以上选择继续准备参数，展示最终草稿供我确认执行。';return '已确认选择：'+this.summary().map(a=>a.title+'：'+a.label).join('；')+'。\n\n[已确认的分步选择]\n'+JSON.stringify({interaction_id:this.interaction.id,goal:this.interaction.goal,title:this.interaction.title,source_draft:this.interaction.source_draft||null,answers:this.answers,note:this.note,confirmation:'prepare_only'})+'\n'+instruction}
}
export function displayText(text,role='assistant'){
  text=String(text||'').split('\n\n[页面上下文，仅供定位]\n')[0]
  if(role==='user')return text.split('\n\n[已确认的分步选择]\n')[0]
  if(/^\s*(\[summary\]|\[context summary\]|<summary>|Summarize the task transcript|The user wants me to summarize)/i.test(text))return ''
  if(/^\s*[{[]/.test(text)){try{const parsed=JSON.parse(text);if(parsed&&typeof parsed==='object')return ''}catch{}}
  return text.trim()
}
export function conciseText(text){
  if(text.length<=360&&text.split('\n').length<=6)return {brief:text,detail:''}
  let end=text.lastIndexOf('。',320)+1
  if(end<80)end=Math.min(280,text.length)
  return {brief:text.slice(0,end),detail:text.slice(end).trim()}
}
export class TranscriptGate {
  constructor(){this.compacting=false}
  accept(payload){
    if(payload.type==='compaction_begin'){this.compacting=true;return false}
    if(payload.type==='compaction_end'){this.compacting=false;return false}
    if(this.compacting)return false
    if(payload.type==='text'&&payload.role==='assistant')return !!displayText(payload.text)
    return true
  }
}
