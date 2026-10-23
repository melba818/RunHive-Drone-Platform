"""Account-scoped, persistent DAG orchestration over existing application services.

No arbitrary scripts, HTTP nodes, or flight dispatch. Every external job is
checkpointed before submission; uncertain submissions require reconciliation.
"""

import asyncio, copy, json, math, re, secrets, time
from fastapi import HTTPException
from workflow_templates import NODE_TYPES, templates
from workbench_resources import resource_json

ACTIVE = (
    "queued",
    "running",
    "waiting",
    "waiting_review",
    "paused",
    "needs_auth",
    "uncertain",
)
EVENTS = {
    "resource.uploaded",
    "flight_task.completed",
    "dataset.ready",
    "manual.trigger",
}


def validate_definition(value):
    if not isinstance(value, dict) or set(value) - {
        "name",
        "description",
        "trigger",
        "nodes",
        "edges",
        "bindings",
        "fields",
        "template_id",
        "template_version",
    }:
        raise HTTPException(422, "工作流结构无效。")
    name = value.get("name", "")
    if not isinstance(name, str) or not name.strip() or len(name) > 120:
        raise HTTPException(422, "请填写工作流名称，最多 120 字。")
    nodes = value.get("nodes", [])
    edges = value.get("edges", [])
    trigger = value.get("trigger", {})
    if (
        not isinstance(nodes, list)
        or not 1 <= len(nodes) <= 32
        or not isinstance(edges, list)
        or len(edges) > 64
    ):
        raise HTTPException(422, "工作流须包含 1 至 32 个节点。")
    if (
        not isinstance(trigger, dict)
        or set(trigger) - {"kind", "event", "interval_minutes"}
        or trigger.get("kind") not in {"periodic", "event", "manual"}
    ):
        raise HTTPException(422, "触发方式无效。")
    if trigger["kind"] == "event" and trigger.get("event") not in EVENTS:
        raise HTTPException(422, "触发事件无效。")
    interval = trigger.get("interval_minutes", 1440)
    if (
        type(interval) not in [int, float]
        or not math.isfinite(interval)
        or not 1 <= interval <= 525600
    ):
        raise HTTPException(422, "周期须为 1 至 525600 分钟。")
    ids = set()
    for node in nodes:
        if (
            not isinstance(node, dict)
            or set(node) - {"id", "type", "label", "config", "position"}
            or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", str(node.get("id", "")))
            or node["id"] in ids
            or node.get("type") not in NODE_TYPES
        ):
            raise HTTPException(422, "节点 ID、类型或字段无效。")
        if (
            not isinstance(node.get("config", {}), dict)
            or len(json.dumps(node.get("config", {}))) > 10000
        ):
            raise HTTPException(422, "节点配置无效。")
        if (
            not isinstance(node.get("label", ""), str)
            or len(node.get("label", "")) > 120
        ):
            raise HTTPException(422, "节点名称过长。")
        position = node.get("position", {"x": 0, "y": 0})
        if (
            not isinstance(position, dict)
            or set(position) - {"x", "y"}
            or any(
                type(position.get(k)) not in [int, float]
                or not math.isfinite(position[k])
                or abs(position[k]) > 100000
                for k in ["x", "y"]
            )
        ):
            raise HTTPException(422, "节点位置无效。")
        ids.add(node["id"])
    incoming = {i: set() for i in ids}
    outgoing = {i: set() for i in ids}
    seen = set()
    for edge in edges:
        if (
            not isinstance(edge, dict)
            or set(edge) - {"id", "source", "target"}
            or edge.get("source") not in ids
            or edge.get("target") not in ids
            or edge["source"] == edge["target"]
            or (edge["source"], edge["target"]) in seen
        ):
            raise HTTPException(422, "节点连线无效。")
        incoming[edge["target"]].add(edge["source"])
        outgoing[edge["source"]].add(edge["target"])
        seen.add((edge["source"], edge["target"]))
    queue = sorted(i for i in ids if not incoming[i])
    order = []
    pending = copy.deepcopy(incoming)
    while queue:
        ident = queue.pop(0)
        order.append(ident)
        for child in sorted(outgoing[ident]):
            pending[child].discard(ident)
            if not pending[child] and child not in order and child not in queue:
                queue.append(child)
    if len(order) != len(ids):
        raise HTTPException(422, "工作流不能包含循环连线。")

    # Side-effecting training nodes must have the prerequisite checkpoint in their ancestry.
    def ancestors(ident):
        result = set()
        stack = list(incoming[ident])
        while stack:
            key = stack.pop()
            if key in result:
                continue
            result.add(key)
            stack.extend(incoming[key])
        return result

    lookup = {n["id"]: n for n in nodes}
    for node in nodes:
        kinds = {lookup[i]["type"] for i in ancestors(node["id"])}
        required = {
            "training": {"training_prepare", "approval"},
            "tune": {"tune_prepare", "approval"},
            "dataset_split": {"annotation", "annotation_review"},
            "training_prepare": {"dataset_split"},
        }.get(node["type"], set())
        if not required <= kinds:
            raise HTTPException(
                422, f"{NODE_TYPES[node['type']]['label']} 缺少前置准备或人工确认节点。"
            )
        if node["type"] in {"training", "tune"}:
            prep = "training_prepare" if node["type"] == "training" else "tune_prepare"
            gates = [
                i for i in ancestors(node["id"]) if lookup[i]["type"] == "approval"
            ]
            if not any(
                any(lookup[p]["type"] == prep for p in ancestors(gate))
                for gate in gates
            ):
                raise HTTPException(
                    422, "人工确认节点必须位于参数准备之后、提交任务之前。"
                )
    for kind in ["annotation", "training_prepare", "tune_prepare"]:
        if sum(n["type"] == kind for n in nodes) > 1:
            raise HTTPException(
                422, "一个工作流只能包含一组标注或训练准备，避免资源关联不明确。"
            )
    bindings = value.get("bindings", {})
    if not isinstance(bindings, dict) or len(json.dumps(bindings)) > 32000:
        raise HTTPException(422, "资源参数过长。")
    if not isinstance(value.get("fields", {}), dict):
        raise HTTPException(422, "参数字段无效。")
    return copy.deepcopy(value), order


class WorkflowEngine:
    def __init__(self, bridge, ops):
        self.bridge = bridge
        self.ops = ops
        self.workers = {}
        self.loop_task = None
        self.slots = asyncio.Semaphore(2)
        self.activation_locks = {}
        with ops.db() as c:
            c.executescript(
                """
            CREATE TABLE IF NOT EXISTS workflows(id TEXT PRIMARY KEY,tenant INTEGER NOT NULL,revision INTEGER NOT NULL,
            definition TEXT NOT NULL,enabled INTEGER NOT NULL,next_at REAL,reason TEXT NOT NULL,created REAL NOT NULL,updated REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS workflow_runs(id TEXT PRIMARY KEY,tenant INTEGER NOT NULL,workflow TEXT NOT NULL,
            revision INTEGER NOT NULL,status TEXT NOT NULL,snapshot TEXT NOT NULL,state TEXT NOT NULL,error TEXT,
            event_key TEXT NOT NULL,created REAL NOT NULL,updated REAL NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS workflow_active_run ON workflow_runs(tenant,workflow)
            WHERE status IN ('queued','running','waiting','waiting_review','paused','needs_auth','uncertain');
            CREATE TABLE IF NOT EXISTS workflow_events(workflow TEXT NOT NULL,event_key TEXT NOT NULL,created REAL NOT NULL,
            PRIMARY KEY(workflow,event_key));
            CREATE TABLE IF NOT EXISTS task_plans(id TEXT PRIMARY KEY,tenant INTEGER NOT NULL,revision INTEGER NOT NULL,
            status TEXT NOT NULL,payload TEXT NOT NULL,created REAL NOT NULL,updated REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS workflow_authorizations(workflow TEXT PRIMARY KEY,tenant INTEGER NOT NULL,
            grant_handle TEXT NOT NULL,expires REAL NOT NULL,definition_hash TEXT NOT NULL,revision INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS workflow_sources(workflow TEXT NOT NULL,source TEXT NOT NULL,version TEXT NOT NULL,
            PRIMARY KEY(workflow,source));
            CREATE TABLE IF NOT EXISTS workflow_event_queue(id TEXT PRIMARY KEY,workflow TEXT NOT NULL,tenant INTEGER NOT NULL,
            event TEXT NOT NULL,event_key TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL,
            ready_after REAL NOT NULL,created REAL NOT NULL,UNIQUE(workflow,event_key));
            """
            )
            # A process restart never silently resubmits an external operation.
            rows = c.execute(
                "SELECT id,state FROM workflow_runs WHERE status='running'"
            ).fetchall()
            for row in rows:
                state = json.loads(row["state"])
                uncertain = False
                for item in state["nodes"].values():
                    if item["status"] == "submitting":
                        item["status"] = "uncertain"
                        uncertain = True
                c.execute(
                    "UPDATE workflow_runs SET status=?,state=?,error=? WHERE id=?",
                    (
                        "uncertain" if uncertain else "waiting",
                        json.dumps(state),
                        "服务重启，请核对提交状态后继续。" if uncertain else None,
                        row["id"],
                    ),
                )

    def start_loop(self):
        self.loop_task = asyncio.create_task(self.loop())

    async def close(self):
        if self.loop_task:
            self.loop_task.cancel()
        for worker in list(self.workers.values()):
            worker.cancel()
        await asyncio.gather(*list(self.workers.values()), return_exceptions=True)
        if self.loop_task:
            await asyncio.gather(self.loop_task, return_exceptions=True)

    def get(self, tenant, ident):
        with self.ops.db() as c:
            row = c.execute(
                "SELECT * FROM workflows WHERE id=? AND tenant=?", (ident, tenant)
            ).fetchone()
        if not row:
            raise HTTPException(404, "工作流不存在。")
        return dict(row)

    def public(self, row):
        return {
            k: row[k]
            for k in [
                "id",
                "revision",
                "enabled",
                "next_at",
                "reason",
                "created",
                "updated",
            ]
        } | json.loads(row["definition"])

    def list(self, tenant):
        with self.ops.db() as c:
            rows = c.execute(
                "SELECT * FROM workflows WHERE tenant=? ORDER BY updated DESC LIMIT 200",
                (tenant,),
            ).fetchall()
        return {
            "items": [self.public(dict(r)) for r in rows],
            "templates": templates(),
            "node_types": NODE_TYPES,
        }

    async def save(self, s, body, ident=None):
        tenant = s["tenant_id"]
        definition = body.get("definition", body)
        definition, _ = validate_definition(definition)
        await self.bridge.php(s, "catalog")
        now = time.time()
        if ident:
            row = self.get(tenant, ident)
            if row["enabled"]:
                raise HTTPException(409, "请先停用工作流再修改。")
            with self.ops.db() as c:
                n = c.execute(
                    "UPDATE workflows SET definition=?,revision=revision+1,updated=? WHERE tenant=? AND id=? AND revision=? AND enabled=0",
                    (
                        json.dumps(definition, ensure_ascii=False),
                        now,
                        tenant,
                        ident,
                        body.get("revision"),
                    ),
                ).rowcount
                if n != 1:
                    raise HTTPException(409, "工作流版本已更新，请重新读取。")
        else:
            ident = secrets.token_hex(16)
            with self.ops.db() as c:
                c.execute(
                    "INSERT INTO workflows VALUES(?,?,1,?,0,NULL,'',?,?)",
                    (
                        ident,
                        tenant,
                        json.dumps(definition, ensure_ascii=False),
                        now,
                        now,
                    ),
                )
        return self.public(self.get(tenant, ident))

    async def validate_bindings(self, s, definition):
        bindings = definition.get("bindings", {})
        trigger = definition["trigger"]
        for field, spec in definition.get("fields", {}).items():
            if spec.get("required") and bindings.get(field) in [None, "", []]:
                raise HTTPException(422, "请完成参数：" + str(spec.get("label", field)))
        for node in definition["nodes"]:
            cfg = {**bindings, **node.get("config", {})}
            kind = node["type"]
            if kind in {"vlm_search", "onsite_search"}:
                if not cfg.get("query") or not cfg.get("provider_id"):
                    raise HTTPException(422, "搜索需要目标描述与视觉语言模型。")
                if (
                    not cfg.get("resource_ids")
                    and trigger.get("event") != "resource.uploaded"
                ):
                    raise HTTPException(422, "请选择需要搜索的图片或视频。")
            if kind == "change_pair" and not all(
                cfg.get(k) for k in ["before_id", "after_id"]
            ):
                raise HTTPException(422, "请选择基准图片和对比图片。")
            if kind == "change_mission" and not all(
                cfg.get(k) for k in ["airline_id", "baseline_mission"]
            ):
                raise HTTPException(422, "请选择航线和基准任务。")
            if kind in {"vlm_search", "onsite_search"} or cfg.get("provider_id"):
                catalog = await resource_json(
                    self.bridge.assistant, s, "GET", "/catalog"
                )
                if cfg.get("provider_id") not in {
                    m["id"] for m in catalog["vision_models"]
                }:
                    raise HTTPException(422, "所选视觉语言模型不可用。")
            if kind == "change_mission":
                from workbench_resources import association

                for key in ["baseline_mission", "current_mission"]:
                    if cfg.get(key):
                        await association(
                            self.bridge,
                            s,
                            {"route_id": cfg["airline_id"], "mission_id": cfg[key]},
                        )
            if kind == "task_plan" and not cfg.get("airline_id"):
                raise HTTPException(422, "任务计划需要绑定现有航线。")
            for key, resource in [
                ("airline_id", "routes"),
                ("equipment_id", "devices"),
                ("baseline_mission", "flight_tasks"),
                ("current_mission", "flight_tasks"),
            ]:
                if cfg.get(key):
                    result = await self.bridge.php(
                        s, "query", {"resource": resource, "id": str(cfg[key])}
                    )
                    if not result.get("result", {}).get("list"):
                        raise HTTPException(422, "所选航线、设备或任务不可用。")
            ids = cfg.get("resource_ids", []) + [
                cfg[k] for k in ["before_id", "after_id"] if cfg.get(k)
            ]
            if ids:
                assets = (
                    await resource_json(self.bridge.assistant, s, "GET", "?limit=500")
                )["items"]
                if not set(ids) <= {r["id"] for r in assets}:
                    raise HTTPException(422, "资源已移除或不在当前账号范围内。")
            if kind in {"annotation", "training_prepare"}:
                catalog = await self.bridge.assistant.runos(
                    s, "GET", "/api/assistant/catalog"
                )
                if cfg.get("dataset_id") not in {d["id"] for d in catalog["datasets"]}:
                    raise HTTPException(422, "请选择真实数据集。")
                if kind == "annotation" and cfg.get("annotation_model_id") not in {
                    m["id"] for m in catalog["annotation_models"]
                }:
                    raise HTTPException(422, "请选择可用于标注的模型。")
            if kind == "tune_prepare":
                await self.bridge.runtime(
                    s, "POST", "/assistant/validate", self.tune_args(cfg)
                )

    async def enable(self, s, ident, enabled, revision):
        lock = self.activation_locks.setdefault(ident, asyncio.Lock())
        async with lock:
            return await self._enable(s, ident, enabled, revision)

    async def _enable(self, s, ident, enabled, revision):
        row = self.get(s["tenant_id"], ident)
        if row["revision"] != revision:
            raise HTTPException(409, "工作流版本已更新。")
        if bool(row["enabled"]) == enabled:
            return self.public(row)
        definition = json.loads(row["definition"])
        if enabled:
            await self.validate_bindings(s, definition)
            if definition["trigger"].get("event") == "dataset.ready":
                observed = await self.data_versions(s, definition)
                with self.ops.db() as c:
                    for source, version in observed.items():
                        c.execute(
                            "INSERT OR REPLACE INTO workflow_sources VALUES(?,?,?)",
                            (ident, source, json.dumps(version)),
                        )
            import hashlib

            fingerprint = hashlib.sha256(row["definition"].encode()).hexdigest()
            grant = await self.bridge.php(
                s,
                "workflow_grant",
                {"workflow_id": ident, "definition_sha256": fingerprint},
            )
            with self.ops.db() as c:
                c.execute(
                    "INSERT OR REPLACE INTO workflow_authorizations VALUES(?,?,?,?,?,?)",
                    (
                        ident,
                        s["tenant_id"],
                        grant["workflow_handle"],
                        grant["expires_at"],
                        fingerprint,
                        row["revision"],
                    ),
                )
            # Seed completed tasks so enabling a trigger does not replay historical flights.
            if definition["trigger"].get("event") == "flight_task.completed":
                tasks = (
                    await self.bridge.php(
                        s, "query", {"resource": "flight_tasks", "limit": 100}
                    )
                )["result"].get("list", [])
                with self.ops.db() as c:
                    from workflow_adapters import task_completed

                    for task in tasks:
                        if task_completed(task):
                            c.execute(
                                "INSERT OR IGNORE INTO workflow_events VALUES(?,?,?)",
                                (
                                    ident,
                                    "flight_task.completed:" + str(task["id"]),
                                    time.time(),
                                ),
                            )
        else:
            await self.bridge.php(s, "workflow_revoke", {"workflow_id": ident})
            with self.ops.db() as c:
                c.execute(
                    "DELETE FROM workflow_authorizations WHERE workflow=? AND tenant=?",
                    (ident, s["tenant_id"]),
                )
            with self.ops.db() as c:
                c.execute(
                    "UPDATE workflow_event_queue SET status='cancelled',reason='工作流已停用。' WHERE workflow=? AND tenant=? AND status IN ('pending','waiting_media')",
                    (ident, s["tenant_id"]),
                )
        next_at = (
            time.time() + definition["trigger"].get("interval_minutes", 1440) * 60
            if enabled and definition["trigger"]["kind"] == "periodic"
            else None
        )
        with self.ops.db() as c:
            n = c.execute(
                "UPDATE workflows SET enabled=?,next_at=?,reason='',updated=? WHERE tenant=? AND id=? AND revision=?",
                (int(enabled), next_at, time.time(), s["tenant_id"], ident, revision),
            ).rowcount
            if n != 1:
                raise HTTPException(409, "工作流版本已更新。")
        return self.public(self.get(s["tenant_id"], ident))

    def run_row(self, tenant, ident):
        with self.ops.db() as c:
            row = c.execute(
                "SELECT * FROM workflow_runs WHERE id=? AND tenant=?", (ident, tenant)
            ).fetchone()
        if not row:
            raise HTTPException(404, "运行记录不存在。")
        return dict(row)

    def run_public(self, row):
        return {
            k: row[k]
            for k in [
                "id",
                "workflow",
                "revision",
                "status",
                "error",
                "created",
                "updated",
            ]
        } | {
            "state": json.loads(row["state"]),
            "definition": json.loads(row["snapshot"]),
        }

    def runs(self, tenant, workflow=None):
        query = "SELECT * FROM workflow_runs WHERE tenant=?"
        args = [tenant]
        if workflow:
            query += " AND workflow=?"
            args.append(workflow)
        with self.ops.db() as c:
            rows = c.execute(
                query + " ORDER BY created DESC LIMIT 100", args
            ).fetchall()
        return {"items": [self.run_public(dict(r)) for r in rows]}

    def checkpoint(self, row, state, status, error=None):
        with self.ops.db() as c:
            # A pause/cancel request wins over an already in-flight response.
            current = c.execute(
                "SELECT status FROM workflow_runs WHERE id=? AND tenant=?",
                (row["id"], row["tenant"]),
            ).fetchone()
            if current and current["status"] in {"cancelled", "paused"}:
                status = current["status"]
            c.execute(
                "UPDATE workflow_runs SET status=?,state=?,error=?,updated=? WHERE id=? AND tenant=?",
                (
                    status,
                    json.dumps(state, ensure_ascii=False),
                    error,
                    time.time(),
                    row["id"],
                    row["tenant"],
                ),
            )

    def background_session(self, tenant, ident):
        with self.ops.db() as c:
            grant = c.execute(
                "SELECT * FROM workflow_authorizations WHERE tenant=? AND workflow=? AND expires>?",
                (tenant, ident, time.time()),
            ).fetchone()
        if not grant:
            raise HTTPException(401, "工作流后台授权已到期，请停用后重新启用。")
        return {
            "tenant_id": tenant,
            "workflow_handle": grant["grant_handle"],
            "workflow_id": ident,
            "definition_revision": grant["revision"],
            "definition_hash": grant["definition_hash"],
        }

    def check_grant(self, s, ident, revision, snapshot):
        if not s.get("workflow_handle"):
            return
        import hashlib

        current = self.background_session(s["tenant_id"], ident)
        if (
            s != current
            or revision != current["definition_revision"]
            or hashlib.sha256(snapshot.encode()).hexdigest()
            != current["definition_hash"]
        ):
            raise HTTPException(403, "后台授权与当前工作流版本不一致。")

    async def start(self, s, ident, event_key="", event=None):
        row = self.get(s["tenant_id"], ident)
        self.check_grant(s, ident, row["revision"], row["definition"])
        definition = json.loads(row["definition"])
        await self.validate_bindings(s, definition)
        rid = secrets.token_hex(16)
        now = time.time()
        state = {
            "nodes": {n["id"]: {"status": "pending"} for n in definition["nodes"]},
            "event": event or {},
            "approved": [],
        }
        with self.ops.db() as c:
            c.execute("BEGIN IMMEDIATE")
            if c.execute(
                "SELECT 1 FROM workflow_runs WHERE tenant=? AND workflow=? AND status IN ("
                + ",".join("?" * len(ACTIVE))
                + ")",
                (s["tenant_id"], ident, *ACTIVE),
            ).fetchone():
                raise HTTPException(409, "此工作流已有未结束的运行，请先处理。")
            if event_key:
                if c.execute(
                    "SELECT 1 FROM workflow_events WHERE workflow=? AND event_key=?",
                    (ident, event_key),
                ).fetchone():
                    return None
                c.execute(
                    "INSERT INTO workflow_events VALUES(?,?,?)", (ident, event_key, now)
                )
            c.execute(
                "INSERT INTO workflow_runs VALUES(?,?,?,?,'queued',?,?,NULL,?,?,?)",
                (
                    rid,
                    s["tenant_id"],
                    ident,
                    row["revision"],
                    row["definition"],
                    json.dumps(state),
                    event_key,
                    now,
                    now,
                ),
            )
        self.wake(rid, s)
        return self.run_public(self.run_row(s["tenant_id"], rid))

    def wake(self, rid, s):
        if rid in self.workers:
            return
        task = asyncio.create_task(self.drive(s, rid))
        self.workers[rid] = task
        task.add_done_callback(lambda t: self.workers.pop(rid, None))

    async def drive(self, s, rid):
        async with self.slots:
            row = self.run_row(s["tenant_id"], rid)
            if row["status"] not in {"queued", "waiting", "running"}:
                return
            definition, order = validate_definition(json.loads(row["snapshot"]))
            state = json.loads(row["state"])
            lookup = {n["id"]: n for n in definition["nodes"]}
            item = {}
            try:
                self.check_grant(s, row["workflow"], row["revision"], row["snapshot"])
                await self.bridge.php(s, "catalog")
                for ident in order:
                    current = self.run_row(s["tenant_id"], rid)
                    if current["status"] in {
                        "paused",
                        "cancelled",
                        "waiting_review",
                        "uncertain",
                        "needs_auth",
                    }:
                        return
                    node = lookup[ident]
                    item = state["nodes"][ident]
                    if item["status"] == "succeeded":
                        continue
                    if item["status"] in {"failed", "uncertain"}:
                        return
                    parents = [
                        e["source"] for e in definition["edges"] if e["target"] == ident
                    ]
                    if not all(
                        state["nodes"][p]["status"] == "succeeded" for p in parents
                    ):
                        continue
                    cfg = {**definition.get("bindings", {}), **node.get("config", {})}
                    if state["event"].get("resource_id") and node["type"] in {
                        "vlm_search",
                        "onsite_search",
                    }:
                        cfg["resource_ids"] = [state["event"]["resource_id"]]
                    if (
                        state["event"].get("mission_id")
                        and node["type"] == "change_mission"
                    ):
                        cfg["current_mission"] = state["event"]["mission_id"]
                    outcome = await self.step(s, row, node, item, cfg, state)
                    item.update(outcome)
                    self.checkpoint(
                        row,
                        state,
                        (
                            "waiting_review"
                            if item["status"] == "waiting_review"
                            else "waiting" if item["status"] == "waiting" else "running"
                        ),
                    )
                    if item["status"] != "succeeded":
                        return
                status = (
                    "succeeded"
                    if all(n["status"] == "succeeded" for n in state["nodes"].values())
                    else "waiting"
                )
                self.checkpoint(row, state, status)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                status = (
                    "needs_auth"
                    if isinstance(exc, HTTPException) and exc.status_code in {401, 403}
                    else (
                        "uncertain"
                        if item.get("status") == "submitting"
                        and (
                            not isinstance(exc, HTTPException) or exc.status_code >= 500
                        )
                        else "failed"
                    )
                )
                item["status"] = status
                message = (
                    str(exc.detail)[:600]
                    if isinstance(exc, HTTPException)
                    else "工作流执行未完成，请检查节点与连接。"
                )
                item["error"] = message
                self.checkpoint(row, state, status, message)

    def previous(self, state, key):
        return next(
            (
                v.get("result", {})
                for v in reversed(list(state["nodes"].values()))
                if v.get("kind") == key and v["status"] == "succeeded"
            ),
            {},
        )

    def tune_args(self, cfg):
        return {
            "operation": "train",
            "args": {
                "model_name_or_path": cfg.get("model_name_or_path"),
                "dataset": cfg.get("dataset"),
                "dataset_dir": "data",
                "output_dir": cfg.get(
                    "output_dir", "workflows/tune-" + secrets.token_hex(4)
                ),
                "stage": cfg.get("stage", "sft"),
                "finetuning_type": cfg.get("finetuning_type", "lora"),
                "num_train_epochs": cfg.get("num_train_epochs", 3),
                "per_device_train_batch_size": cfg.get(
                    "per_device_train_batch_size", 1
                ),
                "gradient_accumulation_steps": cfg.get(
                    "gradient_accumulation_steps", 8
                ),
                "learning_rate": cfg.get("learning_rate", 0.0001),
            },
        }

    async def step(self, s, row, node, item, cfg, state):
        kind = node["type"]
        item["kind"] = kind
        service = self.bridge.assistant
        if kind in {"vlm_search", "onsite_search", "change_pair", "change_mission"}:
            if item.get("job_id"):
                job = await resource_json(
                    service, s, "GET", "/analyses/jobs/" + item["job_id"]
                )
            else:
                analysis = (
                    "smart_search" if kind in {"vlm_search", "onsite_search"} else kind
                )
                keys = {
                    "smart_search": [
                        "query",
                        "provider_id",
                        "resource_ids",
                        "interval_seconds",
                    ],
                    "change_pair": [
                        "before_id",
                        "after_id",
                        "sensitivity",
                        "assume_aligned",
                        "provider_id",
                    ],
                    "change_mission": [
                        "baseline_mission",
                        "current_mission",
                        "sensitivity",
                        "assume_aligned",
                        "provider_id",
                    ],
                }[analysis]
                body = {k: cfg[k] for k in keys if k in cfg}
                import hashlib

                body["request_id"] = hashlib.sha256(
                    (
                        row["id"] + ":" + node["id"] + ":" + str(item.get("attempt", 0))
                    ).encode()
                ).hexdigest()[:32]
                if kind == "change_mission":
                    body["route_id"] = str(cfg.get("airline_id", ""))
                if kind == "change_mission":
                    from native_media import import_mission

                    for mission in [
                        cfg.get("baseline_mission"),
                        cfg.get("current_mission"),
                    ]:
                        if mission:
                            await import_mission(self.bridge, s, mission)
                item["status"] = "submitting"
                self.checkpoint(row, state, "running")
                job = await resource_json(
                    service, s, "POST", "/analyses/" + analysis, body
                )
                item["job_id"] = job["id"]
            if job["status"] in {"failed", "interrupted"}:
                raise HTTPException(422, job.get("error") or "视觉分析未完成。")
            return {
                "status": "succeeded" if job["status"] == "succeeded" else "waiting",
                "result": job.get("result"),
                "job_id": job["id"],
            }
        if kind == "task_plan":
            if not item.get("result"):
                plan = await self.prepare_plan(
                    s,
                    {
                        "name": cfg.get("name", json.loads(row["snapshot"])["name"]),
                        "objective": cfg.get("objective", "巡检任务"),
                        "airline_id": cfg.get("airline_id"),
                        "equipment_id": cfg.get("equipment_id"),
                        "rth_altitude": cfg.get("rth_altitude", 100),
                        "schedule": json.loads(row["snapshot"])["trigger"],
                    },
                )
                return {"status": "succeeded", "result": plan}
            return {"status": "succeeded"}
        if kind in {"approval", "annotation_review"}:
            if node["id"] not in state["approved"]:
                return {
                    "status": "waiting_review",
                    "result": {"message": "请核对上游结果后确认继续。"},
                }
            return {"status": "succeeded"}
        if kind in {"annotation", "training", "tune"}:
            if kind == "annotation" and not item.get("draft_id"):
                draft = await service.runos(
                    s,
                    "POST",
                    "/api/assistant/drafts",
                    {
                        "kind": "annotation",
                        "data": {
                            "dataset_id": cfg.get("dataset_id"),
                            "model_id": cfg.get("annotation_model_id"),
                            "label": cfg.get("label"),
                            "text_prompt": cfg.get("text_prompt", cfg.get("label")),
                            "confidence_threshold": cfg.get(
                                "confidence_threshold", 0.5
                            ),
                            "on_verify_fail": "review",
                        },
                    },
                )
                item["draft_id"] = draft["id"]
                item["draft_revision"] = draft["revision"]
                item["status"] = "submitting"
                self.checkpoint(row, state, "running")
            if kind in {"training", "tune"} and not item.get("draft_id"):
                draft = self.previous(
                    state, "training_prepare" if kind == "training" else "tune_prepare"
                )
                if not draft.get("id"):
                    raise HTTPException(422, "缺少参数草稿。")
                item["draft_id"] = draft["id"]
                item["draft_revision"] = draft["revision"]
                item["status"] = "submitting"
                self.checkpoint(row, state, "running")
            path = (
                "/assistant/drafts/" + item["draft_id"]
                if kind == "tune"
                else "/api/assistant/drafts/" + item["draft_id"]
            )
            call = self.bridge.runtime if kind == "tune" else service.runos
            draft = await call(s, "GET", path)
            if draft["status"] == "prepared":
                item["status"] = "submitting"
                self.checkpoint(row, state, "running")
                draft = await call(
                    s, "POST", path + "/execute", {"revision": item["draft_revision"]}
                )
            if draft["status"] in {"uncertain", "submitting"}:
                raise HTTPException(503, "任务提交状态待核查，请在原任务列表检查。")
            result = draft.get("result") or {}
            job = (
                await self.bridge.runtime(s, "GET", "/jobs/" + str(result["id"]))
                if kind == "tune" and result.get("id")
                else draft.get("job", {})
            )
            status = job.get("status", "pending")
            if status in {"failed", "cancelled", "error", "stopped"}:
                raise HTTPException(422, "原业务任务未完成，请检查对应任务列表。")
            done = status in {"succeeded", "done", "completed"}
            return {
                "status": "succeeded" if done else "waiting",
                "result": {
                    "id": draft["id"],
                    "revision": draft["revision"],
                    "job": job,
                    "submitted": result,
                },
            }
        if kind == "dataset_split":
            annotation = self.previous(state, "annotation")
            did = annotation["id"]
            flow = await service.runos(s, "GET", "/api/assistant/flows/" + did)
            plan = {
                "train_ratio": cfg.get("train_ratio", 0.7),
                "val_ratio": cfg.get("val_ratio", 0.2),
                "test_ratio": cfg.get("test_ratio", 0.1),
                "output_name": cfg.get("output_name", "workflow-" + row["id"][:8]),
                "seed": cfg.get("seed", 42),
                "shuffle": True,
                "stratify": False,
            }
            item["status"] = "submitting"
            self.checkpoint(row, state, "running")
            flow = await service.runos(
                s,
                "POST",
                "/api/assistant/flows/" + did + "/split",
                {"revision": flow["revision"], "data": plan},
            )
            return {
                "status": "succeeded",
                "result": {"dataset_id": flow["target_dataset_id"], "flow_id": did},
            }
        if kind in {"training_prepare", "tune_prepare"}:
            if kind == "tune_prepare":
                draft = await self.bridge.runtime(
                    s, "POST", "/assistant/drafts", self.tune_args(cfg)
                )
            else:
                split = self.previous(state, "dataset_split")
                model = cfg.get("model_type", "yolov8n")
                from workflow_adapters import training_config

                draft = await service.runos(
                    s,
                    "POST",
                    "/api/assistant/drafts",
                    {
                        "kind": "training",
                        "data": training_config(cfg, split["dataset_id"]),
                    },
                )
                flow = await service.runos(
                    s, "GET", "/api/assistant/flows/" + split["flow_id"]
                )
                await service.runos(
                    s,
                    "POST",
                    "/api/assistant/flows/" + split["flow_id"] + "/bind-training",
                    {"revision": flow["revision"], "draft_id": draft["id"]},
                )
            return {"status": "succeeded", "result": draft}
        if kind == "report":
            return {
                "status": "succeeded",
                "result": {
                    "summary": [
                        {
                            "node": key,
                            "kind": value.get("kind"),
                            "result": value.get("result"),
                        }
                        for key, value in state["nodes"].items()
                        if value["status"] == "succeeded"
                    ]
                },
            }
        raise HTTPException(422, "节点类型无效。")

    async def control(self, s, rid, action, body):
        row = self.run_row(s["tenant_id"], rid)
        state = json.loads(row["state"])
        definition = json.loads(row["snapshot"])
        if action == "approve":
            if row["status"] != "waiting_review" or body.get("confirmed") is not True:
                raise HTTPException(409, "请核对当前确认节点。")
            waiting = [
                key
                for key, value in state["nodes"].items()
                if value["status"] == "waiting_review"
            ]
            for key in waiting:
                node = next(n for n in definition["nodes"] if n["id"] == key)
                if node["type"] == "annotation_review":
                    draft = self.previous(state, "annotation")
                    flow = await self.bridge.assistant.runos(
                        s, "GET", "/api/assistant/flows/" + draft["id"]
                    )
                    await self.bridge.assistant.runos(
                        s,
                        "POST",
                        "/api/assistant/flows/" + draft["id"] + "/review",
                        {
                            "revision": flow["revision"],
                            "confirmed": True,
                            "exclude_pending": body.get("exclude_pending", False),
                            "accept_partial": body.get("accept_partial", False),
                        },
                    )
                state["approved"].append(key)
                state["nodes"][key]["status"] = "pending"
            self.set_status(row, state, "queued")
            self.wake(rid, s)
        elif action == "pause":
            if row["status"] not in {"running", "waiting", "queued"}:
                raise HTTPException(409, "当前运行不能暂停。")
            self.set_status(row, state, "paused")
            await self.control_jobs(s, state, "pause")
        elif action == "cancel":
            if row["status"] == "succeeded":
                raise HTTPException(409, "运行已完成。")
            self.set_status(row, state, "cancelled")
            await self.control_jobs(s, state, "cancel")
        elif action in {"resume", "retry"}:
            allowed = {"paused", "needs_auth"} if action == "resume" else {"failed"}
            if row["status"] not in allowed:
                raise HTTPException(
                    409, "当前状态不能继续；不确定提交须先核查原业务任务。"
                )
            for item in state["nodes"].values():
                if item["status"] in {"failed", "needs_auth"}:
                    item["status"] = "pending"
                    item.pop("error", None)
                    if (
                        action == "retry"
                        and item.get("job_id")
                        and item.get("kind")
                        in {
                            "vlm_search",
                            "onsite_search",
                            "change_pair",
                            "change_mission",
                        }
                    ):
                        item.pop("job_id", None)
                        item["attempt"] = item.get("attempt", 0) + 1
            if row["status"] == "paused":
                await self.control_jobs(s, state, "resume")
            self.set_status(row, state, "queued")
            self.wake(rid, s)
        elif action == "reconcile":
            if row["status"] != "uncertain" or body.get("confirmed") is not True:
                raise HTTPException(409, "请先检查原任务列表，再核查当前提交。")
            for item in state["nodes"].values():
                if item["status"] != "uncertain":
                    continue
                kind = item.get("kind")
                if kind in {
                    "vlm_search",
                    "onsite_search",
                    "change_pair",
                    "change_mission",
                }:
                    item["status"] = "pending"
                elif kind in {"annotation", "training", "tune"} and item.get(
                    "draft_id"
                ):
                    path = (
                        "/assistant/drafts/" + item["draft_id"]
                        if kind == "tune"
                        else "/api/assistant/drafts/" + item["draft_id"]
                    )
                    call = (
                        self.bridge.runtime
                        if kind == "tune"
                        else self.bridge.assistant.runos
                    )
                    draft = await call(s, "GET", path)
                    if draft["status"] not in {"prepared", "submitted"}:
                        raise HTTPException(
                            409,
                            "原业务提交仍待核查，请先在对应任务列表处理，勿重复创建。",
                        )
                    item["status"] = "waiting"
                elif kind == "dataset_split":
                    draft = self.previous(state, "annotation")
                    flow = await self.bridge.assistant.runos(
                        s, "GET", "/api/assistant/flows/" + draft["id"]
                    )
                    if flow["stage"] in {"split_done", "training_ready"}:
                        item.update(
                            status="succeeded",
                            result={
                                "dataset_id": flow["target_dataset_id"],
                                "flow_id": draft["id"],
                            },
                        )
                    elif flow["stage"] == "split_ready":
                        item["status"] = "pending"
                    else:
                        raise HTTPException(
                            409, "原数据划分仍待核查，请在数据集列表确认。"
                        )
                else:
                    raise HTTPException(
                        409, "此步骤需要先核对原业务记录，可以取消运行后重新规划。"
                    )
            self.set_status(row, state, "queued")
            self.wake(rid, s)
        else:
            raise HTTPException(422, "运行操作无效。")
        return self.run_public(self.run_row(s["tenant_id"], rid))

    def set_status(self, row, state, status):
        with self.ops.db() as c:
            c.execute(
                "UPDATE workflow_runs SET status=?,state=?,error=NULL,updated=? WHERE id=? AND tenant=?",
                (status, json.dumps(state), time.time(), row["id"], row["tenant"]),
            )

    async def control_jobs(self, s, state, action):
        for item in state["nodes"].values():
            if (
                item.get("draft_id")
                and item.get("kind") in {"annotation", "training"}
                and item["status"] in {"waiting", "submitting"}
            ):
                await self.bridge.assistant.runos(
                    s,
                    "POST",
                    "/api/assistant/drafts/" + item["draft_id"] + "/control/" + action,
                    {},
                )
            if (
                item.get("kind") == "tune"
                and action == "cancel"
                and item.get("result", {}).get("submitted", {}).get("id")
            ):
                await self.bridge.runtime(
                    s,
                    "POST",
                    "/jobs/" + item["result"]["submitted"]["id"] + "/cancel",
                    {},
                )

    async def _plan_payload(self, s, body):
        allowed = {
            "name",
            "objective",
            "airline_id",
            "equipment_id",
            "rth_altitude",
            "schedule",
            "analysis",
            "onsite",
        }
        if not isinstance(body, dict) or set(body) - allowed:
            raise HTTPException(422, "任务计划字段无效。")
        name = body.get("name", "巡检任务计划")
        objective = body.get("objective", "")
        if (
            not isinstance(name, str)
            or not 1 <= len(name) <= 120
            or not isinstance(objective, str)
            or not 1 <= len(objective) <= 2000
        ):
            raise HTTPException(422, "请填写任务名称与目标。")
        refs = {}
        for key, resource in [("airline_id", "routes"), ("equipment_id", "devices")]:
            if body.get(key):
                values = (
                    await self.bridge.php(
                        s, "query", {"resource": resource, "id": str(body[key])}
                    )
                )["result"].get("list", [])
                if not values:
                    raise HTTPException(404, "所选航线或设备不存在。")
                refs[key] = {
                    "id": values[0]["id"],
                    "name": values[0].get(
                        "name", values[0].get("nickname", str(values[0]["id"]))
                    ),
                }
        if "airline_id" not in refs:
            raise HTTPException(422, "请先选择已保存的航线。")
        altitude = body.get("rth_altitude", 100)
        if type(altitude) is not int or not 20 <= altitude <= 500:
            raise HTTPException(422, "返航高度须为 20 至 500 米。")
        schedule = body.get("schedule", {"kind": "manual"})
        if (
            not isinstance(schedule, dict)
            or set(schedule) - {"kind", "event", "interval_minutes", "execute_time"}
            or schedule.get("kind") not in {"manual", "periodic", "event", "once"}
        ):
            raise HTTPException(422, "任务计划时间设置无效。")
        if schedule["kind"] == "periodic":
            interval = schedule.get("interval_minutes", 1440)
            if (
                type(interval) not in [int, float]
                or not math.isfinite(interval)
                or not 1 <= interval <= 525600
            ):
                raise HTTPException(422, "计划周期须为 1 至 525600 分钟。")
        if schedule["kind"] == "event" and schedule.get("event") not in EVENTS:
            raise HTTPException(422, "计划触发事件无效。")
        if schedule["kind"] == "once":
            when = schedule.get("execute_time")
            if (
                type(when) is not int
                or not time.time() + 30 <= when <= time.time() + 31536000
            ):
                raise HTTPException(422, "计划执行时间须在 30 秒后、1 年内。")
        payload = {
            **body,
            "name": name,
            "rth_altitude": altitude,
            "resources": refs,
            "schedule": schedule,
            "steps": [
                {
                    "title": "飞行前核对",
                    "description": "核对设备、航线、天气、空域、电量及高度基准。",
                },
                {
                    "title": "人工确认任务",
                    "description": "确认航线和执行时间后，通过原飞行任务页面下发。",
                },
                {
                    "title": "采集巡检影像",
                    "description": "按航线采集，保留任务、航点和拍摄时间关联。",
                },
                {
                    "title": "智能分析",
                    "description": "选择 VLM 搜索或任务关联变化检测。",
                },
                {
                    "title": "复核与归档",
                    "description": "检查候选结果，归档报告并安排下一轮。",
                },
            ],
            "dispatched": False,
            "automatic_takeoff": False,
        }
        return payload

    async def prepare_plan(self, s, body):
        payload = await self._plan_payload(s, body)
        ident = secrets.token_hex(16)
        now = time.time()
        with self.ops.db() as c:
            c.execute(
                "INSERT INTO task_plans VALUES(?,?,1,'draft',?,?,?)",
                (
                    ident,
                    s["tenant_id"],
                    json.dumps(payload, ensure_ascii=False),
                    now,
                    now,
                ),
            )
        return {
            "id": ident,
            "status": "draft",
            "revision": 1,
            "data": payload,
            "dispatched": False,
        }

    def plans(self, tenant):
        with self.ops.db() as c:
            rows = c.execute(
                "SELECT * FROM task_plans WHERE tenant=? ORDER BY created DESC LIMIT 100",
                (tenant,),
            ).fetchall()
        return {
            "items": [
                {
                    "id": r["id"],
                    "revision": r["revision"],
                    "status": r["status"],
                    "data": json.loads(r["payload"]),
                    "created": r["created"],
                }
                for r in rows
            ]
        }

    def plan_row(self, tenant, ident):
        with self.ops.db() as c:
            row = c.execute(
                "SELECT * FROM task_plans WHERE id=? AND tenant=?", (ident, tenant)
            ).fetchone()
        if not row:
            raise HTTPException(404, "任务计划不存在。")
        return dict(row)

    async def update_plan(self, s, ident, body):
        row = self.plan_row(s["tenant_id"], ident)
        if set(body) != {"revision", "data"} or row["revision"] != body["revision"]:
            raise HTTPException(409, "任务计划已更新，请重新读取。")
        payload = await self._plan_payload(s, body["data"])
        with self.ops.db() as c:
            c.execute("BEGIN IMMEDIATE")
            current = c.execute(
                "SELECT * FROM task_plans WHERE id=? AND tenant=?",
                (ident, s["tenant_id"]),
            ).fetchone()
            if (
                current["revision"] != body["revision"]
                or current["status"] == "preparing"
            ):
                raise HTTPException(409, "任务计划正在准备或版本已更新。")
            old = json.loads(current["payload"])
            if old.get("last_request_id"):
                operation = c.execute(
                    "SELECT status FROM operations WHERE id=? AND tenant=?",
                    (old["last_request_id"], s["tenant_id"]),
                ).fetchone()
                if operation and operation["status"] in {"executing", "completed"}:
                    raise HTTPException(409, "任务已下发或正在确认，不能修改此计划。")
                c.execute(
                    "UPDATE operations SET status='rejected' WHERE id=? AND tenant=? AND status='pending'",
                    (old["last_request_id"], s["tenant_id"]),
                )
            n = c.execute(
                "UPDATE task_plans SET payload=?,status='draft',revision=revision+1,updated=? WHERE id=? AND tenant=? AND revision=?",
                (
                    json.dumps(payload, ensure_ascii=False),
                    time.time(),
                    ident,
                    s["tenant_id"],
                    body["revision"],
                ),
            ).rowcount
            if n != 1:
                raise HTTPException(409, "任务计划版本已更新。")
        return self.plan_row(s["tenant_id"], ident)["revision"]

    async def prepare_flight(self, s, ident, body):
        row = self.plan_row(s["tenant_id"], ident)
        data = json.loads(row["payload"])
        if (
            set(body) - {"revision", "execute_time"}
            or body.get("revision") != row["revision"]
        ):
            raise HTTPException(409, "任务计划版本已更新。")
        if not data.get("equipment_id"):
            raise HTTPException(422, "请先编辑计划并选择设备。")
        when = body.get("execute_time")
        if when is not None and (
            type(when) is not int
            or not time.time() + 30 <= when <= time.time() + 31536000
        ):
            raise HTTPException(422, "执行时间须在 30 秒后、1 年内。")
        with self.ops.db() as c:
            c.execute("BEGIN IMMEDIATE")
            current = c.execute(
                "SELECT * FROM task_plans WHERE id=? AND tenant=?",
                (ident, s["tenant_id"]),
            ).fetchone()
            if (
                current["revision"] != body["revision"]
                or current["status"] == "preparing"
            ):
                raise HTTPException(409, "计划正在准备，请稍后读取确认结果。")
            data = json.loads(current["payload"])
            if data.get("last_request_id"):
                operation = c.execute(
                    "SELECT * FROM operations WHERE id=? AND tenant=?",
                    (data["last_request_id"], s["tenant_id"]),
                ).fetchone()
                if operation and operation["status"] in {"executing", "completed"}:
                    raise HTTPException(
                        409, "此计划已进入下发流程，请在任务记录中查看。"
                    )
                if (
                    operation
                    and operation["status"] == "pending"
                    and operation["expires"] > time.time()
                    and data.get("_requested_time") == when
                ):
                    return {
                        "request_id": operation["id"],
                        "status": "pending",
                        "confirmation_url": self.bridge.settings.portal_url.rstrip("/")
                        + "/llm-center/agent/platform/requests/"
                        + operation["id"],
                        "dispatched": False,
                    }
                if operation:
                    c.execute(
                        "UPDATE operations SET status='rejected' WHERE id=? AND status='pending'",
                        (operation["id"],),
                    )
            c.execute(
                "UPDATE task_plans SET status='preparing' WHERE id=? AND tenant=?",
                (ident, s["tenant_id"]),
            )
        from platform_mcp import invoke

        args = {
            "name": data["name"],
            "airline_id": int(data["airline_id"]),
            "equipment_id": int(data["equipment_id"]),
            "task_type": 1 if when else 0,
            "rth_altitude": data["rth_altitude"],
        }
        if when:
            args["execute_time"] = when
        # This invokes only the existing preparation tool, never flight_dispatch.
        try:
            prepared = await invoke(
                "flight_prepare_task", args, s, self.bridge, self.ops
            )
        except Exception:
            with self.ops.db() as c:
                c.execute(
                    "UPDATE task_plans SET status='draft' WHERE id=? AND tenant=? AND status='preparing'",
                    (ident, s["tenant_id"]),
                )
            raise
        data["last_request_id"] = prepared["request_id"]
        data["_requested_time"] = when
        with self.ops.db() as c:
            c.execute(
                "UPDATE task_plans SET payload=?,status='pending_confirmation',updated=? WHERE id=? AND tenant=?",
                (
                    json.dumps(data, ensure_ascii=False),
                    time.time(),
                    ident,
                    s["tenant_id"],
                ),
            )
        return prepared

    async def event(self, s, event, key, payload):
        if event not in EVENTS:
            raise HTTPException(422, "触发事件无效。")
        with self.ops.db() as c:
            rows = c.execute(
                "SELECT * FROM workflows WHERE tenant=? AND enabled=1",
                (s["tenant_id"],),
            ).fetchall()
        for row in rows:
            if s.get("workflow_handle") and s.get("workflow_id") != row["id"]:
                continue
            definition = json.loads(row["definition"])
            if definition["trigger"].get("event") != event:
                continue
            if (
                event == "resource.uploaded"
                and payload.get("kind") not in {None, "image", "video"}
                and any(
                    n["type"] in {"vlm_search", "onsite_search"}
                    for n in definition["nodes"]
                )
            ):
                continue
            bindings = definition.get("bindings", {})
            if (
                event == "flight_task.completed"
                and bindings.get("airline_id")
                and str(bindings["airline_id"]) != str(payload.get("airline_id"))
            ):
                continue
            if (
                event == "dataset.ready"
                and bindings.get("dataset_id")
                and str(bindings["dataset_id"]) != str(payload.get("dataset_id"))
            ):
                continue
            if (
                event == "dataset.ready"
                and bindings.get("dataset")
                and payload.get("dataset_name")
                and str(bindings["dataset"]) != str(payload["dataset_name"])
            ):
                continue
            event_key = event + ":" + str(key)
            with self.ops.db() as c:
                if c.execute(
                    "SELECT 1 FROM workflow_events WHERE workflow=? AND event_key=?",
                    (row["id"], event_key),
                ).fetchone():
                    continue
                c.execute(
                    "INSERT OR IGNORE INTO workflow_event_queue VALUES(?,?,?,?,?,?,'pending','',?,?)",
                    (
                        secrets.token_hex(16),
                        row["id"],
                        s["tenant_id"],
                        event,
                        event_key,
                        json.dumps(payload),
                        time.time() + (60 if event == "flight_task.completed" else 0),
                        time.time(),
                    ),
                )
            await self.drain_events(s, row["id"])

    def events(self, tenant):
        with self.ops.db() as c:
            rows = c.execute(
                "SELECT q.*,w.definition FROM workflow_event_queue q JOIN workflows w ON w.id=q.workflow WHERE q.tenant=? ORDER BY q.created DESC LIMIT 100",
                (tenant,),
            ).fetchall()
        return {
            "items": [
                {
                    k: r[k]
                    for k in ["id", "workflow", "event", "status", "reason", "created"]
                }
                | {"name": json.loads(r["definition"])["name"]}
                for r in rows
            ]
        }

    async def drain_events(self, s, workflow):
        row = self.get(s["tenant_id"], workflow)
        if not row["enabled"]:
            return
        try:
            s = self.background_session(s["tenant_id"], workflow)
            self.check_grant(s, workflow, row["revision"], row["definition"])
        except HTTPException as error:
            with self.ops.db() as c:
                c.execute(
                    "UPDATE workflows SET reason=? WHERE id=? AND tenant=?",
                    (str(error.detail), workflow, s["tenant_id"]),
                )
            return
        definition = json.loads(row["definition"])
        with self.ops.db() as c:
            events = c.execute(
                "SELECT * FROM workflow_event_queue WHERE workflow=? AND tenant=? AND status IN ('pending','waiting_media') AND ready_after<=? ORDER BY created LIMIT 30",
                (workflow, s["tenant_id"], time.time()),
            ).fetchall()
        for event in events:
            payload = json.loads(event["payload"])
            try:
                if event["event"] == "flight_task.completed" and any(
                    n["type"] == "change_mission" for n in definition["nodes"]
                ):
                    from native_media import mission_assets

                    _, media = await mission_assets(
                        self.bridge, s, payload["mission_id"]
                    )
                    own = await resource_json(
                        self.bridge.assistant,
                        s,
                        "GET",
                        "?mission_id="
                        + str(payload["mission_id"])
                        + "&kind=image&limit=1",
                    )
                    if not media and not own.get("items"):
                        if time.time() - event["created"] > 86400:
                            raise HTTPException(
                                422,
                                "任务完成后 24 小时仍未找到影像，请导入照片并重新触发。",
                            )
                        with self.ops.db() as c:
                            c.execute(
                                "UPDATE workflow_event_queue SET status='waiting_media',reason='等待任务影像上传。' WHERE id=?",
                                (event["id"],),
                            )
                        continue
                await self.start(s, workflow, event["event_key"], payload)
                with self.ops.db() as c:
                    c.execute(
                        "DELETE FROM workflow_event_queue WHERE id=?", (event["id"],)
                    )
                break
            except HTTPException as exc:
                if exc.status_code == 409:
                    return
                with self.ops.db() as c:
                    c.execute(
                        "UPDATE workflow_event_queue SET status='failed',reason=? WHERE id=?",
                        (str(exc.detail)[:500], event["id"]),
                    )
                    c.execute(
                        "UPDATE workflows SET reason=? WHERE id=?",
                        (str(exc.detail)[:500], workflow),
                    )

    async def data_versions(self, s, definition):
        bindings = definition.get("bindings", {})
        if any(n["type"] == "tune_prepare" for n in definition["nodes"]):
            catalog = await self.bridge.runtime(s, "GET", "/assistant/catalog")
            return {
                "tune:" + name: version
                for name, version in catalog.get("dataset_versions", {}).items()
                if name in str(bindings.get("dataset", "")).split(",")
            }
        catalog = await self.bridge.assistant.runos(s, "GET", "/api/assistant/catalog")
        # Annotation count changes do not trigger another annotation loop. Only
        # additions/removals of source images are data-ready events.
        return {
            "runos:" + d["id"]: d.get("num_images", 0)
            for d in catalog.get("datasets", [])
            if d["id"] == bindings.get("dataset_id")
        }

    async def loop(self):
        while True:
            try:
                from platform_mcp import gateway_session

                with self.ops.db() as c:
                    due = c.execute(
                        "SELECT * FROM workflows WHERE enabled=1"
                    ).fetchall()
                    waiting = c.execute(
                        "SELECT * FROM workflow_runs WHERE status IN ('queued','waiting')"
                    ).fetchall()
                sessions = {}
                grants = {}
                with self.ops.db() as c:
                    for g in c.execute(
                        "SELECT * FROM workflow_authorizations WHERE expires>?",
                        (time.time(),),
                    ):
                        grants[g["workflow"]] = {
                            "tenant_id": g["tenant"],
                            "workflow_handle": g["grant_handle"],
                            "definition_revision": g["revision"],
                            "workflow_id": g["workflow"],
                            "definition_hash": g["definition_hash"],
                        }
                for tenant in {r["tenant"] for r in due} | {
                    r["tenant"] for r in waiting
                }:
                    try:
                        sessions[tenant] = gateway_session(
                            self.bridge.settings.gateway_db, tenant=tenant
                        )
                    except HTTPException:
                        continue
                for row in due:
                    try:
                        s = grants.get(row["id"])
                        if not s:
                            with self.ops.db() as c:
                                c.execute(
                                    "UPDATE workflows SET reason='后台授权已到期，请停用后重新启用。' WHERE id=?",
                                    (row["id"],),
                                )
                            continue
                        definition = json.loads(row["definition"])
                        trigger = definition["trigger"]
                        await self.drain_events(s, row["id"])
                        if (
                            trigger["kind"] == "periodic"
                            and row["next_at"]
                            and row["next_at"] <= time.time()
                        ):
                            try:
                                await self.start(
                                    s,
                                    row["id"],
                                    "periodic:" + str(int(row["next_at"])),
                                    {},
                                )
                            except HTTPException as exc:
                                with self.ops.db() as c:
                                    c.execute(
                                        "UPDATE workflows SET reason=? WHERE id=?",
                                        (str(exc.detail)[:500], row["id"]),
                                    )
                            with self.ops.db() as c:
                                c.execute(
                                    "UPDATE workflows SET next_at=? WHERE id=?",
                                    (
                                        time.time()
                                        + trigger.get("interval_minutes", 1440) * 60,
                                        row["id"],
                                    ),
                                )
                        if trigger.get("event") == "flight_task.completed":
                            rows = (
                                await self.bridge.php(
                                    s,
                                    "query",
                                    {"resource": "flight_tasks", "limit": 100},
                                )
                            )["result"].get("list", [])
                            for task in rows:
                                from workflow_adapters import task_completed

                                if task_completed(task):
                                    await self.event(
                                        s,
                                        "flight_task.completed",
                                        str(task["id"]),
                                        {
                                            "mission_id": str(task["id"]),
                                            "airline_id": task.get("airline_id"),
                                        },
                                    )
                        if trigger.get("event") == "dataset.ready":
                            versions = await self.data_versions(s, definition)
                            for source, version in versions.items():
                                encoded = json.dumps(version)
                                with self.ops.db() as c:
                                    old = c.execute(
                                        "SELECT version FROM workflow_sources WHERE workflow=? AND source=?",
                                        (row["id"], source),
                                    ).fetchone()
                                if old and old["version"] != encoded:
                                    import hashlib

                                    key = (
                                        source
                                        + ":"
                                        + hashlib.sha256(encoded.encode()).hexdigest()[
                                            :20
                                        ]
                                    )
                                    payload = (
                                        {"dataset_name": source[5:]}
                                        if source.startswith("tune:")
                                        else {"dataset_id": source[6:]}
                                    )
                                    await self.event(s, "dataset.ready", key, payload)
                                with self.ops.db() as c:
                                    c.execute(
                                        "INSERT OR REPLACE INTO workflow_sources VALUES(?,?,?)",
                                        (row["id"], source, encoded),
                                    )
                    except asyncio.CancelledError:
                        raise
                    except Exception as exc:
                        reason = (
                            str(exc.detail)[:300]
                            if isinstance(exc, HTTPException)
                            else "后台检查未完成，请检查关联服务后重试。"
                        )
                        with self.ops.db() as c:
                            c.execute(
                                "UPDATE workflows SET reason=? WHERE id=? AND tenant=?",
                                (reason, row["id"], row["tenant"]),
                            )
                for row in waiting:
                    s = grants.get(row["workflow"])
                    if s and s["definition_revision"] != row["revision"]:
                        s = None
                    s = s or sessions.get(row["tenant"])
                    if s:
                        self.wake(row["id"], s)
            except asyncio.CancelledError:
                raise
            except Exception:
                # Per-run errors are persisted by drive; one temporary control-plane
                # failure must not kill the scheduler or submit duplicate jobs.
                pass
            await asyncio.sleep(15)
