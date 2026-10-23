"""Privileged instance and job controller; never mounted into tenant processes."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import io
import json
import os
import secrets
import sqlite3
import subprocess
import re
import tempfile
import tarfile
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import uvicorn
import yaml
from fastapi import FastAPI, Header, HTTPException, Request
from starlette.responses import JSONResponse, StreamingResponse, Response

from runtime_common import FACTORY_COMMIT, MODEL_NAMES, contained, relative_name, sanitize_args
from agent_runtime import AgentRuntime
from agent_broker import ModelBroker, sse_chunks
from session_image_context import SessionImageContextResolver
from image_batches import needs_visual_context
from workspace_store import WorkspaceStore, WorkspaceError, workspace_lock

ROOT = Path(os.getenv("LLM_STATE_ROOT", "/state"))
HOST_ROOT = Path(os.environ["LLM_HOST_STATE_ROOT"])
IMAGE = os.getenv("LLM_FACTORY_IMAGE", "runhive-llamafactory:0.9.4-20261007")
HOST_SOURCE = os.environ["LLM_HOST_RUNTIME_SOURCE"]
KEY = Path(os.environ["LLM_CONTROL_KEY_FILE"]).read_text().strip()
BRIDGE = os.getenv("LLM_DOCKER_BRIDGE_IP", "172.17.0.1")
ROOT.mkdir(parents=True, exist_ok=True)
IMAGE_CONTEXT = SessionImageContextResolver(ROOT)
os.chmod(ROOT, 0o700)
DB = ROOT / "control.sqlite3"
LOCK = threading.RLock()
DOCKER = httpx.Client(transport=httpx.HTTPTransport(uds="/var/run/docker.sock"), base_url="http://docker/v1.43", timeout=60)
CHAT_LOCKS = {"qwen": threading.Lock(), "vlx": threading.Lock()}


def db():
    c = sqlite3.connect(DB, timeout=30)
    c.row_factory = sqlite3.Row
    return c


with db() as c:
    c.executescript("""
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS instances(tenant INTEGER PRIMARY KEY, port INTEGER UNIQUE NOT NULL, instance_key TEXT NOT NULL, name TEXT NOT NULL, created REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, tenant INTEGER NOT NULL, operation TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', cpu INTEGER NOT NULL, args TEXT NOT NULL, container TEXT, exit_code INTEGER, created REAL NOT NULL, updated REAL NOT NULL);
    CREATE INDEX IF NOT EXISTS jobs_tenant_created ON jobs(tenant,created);
    """)
    if "gpu" not in {r[1] for r in c.execute("PRAGMA table_info(jobs)")}:
        c.execute("ALTER TABLE jobs ADD COLUMN gpu TEXT")
os.chmod(DB, 0o600)
WORKSPACE = WorkspaceStore(ROOT, db)


def docker(method, path, **kw):
    r = DOCKER.request(method, path, **kw)
    if r.status_code >= 400:
        raise RuntimeError(f"容器操作失败（{r.status_code}）。")
    return r.json() if r.content and r.headers.get("content-type", "").startswith("application/json") else r.content


def inspect(name):
    r = DOCKER.get(f"/containers/{name}/json")
    return r.json() if r.status_code == 200 else None


def tenant_id(value):
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 2147483647:
        raise HTTPException(400, "账号标识无效。")
    return value


def authorize(request: Request, tenant: int | None = None, *, admin=False):
    auth = request.headers.get("authorization", "")
    if hmac.compare_digest(auth, "Bearer " + KEY):
        return
    if admin or tenant is None:
        raise HTTPException(401, "内部认证失败。")
    supplied = request.headers.get("x-llm-instance-key", "")
    if request.headers.get("x-llm-tenant-id") != str(tenant):
        raise HTTPException(403, "账号访问范围不匹配。")
    with db() as c:
        row = c.execute("SELECT instance_key FROM instances WHERE tenant=?", (tenant,)).fetchone()
    if not row or not hmac.compare_digest(row[0], supplied):
        raise HTTPException(403, "账号实例认证失败。")


def initialize_tenant(tenant):
    p = ROOT / "tenants" / f"admin-{tenant}"
    p.mkdir(parents=True, exist_ok=True)
    os.chmod(p, 0o700)
    for sub in ["data", "saves", "exports", "chat", "cache", "jobs", "llamaboard_config", "llamaboard_cache"]:
        (p / sub).mkdir(exist_ok=True)
    sample = [
        {"instruction": "你好", "input": "", "output": "你好，欢迎使用大模型中心。"},
        {"instruction": "请解释模型微调。", "input": "", "output": "模型微调通过任务数据更新模型参数。"},
        {"instruction": "什么是数据隔离？", "input": "", "output": "每个账号拥有独立的数据与任务空间。"},
        {"instruction": "训练完成后可以做什么？", "input": "", "output": "可以评估、对话测试并导出模型。"},
    ]
    if not (p / "data/dataset_info.json").exists():
        (p / "data/quickstart.json").write_text(json.dumps(sample, ensure_ascii=False), "utf-8")
        (p / "data/dataset_info.json").write_text(json.dumps({"quickstart": {"file_name": "quickstart.json"}}, ensure_ascii=False), "utf-8")
    if not (p / "llamaboard_cache/user_config.yaml").exists():
        (p / "llamaboard_cache/user_config.yaml").write_text(yaml.safe_dump({"lang": "zh", "hub_name": "huggingface", "last_model": None, "path_dict": {}, "cache_dir": "/tenant/cache/huggingface"}, allow_unicode=True), "utf-8")
    # Containers use the owning server account UID; no privileged account is needed.
    return p


def common_container(tenant):
    host_data = HOST_ROOT / "tenants" / f"admin-{tenant}"
    return {
        "Image": IMAGE, "User": os.getenv("LLM_TENANT_UID", "1000:1000"), "WorkingDir": "/tenant",
        "Env": ["HOME=/tenant/cache", "HF_HOME=/tenant/cache/huggingface", "GRADIO_TEMP_DIR=/tenant/cache/gradio", "MPLCONFIGDIR=/tenant/cache/matplotlib", "PYTHONDONTWRITEBYTECODE=1", "HF_HUB_OFFLINE=1", "HF_DATASETS_OFFLINE=1", "GRADIO_ANALYTICS_ENABLED=False", "HF_HUB_DISABLE_TELEMETRY=1", "TOKENIZERS_PARALLELISM=false", "OMP_NUM_THREADS=2", "OPENBLAS_NUM_THREADS=2"],
        "HostConfig": {"Binds": [f"{host_data}:/tenant:rw", f"{HOST_SOURCE}:/opt/runtime:ro", f"{HOST_ROOT}/models:/models:ro", f"{os.getenv('LLM_HOST_BASE_MODELS', '/srv/runhive/models')}:/base-models:ro"], "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges:true"], "ReadonlyRootfs": True, "Tmpfs": {"/tmp": "rw,nosuid,nodev,size=536870912"}, "Memory": 4 * 1024**3, "NanoCpus": 2_000_000_000, "PidsLimit": 384},
        "Labels": {"runhive.llm-center": "true", "runhive.tenant": str(tenant)},
    }


def ensure_instance(tenant):
    with LOCK:
        initialize_tenant(tenant)
        with db() as c:
            row = c.execute("SELECT * FROM instances WHERE tenant=?", (tenant,)).fetchone()
            if row is None:
                used = {r[0] for r in c.execute("SELECT port FROM instances")}
                port = next((x for x in range(int(os.getenv('LLM_TUNE_PORT_START','40100')), 41000) if x not in used), None)
                if port is None:
                    raise HTTPException(503, "账号实例数量已达到当前容量。")
                c.execute("INSERT INTO instances VALUES(?,?,?,?,?)", (tenant, port, secrets.token_urlsafe(48), f"runhive-llm-ui-{tenant}", time.time()))
                row = c.execute("SELECT * FROM instances WHERE tenant=?", (tenant,)).fetchone()
        existing = inspect(row["name"])
        if existing and existing["State"].get("Running"):
            pass
        else:
            if existing:
                docker("DELETE", f"/containers/{row['name']}?force=true")
            spec = common_container(tenant)
            spec["Cmd"] = ["python", "/opt/runtime/ui.py"]
            spec["Env"] += ["CUDA_VISIBLE_DEVICES=", f"LLM_TENANT_ID={tenant}", f"LLM_INSTANCE_KEY={row['instance_key']}", f"LLM_CONTROL_URL=http://host.docker.internal:{os.getenv('LLM_CONTROL_PORT','4021')}", "LLM_UI_PORT=7860", f"LLM_ROOT_PATH={os.getenv('LLM_TUNE_ROOT_PATH','/llm-center/tune')}"]
            spec["ExposedPorts"] = {"7860/tcp": {}}
            spec["HostConfig"].update({"PortBindings": {"7860/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(row["port"])}]}, "ExtraHosts": ["host.docker.internal:host-gateway"], "RestartPolicy": {"Name": "unless-stopped"}})
            docker("POST", f"/containers/create?name={row['name']}", json=spec)
            docker("POST", f"/containers/{row['name']}/start")
    deadline = time.time() + 90
    while time.time() < deadline:
        try:
            r = httpx.get(f"http://127.0.0.1:{row['port']}/health", timeout=2)
            if r.status_code == 200:
                return {"tenant_id": tenant, "module":"tune", "kind":"tune", "base_url": f"http://127.0.0.1:{row['port']}", "instance_key": row["instance_key"], "state": "ready"}
        except Exception:
            pass
        state = inspect(row["name"])
        if state and not state["State"].get("Running"):
            raise HTTPException(503, "账号实例启动失败，请查看服务运行日志。")
        time.sleep(1)
    raise HTTPException(503, "账号实例正在启动，请稍后重试。")


def job_view(row, logs=False):
    result = {k: row[k] for k in ["id", "tenant", "operation", "status", "reason", "cpu", "exit_code", "created", "updated", "gpu"]}
    if logs:
        result["args"] = json.loads(row["args"])
        path = ROOT / "tenants" / f"admin-{row['tenant']}" / "jobs" / row["id"] / "console.log"
        result["log"] = path.read_text("utf-8", errors="replace")[-30000:] if path.exists() else ""
    return result


def append_log(tenant, job, content):
    p = ROOT / "tenants" / f"admin-{tenant}" / "jobs" / job / "console.log"
    p.write_text(content, "utf-8")


def reconcile():
    with db() as c:
        rows = c.execute("SELECT * FROM jobs WHERE status IN ('starting','running')").fetchall()
    for row in rows:
        state = inspect(row["container"])
        if state:
            if row["status"] == "starting" and state["State"].get("Status") == "created":
                docker("POST", f"/containers/{row['container']}/start")
                state = inspect(row["container"])
            r = DOCKER.get(f"/containers/{row['container']}/logs?stdout=true&stderr=true&timestamps=false")
            if r.status_code == 200:
                payload = r.content
                # Docker's multiplexed stream frames stdout/stderr with an 8-byte header.
                chunks = []
                while len(payload) >= 8 and payload[0] in {0, 1, 2}:
                    size = int.from_bytes(payload[4:8], "big")
                    chunks.append(payload[8:8 + size])
                    payload = payload[8 + size:]
                text = (b"".join(chunks) if chunks else payload).decode("utf-8", "replace")
                append_log(row["tenant"], row["id"], text)
            if state["State"].get("Running"):
                if row["status"] == "starting":
                    with db() as c:
                        c.execute("UPDATE jobs SET status='running',reason='任务正在运行。',updated=? WHERE id=?", (time.time(), row["id"]))
                continue
            code = state["State"].get("ExitCode", -1)
            status = "succeeded" if code == 0 else "failed"
            reason = "任务已完成。" if code == 0 else "任务执行失败，请检查日志和配置。"
        else:
            if row["status"] == "starting":
                # The persistent starting record precedes creation; a restart may safely retry creation.
                with db() as c:
                    c.execute("UPDATE jobs SET status='queued',reason='恢复待启动任务。',updated=? WHERE id=?", (time.time(), row["id"]))
                continue
            code, status, reason = -1, "failed", "任务容器已丢失，请检查部署状态后重新运行。"
        with db() as c:
            c.execute("UPDATE jobs SET status=?,reason=?,exit_code=?,updated=? WHERE id=? AND status IN ('starting','running')", (status, reason, code, time.time(), row["id"]))


def gpu_status():
    """Read real GPU and inference state; unknown state never grants a training lease."""
    result = {"checked_at": time.time(), "probe_ok": False, "gpus": [], "runos_active_tasks": [], "qwen_running": None, "qwen_waiting": None, "cpu_validation_available": True}
    try:
        proc = subprocess.run(["nvidia-smi", "--query-gpu=index,uuid,memory.free,memory.total,utilization.gpu", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=5, check=True)
        for line in proc.stdout.splitlines():
            index, uid, free, total, utilization = [part.strip() for part in line.split(",")]
            result["gpus"].append({"index": int(index), "uuid": uid, "free_mb": int(free), "total_mb": int(total), "utilization": int(utilization)})
        # The controller is privileged; only status metadata leaves this probe.
        store = Path(os.environ["LLM_RUNOS_JOBS_ROOT"])
        for path in store.glob("admin-*/batch_jobs.json"):
            raw = json.loads(path.read_text())
            rows = raw.values() if isinstance(raw, dict) else raw
            for job in rows:
                if isinstance(job, dict) and job.get("status") in {"pending", "queued", "running", "starting", "processing"}:
                    result["runos_active_tasks"].append({"tenant": path.parent.name, "id": str(job.get("id", ""))[:64], "status": job["status"]})
        response = httpx.get("http://127.0.0.1:22002/metrics", timeout=5)
        response.raise_for_status()
        for key, field in [("vllm:num_requests_running", "qwen_running"), ("vllm:num_requests_waiting", "qwen_waiting")]:
            values = [float(line.rsplit(" ", 1)[-1]) for line in response.text.splitlines() if line.startswith(key)]
            if not values:
                raise ValueError("推理服务缺少任务状态。")
            result[field] = int(sum(values))
        result["probe_ok"] = bool(result["gpus"])
    except Exception as e:
        result["reason"] = "训练资源状态暂时无法确认（" + type(e).__name__ + "），GPU 任务保持排队。"
    return result


def choose_gpu(probe, min_vram_mb, occupied):
    if not probe.get("probe_ok"):
        return None, probe.get("reason", "训练资源状态暂时无法确认。")
    if probe.get("runos_active_tasks") or probe.get("qwen_running") or probe.get("qwen_waiting"):
        return None, "现有标注或推理任务正在执行，等待其完成后再分配训练资源。"
    for gpu in sorted(probe["gpus"], key=lambda g: g["free_mb"], reverse=True):
        if gpu["uuid"] in occupied or gpu["utilization"] > 10:
            continue
        if gpu["free_mb"] >= min_vram_mb + 2048:
            return gpu["uuid"], "已分配 GPU 训练资源。"
    return None, f"GPU 可用显存未达到任务要求（含 2048 MB 预留），等待可用资源；已有推理模型无需重复加载。"


def estimate_memory(args, model):
    """A conservative preflight estimate, never a guarantee of successful training."""
    config = json.loads((Path(model["path"]) / "config.json").read_text())
    config = config.get("text_config", config)
    hidden = int(config["hidden_size"])
    intermediate = int(config["intermediate_size"])
    layers = int(config["num_hidden_layers"])
    heads = int(config["num_attention_heads"])
    kv = int(config.get("num_key_value_heads", heads))
    vocab = int(config["vocab_size"])
    params = layers * (hidden**2 * (2 + 2 * kv / heads) + 3 * hidden * intermediate) + 2 * vocab * hidden
    model_bytes = params * (16 if args.get("finetuning_type") == "full" else 3)
    activations = int(args.get("per_device_train_batch_size", args.get("per_device_eval_batch_size", 1))) * int(args.get("cutoff_len", 1024)) * hidden * layers * 8
    return max(int(model.get("min_vram_mb", 24000)), int((model_bytes + activations) / 1024**2))


def schedule_once():
    with LOCK:
        reconcile()
        with db() as c:
            running = c.execute("SELECT * FROM jobs WHERE status IN ('starting','running')").fetchall()
            queued = c.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created").fetchall()
        probe = gpu_status() if any(not row["cpu"] for row in queued) else None
        for row in queued:
            if any(r["cpu"] for r in running) and row["cpu"]:
                continue
            if any(r["tenant"] == row["tenant"] for r in running):
                continue
            gpu = None
            if not row["cpu"]:
                args = json.loads(row["args"])
                model = next(m for m in MODEL_NAMES.values() if m["path"] == args["model_name_or_path"])
                try:
                    required_mb = estimate_memory(args, model)
                    gpu, reason = choose_gpu(probe, required_mb, {r["gpu"] for r in running if r["gpu"]})
                except Exception:
                    gpu, reason = None, "无法核实基础模型的训练显存需求，等待管理员检查模型配置。"
                if gpu is None:
                    with db() as c:
                        c.execute("UPDATE jobs SET reason=?,updated=? WHERE id=?", (reason, time.time(), row["id"]))
                    continue
            spec = common_container(row["tenant"])
            spec["Cmd"] = ["python", "/opt/runtime/worker.py", row["id"], row["operation"]]
            spec["Env"] += (["CUDA_VISIBLE_DEVICES="] if row["cpu"] else ["CUDA_VISIBLE_DEVICES=0"]) + ["LLAMABOARD_ENABLED=1"]
            spec["HostConfig"]["Memory"] = 6 * 1024**3
            if gpu:
                spec["HostConfig"]["DeviceRequests"] = [{"Driver": "nvidia", "DeviceIDs": [gpu], "Capabilities": [["gpu"]]}]
                spec["HostConfig"]["Memory"] = 64 * 1024**3
            name = "runhive-llm-job-" + row["id"]
            existing = inspect(name)
            with db() as c:
                c.execute("UPDATE jobs SET status='starting',reason='任务正在启动。',container=?,gpu=?,updated=? WHERE id=? AND status='queued'", (name, gpu, time.time(), row["id"]))
            if not existing:
                docker("POST", f"/containers/create?name={name}", json=spec)
                docker("POST", f"/containers/{name}/start")
            elif existing["State"].get("Status") == "created":
                docker("POST", f"/containers/{name}/start")
            # A controller restart adopts an existing worker; it never force-deletes/re-runs it.
            with db() as c:
                c.execute("UPDATE jobs SET status='running',reason='任务正在运行。',updated=? WHERE id=? AND status='starting'", (time.time(), row["id"]))
                running.append(c.execute("SELECT * FROM jobs WHERE id=?", (row["id"],)).fetchone())


async def scheduler():
    while True:
        try:
            await asyncio.to_thread(schedule_once)
        except Exception as e:
            print("scheduler:", type(e).__name__, flush=True)
        await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(scheduler())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)
AGENTS = AgentRuntime(ROOT, HOST_ROOT, db, docker, inspect, LOCK)
BROKER = ModelBroker(os.environ['LLM_PROVIDERS_FILE'],CHAT_LOCKS)


class ControlBodyGuard:
    """Authenticate before parsing JSON and cap real bytes, including chunked uploads."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope.get("path", "").startswith(("/internal/","/broker/")):
            return await self.app(scope, receive, send)
        request = Request(scope)
        match = re.match(r"^/internal/tenants/(\d+)(?:/|$)", scope["path"])
        broker_match = re.match(r"^/broker/(\d+)/v1(?:/|$)", scope["path"])
        try:
            if broker_match:
                AGENTS.authorize(request,tenant_id(int(broker_match.group(1))))
            else:
                authorize(request, int(match.group(1)) if match else None, admin=match is None)
        except HTTPException as e:
            return await JSONResponse({"detail": e.detail}, status_code=e.status_code)(scope, receive, send)
        if scope.get("method") not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        limit = 20 * 1024**2
        try:
            declared = int(request.headers.get("content-length", "0"))
        except ValueError:
            declared = limit + 1
        if declared > limit:
            return await JSONResponse({"detail": "请求内容超过当前允许大小。"}, status_code=413)(scope, receive, send)
        with tempfile.SpooledTemporaryFile(max_size=4 * 1024**2, mode="w+b") as spool:
            total = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                total += len(chunk)
                if total > limit:
                    return await JSONResponse({"detail": "请求内容超过当前允许大小。"}, status_code=413)(scope, receive, send)
                spool.write(chunk)
                if not message.get("more_body", False):
                    break
            spool.seek(0)
            headers = [(key, value) for key, value in scope.get("headers", []) if key.lower() not in {b"content-length", b"transfer-encoding"}]
            scope = dict(scope, headers=headers + [(b"content-length", str(total).encode())])
            finished = False
            async def replay():
                nonlocal finished
                if finished:
                    # Streaming responses wait for a disconnect. Replaying an empty request
                    # forever would spin its listener and block the entire controller loop.
                    return await receive()
                chunk = spool.read(64 * 1024)
                more = spool.tell() < total
                finished = not more
                return {"type": "http.request", "body": chunk, "more_body": more}
            await self.app(scope, replay, send)


app.add_middleware(ControlBodyGuard)

@app.exception_handler(WorkspaceError)
async def workspace_error_handler(request, exception):
    return JSONResponse({'detail':str(exception)},status_code=exception.status)


@app.get("/health")
def health():
    return {"status": "healthy", "factory_version": "0.9.4", "factory_commit": FACTORY_COMMIT}


@app.post("/internal/instances/ensure")
def ensure(body: dict, request: Request):
    authorize(request, admin=True)
    tenant=tenant_id(body.get('tenant_id'))
    module=body.get('module','tune')
    if module not in {'tune','agent'}: raise HTTPException(400,'模块类型无效。')
    return AGENTS.ensure(tenant) if module=='agent' else ensure_instance(tenant)


@app.post("/internal/instances/{tenant}/stop")
def stop(tenant: int, request: Request, module: str = 'tune'):
    tenant_id(tenant); authorize(request, admin=True)
    if module=='agent': return AGENTS.stop(tenant)
    if module!='tune': raise HTTPException(400,'模块类型无效。')
    with db() as c:
        row = c.execute("SELECT * FROM instances WHERE tenant=?", (tenant,)).fetchone()
    if row and inspect(row["name"]):
        docker("POST", f"/containers/{row['name']}/stop?t=10")
    return {"tenant_id": tenant, "state": "stopped", "data_retained": True}


@app.get('/broker/{tenant}/v1/models')
def agent_models(tenant: int,request: Request):
    tenant_id(tenant);AGENTS.authorize(request,tenant)
    return {'object':'list','data':[{'id':name,'object':'model','owned_by':'runhive'} for name in ['qwen','vlx']]}


@app.post('/broker/{tenant}/v1/chat/completions')
def agent_chat(tenant: int,body: dict,request: Request):
    tenant_id(tenant);AGENTS.authorize(request,tenant)
    try:
        sid=request.headers.get('x-runhive-session-id')
        context_images=IMAGE_CONTEXT.resolve_group(tenant,sid) if sid and needs_visual_context(body.get('messages') or []) else []
        completion=BROKER.complete(body,context_images=context_images)
        if body.get('stream'):
            return StreamingResponse(sse_chunks(completion),media_type='text/event-stream',headers={'Cache-Control':'no-store','X-Accel-Buffering':'no'})
        return completion
    except (ValueError,TypeError,KeyError,httpx.HTTPError) as e:
        message=str(e) if isinstance(e,ValueError) else '模型连接或工具协议异常，请稍后重试。'
        if not any('\u4e00' <= char <= '\u9fff' for char in message):
            message='模型参数或工具协议无效，请检查配置后重试。'
        return JSONResponse({'error':{'message':message,'type':'invalid_request_error','code':'platform_model_error'}},status_code=400)


@app.get('/broker/{tenant}/v1/sessions/{sid}/images/{image_sha256}')
def agent_session_image(tenant: int,sid: str,image_sha256: str,request: Request):
    """Only a bound image in this authenticated account and Session may be returned."""
    tenant_id(tenant);AGENTS.authorize(request,tenant)
    try:
        image=IMAGE_CONTEXT.resolve(tenant,sid,image_sha256=image_sha256)
    except ValueError as error:
        raise HTTPException(400,str(error)) from error
    if image is None:raise HTTPException(404,'本会话中未找到对应原图。')
    mime=image['image_url'].split(';',1)[0].removeprefix('data:')
    raw=base64.b64decode(image['image_url'].split(',',1)[1],validate=True)
    return Response(raw,media_type=mime,headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="image-'+image_sha256+'"'})


@app.get("/internal/tenants/{tenant}/jobs")
def list_jobs(tenant: int, request: Request):
    tenant_id(tenant); authorize(request, tenant)
    with db() as c:
        return [job_view(r) for r in c.execute("SELECT * FROM jobs WHERE tenant=? ORDER BY created DESC LIMIT 100", (tenant,))]


@app.post("/internal/tenants/{tenant}/jobs")
def create_job(tenant: int, body: dict, request: Request):
    tenant_id(tenant); authorize(request, tenant)
    operation = body.get("operation")
    if operation not in {"train", "eval", "export"}:
        raise HTTPException(400, "任务类型无效。")
    p = initialize_tenant(tenant)
    with LOCK, workspace_lock(p), db() as c:
        try:
            args, cpu = sanitize_args(body.get("args"), operation, p)
            if operation != 'export': WORKSPACE.validate_selection(c, tenant, args)
        except (ValueError, TypeError, OSError) as e:
            raise HTTPException(getattr(e, 'status', 400), str(e))
        if c.execute("SELECT 1 FROM jobs WHERE tenant=? AND status IN ('queued','starting','running')", (tenant,)).fetchone():
            raise HTTPException(409, "当前账号已有排队或运行中的任务。")
        jid = uuid.uuid4().hex
        path = p / "jobs" / jid
        path.mkdir()
        (path / "args.json").write_text(json.dumps(args, ensure_ascii=False), "utf-8")
        now = time.time()
        c.execute("INSERT INTO jobs(id,tenant,operation,status,reason,cpu,args,created,updated) VALUES(?,?,?,'queued',?,?,?, ?, ?)", (jid, tenant, operation, "任务已进入队列。", int(cpu), json.dumps(args), now, now))
        return job_view(c.execute("SELECT * FROM jobs WHERE id=?", (jid,)).fetchone())


def workspace_call(function, *args):
    try:
        with LOCK: return function(*args)
    except WorkspaceError as e: raise HTTPException(e.status, str(e)) from e
    except (ValueError, TypeError, OSError, sqlite3.Error):
        raise HTTPException(503, '资源操作暂未完成，请稍后重试。') from None


@app.get('/internal/tenants/{tenant}/workspace')
def list_workspace(tenant: int, request: Request):
    tenant_id(tenant); authorize(request, tenant)
    return workspace_call(WORKSPACE.list, tenant)


@app.get('/internal/tenants/{tenant}/workspace/catalog')
def workspace_catalog(tenant: int, request: Request):
    tenant_id(tenant); authorize(request, tenant)
    return workspace_call(WORKSPACE.catalog, tenant)


@app.post('/internal/tenants/{tenant}/workspace/action')
def workspace_action(tenant: int, body: dict, request: Request):
    tenant_id(tenant); authorize(request, tenant)
    return workspace_call(WORKSPACE.change, tenant, body)


@app.post('/internal/tenants/{tenant}/workspace/import')
def workspace_import(tenant: int, body: dict, request: Request):
    tenant_id(tenant); authorize(request, tenant)
    return workspace_call(WORKSPACE.import_dataset, tenant, body)


@app.get('/internal/tenants/{tenant}/workspace/detail')
def workspace_detail(tenant: int, kind: str, resource: str, request: Request):
    tenant_id(tenant); authorize(request, tenant)
    return workspace_call(WORKSPACE.detail, tenant, kind, resource)


@app.get('/internal/tenants/{tenant}/workspace/preview')
def workspace_preview(tenant: int, resource: str, request: Request, page: int = 0):
    tenant_id(tenant); authorize(request, tenant)
    return workspace_call(WORKSPACE.preview, tenant, resource, page)


@app.get("/internal/tenants/{tenant}/jobs/{jid}")
def get_job(tenant: int, jid: str, request: Request):
    authorize(request, tenant)
    with db() as c:
        row = c.execute("SELECT * FROM jobs WHERE id=? AND tenant=?", (jid, tenant)).fetchone()
    if not row:
        raise HTTPException(404, "任务不存在。")
    return job_view(row, True)


@app.post("/internal/tenants/{tenant}/jobs/{jid}/cancel")
def cancel(tenant: int, jid: str, request: Request):
    authorize(request, tenant)
    with LOCK, db() as c:
        row = c.execute("SELECT * FROM jobs WHERE id=? AND tenant=?", (jid, tenant)).fetchone()
        if not row:
            raise HTTPException(404, "任务不存在。")
        if row["status"] in {"queued", "starting", "running"}:
            if row["container"] and inspect(row["container"]):
                docker("POST", f"/containers/{row['container']}/stop?t=10")
            c.execute("UPDATE jobs SET status='cancelled',reason='任务已取消。',updated=? WHERE id=?", (time.time(), jid))
        return {"id": jid, "status": "cancelled" if row["status"] in {"queued", "starting", "running"} else row["status"]}


@app.get("/internal/tenants/{tenant}/resources")
def resources(tenant: int, request: Request):
    authorize(request, tenant)
    status = gpu_status()
    active_count = len(status.pop("runos_active_tasks", []))
    status["existing_task_count"] = active_count
    status["existing_tasks_busy"] = bool(active_count or status.get("qwen_running") or status.get("qwen_waiting"))
    return status


def qwen_chat(body):
    # Credentials remain only in the privileged controller config.
    config = json.loads(Path(os.environ["LLM_PROVIDERS_FILE"]).read_text())["qwen"]
    url = config["base_url"]
    token = config.get("api_key", "")
    hdr = dict(config.get("extra_headers") or {})
    if token:
        hdr["Authorization"] = "Bearer " + token
    messages = body.get("messages", [])
    if not isinstance(messages, list) or len(messages) > 80 or len(json.dumps(messages)) > 200000:
        raise ValueError("对话内容超出允许范围。")
    normalized = []
    if body.get("system"):
        normalized.append({"role": "system", "content": str(body["system"])[:8000]})
    for message in messages:
        if not isinstance(message, dict) or message.get("role") not in {"user", "assistant", "system"} or not isinstance(message.get("content"), str):
            raise ValueError("对话消息格式不正确。")
        normalized.append({"role": message["role"], "content": message["content"][:30000]})
    image = body.get("image_base64")
    if image:
        if len(image) > 14_000_000:
            raise ValueError("图片过大，请上传较小图片。")
        base64.b64decode(image, validate=True)
        if not normalized or normalized[-1]["role"] != "user":
            raise ValueError("图片需要附带用户问题。")
        normalized[-1]["content"] = [{"type": "text", "text": normalized[-1]["content"]}, {"type": "image_url", "image_url": {"url": "data:image/png;base64," + image}}]
    payload = {"model": config["model"], "messages": normalized, "max_tokens": min(2048, max(8, int(body.get("max_new_tokens", 512)))), "temperature": min(1.5, max(0.01, float(body.get("temperature", .7)))), "top_p": min(1., max(.01, float(body.get("top_p", .7)))), "stream": False}
    with httpx.Client(timeout=180) as client:
        response = client.post(url.rstrip("/") + "/chat/completions", headers=hdr, json=payload)
        if response.status_code != 200:
            raise ValueError(f"模型服务响应异常（{response.status_code}），请稍后重试。")
        return response.json()["choices"][0]["message"]["content"]


def vlx_chat(body):
    # Dedicated VLX endpoint is a grounding service; do not present it as a general text model.
    if not body.get("image_base64"):
        raise ValueError("VLX-Seek 为视觉定位模型，请上传图片并输入目标描述。")
    from vlx_client import VLXSeekClient
    config = json.loads(Path(os.environ["LLM_PROVIDERS_FILE"]).read_text())["vlx"]
    image = body["image_base64"]
    if len(image) > 14_000_000:
        raise ValueError("图片过大，请上传较小图片。")
    data = base64.b64decode(image, validate=True)
    messages = body.get("messages") or []
    prompt = str(messages[-1].get("content", "")) if messages else ""
    if not prompt or len(prompt) > 4000:
        raise ValueError("请输入长度适当的目标描述。")
    cfg = {"transport": "direct", "base_url": config["vlx_seek_base_url"], "token": config.get("vlx_seek_token", ""), "task": "detection", "lang": "zh", "timeout": 180, "max_new_tokens": 256}
    response = VLXSeekClient(cfg).infer_image(data, prompt, task="detection", lang="zh", max_new_tokens=256, filename="account-test.png", request_id="llm-center-" + uuid.uuid4().hex)
    summary = [{"目标": d.get("label", prompt), "像素坐标": d.get("bbox_xyxy")} for d in response.get("detections", [])]
    return "视觉定位结果（像素坐标）：\n\n```json\n" + json.dumps(summary, ensure_ascii=False, indent=2) + "\n```"


@app.post("/internal/tenants/{tenant}/chat")
def remote_chat(tenant: int, body: dict, request: Request):
    authorize(request, tenant)
    model = body.get("model")
    if model not in {"qwen", "vlx"}:
        raise HTTPException(400, "请选择已加载的模型服务。")
    if not CHAT_LOCKS[model].acquire(timeout=90):
        raise HTTPException(429, "模型服务当前繁忙，请稍后重试。")
    try:
        result = vlx_chat(body) if model == "vlx" else qwen_chat(body)
        history = initialize_tenant(tenant) / "chat" / (uuid.uuid4().hex + ".json")
        history.write_text(json.dumps({"model": model, "messages": body.get("messages"), "response": result, "created": time.time()}, ensure_ascii=False), "utf-8")
        return {"response": result, "model": model, "uses_loaded_service": True}
    except (ValueError, httpx.HTTPError) as e:
        raise HTTPException(400, str(e))
    finally:
        CHAT_LOCKS[model].release()


from assistant_tune import install as install_assistant_tune
install_assistant_tune(app,authorize,tenant_id,initialize_tenant,LOCK,workspace_lock,db,sanitize_args,WORKSPACE,MODEL_NAMES,create_job)

if __name__ == "__main__":
    # Both listeners share one app and one scheduler. Bridge requests always require tenant/admin keys.
    async def main():
        port=int(os.getenv('LLM_CONTROL_PORT','4021'))
        configs = [uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")]
        if BRIDGE != "127.0.0.1":
            configs.append(uvicorn.Config(app, host=BRIDGE, port=port, lifespan="off", log_level="warning"))
        await asyncio.gather(*(uvicorn.Server(c).serve() for c in configs))
    asyncio.run(main())

