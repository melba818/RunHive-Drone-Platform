"""Independent account Agent instances; the original Factory registry stays intact."""
from __future__ import annotations
import hmac
import os
import json
import re
import secrets
import time
from pathlib import Path
import httpx
from fastapi import HTTPException

class AgentRuntime:
    def __init__(self,root,host_root,db,docker,inspect,lock):
        self.root=Path(root);self.host_root=Path(host_root);self.db=db
        self.docker=docker;self.inspect=inspect;self.lock=lock
        with db() as c:
            c.execute('CREATE TABLE IF NOT EXISTS agent_instances(tenant INTEGER PRIMARY KEY,port INTEGER UNIQUE NOT NULL,instance_key TEXT NOT NULL,broker_key TEXT NOT NULL,seed_password TEXT NOT NULL,name TEXT NOT NULL,created REAL NOT NULL)')

    def authorize(self,request,tenant):
        with self.db() as c:
            row=c.execute('SELECT broker_key FROM agent_instances WHERE tenant=?',(tenant,)).fetchone()
        auth=request.headers.get('authorization','')
        if not row or not hmac.compare_digest(auth,'Bearer '+row[0]):
            raise HTTPException(403,'智能体模型访问认证失败。')

    def seed_config(self,path,tenant,row):
        config=path/'data/default_project/.project_config.toml'
        if config.exists(): return
        config.parent.mkdir(parents=True,exist_ok=True)
        url=f"http://host.docker.internal:{os.getenv('LLM_CONTROL_PORT','4021')}/broker/{tenant}/v1"
        text='\n'.join([
            'name = "默认项目"',
            'default_model = { provider = "runhive", model_id = "qwen" }',
            'vision_model = { provider = "runhive", model_id = "qwen" }',
            '[default_chat]','workspace = "/workspace"','approval_mode = "always-ask"','thinking_level = "low"',
            '[providers.runhive]',f'base_url = {json.dumps(url)}',f'api_key = {json.dumps(row["broker_key"])}','client_type = "openai-chat"',
            '[[models]]','provider = "runhive"','model_id = "qwen"','display_name = "千问 Qwen3-VL"','context_window = 8192','max_tokens = 4096','vision = true',
            '[[models]]','provider = "runhive"','model_id = "vlx"','display_name = "VLX 视觉定位（需图片）"','context_window = 8192','max_tokens = 256','vision = true','',
        ])
        config.write_text(text,encoding='utf-8');os.chmod(config,0o600)

    def image(self):
        # Only the privileged release process can publish this immutable image ID.
        pinned = self.root / 'agent-web-image.txt'
        if pinned.exists():
            value = pinned.read_text().strip()
            if not re.fullmatch(r'sha256:[a-f0-9]{64}', value):
                raise HTTPException(503, 'Agent 发布镜像校验失败，请检查发布记录。')
            return value
        return os.getenv('LLM_AGENT_IMAGE','runhive-agent:d56d9ced-20261007')

    def ensure(self,tenant):
        with self.lock:
            path=self.root/'agents'/f'admin-{tenant}'
            for p in [path,path/'data',path/'workspace']:
                p.mkdir(parents=True,exist_ok=True);os.chmod(p,0o700)
            with self.db() as c:
                row=c.execute('SELECT * FROM agent_instances WHERE tenant=?',(tenant,)).fetchone()
                if row is None:
                    used={r[0] for r in c.execute('SELECT port FROM agent_instances')}
                    port=next((port for port in range(int(os.getenv('LLM_AGENT_PORT_START','41100')),42000) if port not in used),None)
                    if port is None: raise HTTPException(503,'智能体账号实例数量已达到当前容量。')
                    c.execute('INSERT INTO agent_instances VALUES(?,?,?,?,?,?,?)',(tenant,port,secrets.token_urlsafe(48),secrets.token_urlsafe(48),secrets.token_urlsafe(48),f'runhive-agent-ui-{tenant}',time.time()))
                    row=c.execute('SELECT * FROM agent_instances WHERE tenant=?',(tenant,)).fetchone()
            # The native adoption path backfills vendor presets independently of defaultProjectConfig.
            # Seed an explicit own-account platform config before first boot, leaving later user edits intact.
            self.seed_config(path,tenant,row)
            existing=self.inspect(row['name'])
            if not existing or not existing['State'].get('Running'):
                if existing: self.docker('DELETE',f"/containers/{row['name']}?force=true")
                host_path=self.host_root/'agents'/f'admin-{tenant}'
                control_port=os.getenv('LLM_CONTROL_PORT','4021')
                spec={
                    'Image':self.image(),
                    'User':os.getenv('LLM_TENANT_UID','1011:1011'),'WorkingDir':'/workspace',
                    'Env':[
                        'HOME=/workspace','PENGUIN_HOME=/data','PENGUIN_WEB_DIST=/opt/penguin/web',
                        'HOST=0.0.0.0','PORT=7364','PENGUIN_UPDATE_CHECK=off','CUDA_VISIBLE_DEVICES=','NVIDIA_VISIBLE_DEVICES=void',
                        'PENGUIN_TRUST_PROXY=1','LLM_AGENT_MANAGED=1','RUNHIVE_SSO_MODE=1','RUNHIVE_WORKSPACE_ROOT=/workspace',
                        f'PENGUIN_SEED_ADMIN_PASSWORD={row["seed_password"]}',
                        f'LLM_TENANT_ID={tenant}',f'LLM_INSTANCE_KEY={row["instance_key"]}',
                        f'LLM_AGENT_BROKER_URL=http://host.docker.internal:{control_port}/broker/{tenant}/v1',
                        f'LLM_AGENT_BROKER_TOKEN={row["broker_key"]}',
                    ],
                    'Cmd':['penguin','server'],
                    'Healthcheck':{'Test':['CMD-SHELL','curl -fsS -H "X-LLM-Instance-Key: $LLM_INSTANCE_KEY" http://127.0.0.1:7364/health >/dev/null'],'Interval':30_000_000_000,'Timeout':5_000_000_000,'StartPeriod':60_000_000_000,'Retries':3},
                    'ExposedPorts':{'7364/tcp':{}},
                    'HostConfig':{
                        'Binds':[f'{host_path}/data:/data:rw',f'{host_path}/workspace:/workspace:rw',f'{os.environ["LLM_HOST_RUNTIME_SOURCE"]}:/opt/runtime:ro'],
                        'PortBindings':{'7364/tcp':[{'HostIp':'127.0.0.1','HostPort':str(row['port'])}]},
                        'ExtraHosts':['host.docker.internal:host-gateway'],
                        'CapDrop':['ALL'],'SecurityOpt':['no-new-privileges:true'],'Runtime':'runc',
                        'ReadonlyRootfs':True,'Tmpfs':{'/tmp':'rw,nosuid,nodev,size=268435456'},
                        'Memory':2*1024**3,'NanoCpus':2_000_000_000,'PidsLimit':256,
                        'RestartPolicy':{'Name':'unless-stopped'},
                    },
                    'Labels':{'runhive.llm-center':'true','runhive.module':'agent','runhive.tenant':str(tenant)},
                }
                self.docker('POST',f"/containers/create?name={row['name']}",json=spec)
                self.docker('POST',f"/containers/{row['name']}/start")
        deadline=time.time()+90
        while time.time()<deadline:
            try:
                response=httpx.get(f"http://127.0.0.1:{row['port']}/health",headers={'x-llm-instance-key':row['instance_key']},timeout=2)
                token_file=path/'data/api-token'
                if response.status_code==200 and token_file.exists():
                    token=token_file.read_text().strip()
                    check=httpx.get(f"http://127.0.0.1:{row['port']}/api/me",headers={'x-llm-instance-key':row['instance_key'],'authorization':'Bearer '+token},timeout=2)
                    if check.status_code==200:
                        return {'tenant_id':tenant,'module':'agent','kind':'agent','base_url':f"http://127.0.0.1:{row['port']}",'instance_key':row['instance_key'],'native_token':token,'state':'ready'}
            except (httpx.HTTPError,OSError): pass
            state=self.inspect(row['name'])
            if state and not state['State'].get('Running'): raise HTTPException(503,'智能体账号实例启动失败，请查看运行日志。')
            time.sleep(1)
        raise HTTPException(503,'智能体账号实例正在启动，请稍后重试。')

    def stop(self,tenant):
        with self.db() as c: row=c.execute('SELECT * FROM agent_instances WHERE tenant=?',(tenant,)).fetchone()
        if row and self.inspect(row['name']): self.docker('POST',f"/containers/{row['name']}/stop?t=15")
        return {'tenant_id':tenant,'module':'agent','state':'stopped','data_retained':True}
