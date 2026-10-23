import json,threading,pathlib
from agent_broker import ModelBroker,sse_chunks,decode_decision,validate_tools
b=ModelBroker('/providers.json',{'qwen':threading.Lock(),'vlx':threading.Lock()})
tool={'type':'function','function':{'name':'echo_fixture','description':'Echo text without side effects','parameters':{'type':'object','properties':{'text':{'type':'string'}},'required':['text'],'additionalProperties':False}}}
m=[{'role':'user','content':'请调用 echo_fixture，参数 text=runhive-fixture，收到工具返回内容后告知结果。'}]
r=b.complete({'model':'qwen','messages':m,'tools':[tool],'tool_choice':'auto','max_tokens':256})
call=r['choices'][0]['message']['tool_calls'][0]
args=json.loads(call['function']['arguments'])
assert args=={'text':'runhive-fixture'}
m.append(r['choices'][0]['message']);m.append({'role':'tool','tool_call_id':call['id'],'content':'runhive-fixture'})
f=b.complete({'model':'qwen','messages':m,'tools':[tool],'tool_choice':'auto','max_tokens':256})
assert f['choices'][0]['finish_reason']=='stop'
assert 'runhive-fixture' in f['choices'][0]['message']['content']
chunks=''.join(sse_chunks(r));assert 'tool_calls' in chunks and '[DONE]' in chunks
out={'first':r,'second':f,'sse_valid':True,'native_auto_supported':False,'adapter':'validated-json-decision','context_limit':8192}
pathlib.Path('/reports/qwen-adapter-verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({'status':'passed','tool':call['function']['name'],'arguments':args,'second_finish':f['choices'][0]['finish_reason'],'context_limit':8192}))