"""Actual native default-project, temporary workspace and Qwen file-tool acceptance."""
import json
import os
import pathlib
import time
import urllib.error
import urllib.request

stage=pathlib.Path(os.environ['LLM_TEST_STAGE'])
meta=json.loads((stage/'runtime-test-agent.json').read_text())
headers={'Authorization':'Bearer '+meta['native_token'],'X-LLM-Instance-Key':meta['instance_key'],'Content-Type':'application/json'}
def request(method,path,body=None):
    req=urllib.request.Request(meta['base_url']+path,json.dumps(body).encode() if body is not None else None,headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(str(e.code)+' '+e.read(1500).decode()) from None

session=request('POST','/api/projects/default_project/agents/default_agent/sessions',{'approvalMode':'allow-all'})['session']
sid=session['sessionId'];workspace=session['workspace']
assert workspace.startswith('/workspace/.agent-workspaces/')
print('created',sid,'workspace',workspace,flush=True)
request('POST','/api/sessions/'+sid+'/tasks',{'input':[{'type':'text','text':'请在当前工作目录创建 acceptance.txt，文件内容严格为 Runhive Agent 验收通过，然后调用 read_file 读回确认内容。不要运行 shell，不要联网，不要改其他文件。完成后用中文告知结果。'}]})
deadline=time.time()+180
while time.time()<deadline:
    info=request('GET','/api/sessions/'+sid)['session']
    if info['status']=='idle':break
    time.sleep(2)
messages=request('GET','/api/sessions/'+sid+'/messages')
serialized=json.dumps(messages,ensure_ascii=False)
assert meta['native_token'] not in serialized and meta['instance_key'] not in serialized
file=stage/'runtime-test-state/agents'/f'admin-{meta["tenant_id"]}'/'workspace'/pathlib.Path(workspace).relative_to('/workspace')/'acceptance.txt'
record={'session_id':sid,'workspace':workspace,'status':info['status'],'file_exists':file.exists(),'file_content':file.read_text() if file.exists() else None,'messages':messages,'native_auto_supported':False,'broker_adapter':'validated-json-decision'}
(stage/'runtime/agent-native-file-verification.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in record.items() if k!='messages'},ensure_ascii=False))
if not file.exists(): print(serialized[-3500:])
assert file.exists() and file.read_text().strip()=='Runhive Agent 验收通过'
assert 'tool_call' in serialized and 'read_file' in serialized
