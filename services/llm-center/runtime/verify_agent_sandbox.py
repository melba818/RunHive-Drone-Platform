"""Real unprivileged subprocess sandbox checks (dummy credentials only)."""
import json
import os
import pathlib
import subprocess

def main():
    cases=[
        ('write_workspace',['/bin/sh','-c','printf verified > /workspace/sandbox-ok.txt'],0),
        ('read_workspace',['/bin/cat','/workspace/sandbox-ok.txt'],0),
        ('native_token',['/bin/cat','/data/api-token'],1),
        ('parent_environment',['/bin/cat','/proc/1/environ'],1),
        ('symlink_escape',['/bin/cat','/workspace/token-link'],1),
        ('node_native_token',['node','-e','require("fs").readFileSync("/data/api-token")'],1),
        ('server_environment',['/bin/sh','-c','env | grep -E "^(LLM_|PENGUIN_)"'],1),
    ]
    results=[]
    for name,argv,expected in cases:
        r=subprocess.run(['python3','/opt/runtime/agent_sandbox.py','--workspace','/workspace','--',*argv],capture_output=True,text=True,timeout=10)
        assert r.returncode==expected,(name,r.returncode,r.stderr[:200])
        assert 'FIXTURE_SECRET' not in r.stdout and 'FIXTURE_TOKEN' not in r.stdout
        results.append({'case':name,'code':r.returncode,'passed':True})
    env={**os.environ,'LLM_SANDBOX_FORCE_UNAVAILABLE':'1'}
    r=subprocess.run(['python3','/opt/runtime/agent_sandbox.py','--workspace','/workspace','--','/bin/sh','-c','touch /workspace/should-not-exist'],env=env,capture_output=True,text=True,timeout=10)
    assert r.returncode==126 and not pathlib.Path('/workspace/should-not-exist').exists()
    results.append({'case':'abi_unavailable_fail_closed','code':126,'passed':True})
    pathlib.Path('/workspace/sandbox-verification.json').write_text(json.dumps(results,indent=2))
    print(json.dumps({'passed':len(results),'landlock_real':True}))

if __name__=='__main__': main()
