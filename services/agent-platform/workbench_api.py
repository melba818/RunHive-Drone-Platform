import asyncio, json, re
from fastapi import HTTPException, Request
from workflow_templates import templates, NODE_TYPES
from workflow_engine import validate_definition
from workbench_resources import resource_json, install as install_resources


async def catalog(bridge, s):
    result = {"errors": {}}

    async def fetch(key, fn):
        try:
            value = await fn()
            if key in {"routes", "devices", "flight_tasks", "media"}:
                fields = {
                    "routes": {"id", "name", "project_id"},
                    "devices": {"id", "nickname", "sn", "status"},
                    "flight_tasks": {
                        "id",
                        "name",
                        "airline_id",
                        "equipment_id",
                        "status",
                        "execute_time",
                        "end_time",
                    },
                    "media": {"id", "name", "type", "flight_id"},
                }[key]
                value = {
                    **value,
                    "result": {
                        "list": [
                            {k: v for k, v in row.items() if k in fields}
                            for row in value.get("result", {}).get("list", [])
                        ]
                    },
                }
            result[key] = value
        except HTTPException as exc:
            result["errors"][key] = str(exc.detail)[:300]

    await asyncio.gather(
        fetch(
            "runos", lambda: bridge.assistant.runos(s, "GET", "/api/assistant/catalog")
        ),
        fetch("vision", lambda: resource_json(bridge.assistant, s, "GET", "/catalog")),
        fetch(
            "resources", lambda: resource_json(bridge.assistant, s, "GET", "?limit=100")
        ),
        fetch("tune", lambda: bridge.runtime(s, "GET", "/assistant/catalog")),
        *[
            fetch(
                key,
                lambda key=key: bridge.php(s, "query", {"resource": key, "limit": 100}),
            )
            for key in ["routes", "devices", "flight_tasks", "media"]
        ]
    )
    return result


def install(app, prefix, identity, write, bounded_json):
    install_resources(app, prefix, identity, write, bounded_json)

    @app.get(prefix + "/workbench/catalog")
    async def catalog_get(request: Request):
        return await catalog(app.state.bridge, await identity(request))

    @app.get(prefix + "/workbench/mission-media/{ident}")
    async def mission_media(ident: str, request: Request):
        from native_media import mission_assets

        task, assets = await mission_assets(
            app.state.bridge, await identity(request), ident
        )
        return {"task": task, "items": assets}

    @app.post(prefix + "/resources/import-native")
    async def native_import(request: Request):
        from native_media import import_asset, import_mission

        s = await identity(request)
        await write(request, s)
        body = await bounded_json(request)
        if set(body) - {"media_id", "mission_id"}:
            raise HTTPException(422, "任务媒体导入字段无效。")
        if body.get("media_id"):
            return await import_asset(
                app.state.bridge, s, body["media_id"], body.get("mission_id")
            )
        if body.get("mission_id"):
            return await import_mission(app.state.bridge, s, body["mission_id"])
        raise HTTPException(422, "请选择平台媒体或航线任务。")

    @app.get(prefix + "/workflows")
    async def listed(request: Request):
        return app.state.workflows.list((await identity(request))["tenant_id"])

    @app.get(prefix + "/workflows/{ident}")
    async def detail(ident: str, request: Request):
        s = await identity(request)
        return app.state.workflows.public(
            app.state.workflows.get(s["tenant_id"], ident)
        )

    @app.post(prefix + "/workflows")
    async def create(request: Request):
        s = await identity(request)
        await write(request, s)
        return await app.state.workflows.save(s, await bounded_json(request))

    @app.put(prefix + "/workflows/{ident}")
    async def update(ident: str, request: Request):
        s = await identity(request)
        await write(request, s)
        return await app.state.workflows.save(s, await bounded_json(request), ident)

    @app.post(prefix + "/workflows/{ident}/validate")
    async def validate(ident: str, request: Request):
        s = await identity(request)
        await write(request, s)
        row = app.state.workflows.get(s["tenant_id"], ident)
        await app.state.workflows.validate_bindings(s, json.loads(row["definition"]))
        return {"valid": True, "dispatched": False}

    @app.post(prefix + "/workflows/{ident}/enable")
    async def enable(ident: str, request: Request):
        s = await identity(request)
        await write(request, s)
        body = await bounded_json(request)
        if set(body) != {"enabled", "revision"} or type(body["enabled"]) is not bool:
            raise HTTPException(422, "启用参数无效。")
        return await app.state.workflows.enable(
            s, ident, body["enabled"], body["revision"]
        )

    @app.post(prefix + "/workflows/{ident}/run")
    async def start(ident: str, request: Request):
        s = await identity(request)
        await write(request, s)
        body = await bounded_json(request)
        if body.get("confirmed") is not True:
            raise HTTPException(422, "请确认工作流资源与执行范围。")
        return await app.state.workflows.start(s, ident)

    @app.get(prefix + "/workflow-runs")
    async def runs(request: Request, workflow: str | None = None):
        return app.state.workflows.runs(
            (await identity(request))["tenant_id"], workflow
        )

    @app.get(prefix + "/workflow-runs/{ident}")
    async def run(ident: str, request: Request):
        s = await identity(request)
        return app.state.workflows.run_public(
            app.state.workflows.run_row(s["tenant_id"], ident)
        )

    @app.post(prefix + "/workflow-runs/{ident}/{action}")
    async def control(ident: str, action: str, request: Request):
        s = await identity(request)
        await write(request, s)
        return await app.state.workflows.control(
            s, ident, action, await bounded_json(request)
        )

    @app.get(prefix + "/task-plans")
    async def plans(request: Request):
        return app.state.workflows.plans((await identity(request))["tenant_id"])

    @app.post(prefix + "/task-plans")
    async def plan(request: Request):
        s = await identity(request)
        await write(request, s)
        return await app.state.workflows.prepare_plan(s, await bounded_json(request))

    @app.put(prefix + "/task-plans/{ident}")
    async def update_plan(ident: str, request: Request):
        s = await identity(request)
        await write(request, s)
        revision = await app.state.workflows.update_plan(
            s, ident, await bounded_json(request)
        )
        return {
            "id": ident,
            "revision": revision,
            "status": "draft",
            "dispatched": False,
        }

    @app.post(prefix + "/task-plans/{ident}/prepare-flight")
    async def prepare_flight(ident: str, request: Request):
        s = await identity(request)
        await write(request, s)
        return await app.state.workflows.prepare_flight(
            s, ident, await bounded_json(request)
        )

    @app.post(prefix + "/workflow-events")
    async def event(request: Request):
        s = await identity(request)
        await write(request, s)
        body = await bounded_json(request)
        if set(body) - {"event", "key", "dataset_id", "workflow_id"} or body.get(
            "event"
        ) not in {"dataset.ready", "manual.trigger"}:
            raise HTTPException(422, "手动触发事件无效。")
        payload = {}
        if body["event"] == "dataset.ready":
            data = await app.state.bridge.assistant.runos(
                s, "GET", "/api/assistant/catalog"
            )
            if body.get("dataset_id") not in {d["id"] for d in data["datasets"]}:
                raise HTTPException(422, "请选择已就绪的实际数据集。")
            payload["dataset_id"] = body["dataset_id"]
        if not isinstance(body.get("key"), str) or not 1 <= len(body["key"]) <= 120:
            raise HTTPException(422, "事件唯一标识无效。")
        await app.state.workflows.event(s, body["event"], body["key"], payload)
        return {"accepted": True, "dispatched": False}

    @app.get(prefix + "/workflow-events")
    async def event_queue(request: Request):
        return app.state.workflows.events((await identity(request))["tenant_id"])

    @app.post(prefix + "/workflow-events/{ident}/retry")
    async def retry_event(ident: str, request: Request):
        s = await identity(request)
        await write(request, s)
        with app.state.ops.db() as c:
            n = c.execute(
                "UPDATE workflow_event_queue SET status='pending',reason='',ready_after=0 WHERE id=? AND tenant=? AND status='failed'",
                (ident, s["tenant_id"]),
            ).rowcount
            if n != 1:
                raise HTTPException(409, "事件不存在或尚未失败。")
        return {"accepted": True}


def agent_tools(tool, STR, OBJ):
    definitions = [
        tool(
            "assistant_task_plan",
            "根据真实航线与设备准备任务计划草稿：任务目标、周期或触发方式、采集、分析与复核步骤。不会下发飞行。先选择实际资源；缺少资源时 assistant_choose，调用后等待用户核对。",
            {
                "name": STR,
                "objective": STR,
                "airline_id": STR,
                "equipment_id": STR,
                "rth_altitude": {"type": "integer", "minimum": 20, "maximum": 500},
                "schedule": OBJ,
            },
            ["objective", "airline_id"],
        ),
        tool(
            "assistant_workflow_prepare",
            "从周期性或触发式示例模板准备停用状态的工作流。bindings 必须来自实际资源目录。不会自动运行、启用或起飞；返回工作流中心供用户核对。",
            {"template_id": STR, "name": STR, "bindings": OBJ, "trigger": OBJ},
            ["template_id", "bindings"],
        ),
        tool(
            "assistant_workflows",
            "读取真实工作流、任务计划、运行记录与示例模板。先读取目录再配置，不能编造资源 ID。",
            {
                "view": {
                    "type": "string",
                    "enum": ["catalog", "templates", "workflows", "plans", "runs"],
                }
            },
            ["view"],
        ),
        tool(
            "assistant_resource_search",
            "用已配置 VLM 对真实图片或抽样视频进行目标搜索；resource_ids 来自 assistant_workflows(view=catalog) 的 resources.items，不是 platform_query(media) 的原始媒体编号。返回异步分析记录，不以文件名匹配冒充视觉搜索，不循环轮询。",
            {
                "query": STR,
                "provider_id": STR,
                "resource_ids": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 50,
                    "items": STR,
                },
                "route_id": STR,
                "mission_id": STR,
            },
            ["query", "provider_id"],
        ),
        tool(
            "assistant_change_detection",
            "对两张实际图片或同航线不同任务的影像创建变化分析。自动配准；视角不可靠时提示换图。不循环轮询。",
            {
                "kind": {"type": "string", "enum": ["change_pair", "change_mission"]},
                "before_id": STR,
                "after_id": STR,
                "route_id": STR,
                "baseline_mission": STR,
                "current_mission": STR,
                "provider_id": STR,
            },
            ["kind"],
        ),
    ]
    for definition in definitions:
        if definition["name"] != "assistant_workflows":
            definition["annotations"]["idempotentHint"] = False
    return definitions


async def invoke_tool(name, args, s, bridge, ops):
    engine = bridge.workflows
    if name == "assistant_task_plan":
        plan = await engine.prepare_plan(s, args)
        return {
            "plan": plan,
            "open_action": {"type": "workbench", "view": "plans", "id": plan["id"]},
            "message": "任务计划已准备，请核对步骤与资源。尚未下发飞行。",
        }
    if name == "assistant_workflows":
        view = args.get("view")
        if view == "catalog":
            return await catalog(bridge, s)
        if view in {"templates", "workflows"}:
            return engine.list(s["tenant_id"])
        if view == "plans":
            return engine.plans(s["tenant_id"])
        if view == "runs":
            return engine.runs(s["tenant_id"])
        raise HTTPException(422, "目录类型无效。")
    if name == "assistant_workflow_prepare":
        if set(args) - {"template_id", "name", "bindings", "trigger"}:
            raise HTTPException(422, "工作流准备字段无效。")
        template = next(
            (t for t in templates() if t["id"] == args.get("template_id")), None
        )
        if not template:
            raise HTTPException(422, "请选择目录中的示例模板。")
        definition = {
            k: v
            for k, v in template.items()
            if k
            in {
                "name",
                "description",
                "trigger",
                "nodes",
                "edges",
                "fields",
                "bindings",
                "template_version",
            }
        }
        definition["template_id"] = template["id"]
        definition["name"] = args.get("name", template["name"])
        definition["bindings"].update(args.get("bindings", {}))
        if args.get("trigger"):
            definition["trigger"] = args["trigger"]
        workflow = await engine.save(s, definition)
        return {
            "workflow": workflow,
            "open_action": {
                "type": "workbench",
                "view": "workflow",
                "id": workflow["id"],
            },
            "message": "工作流草稿已准备，请核对参数后再启用或运行。",
        }
    if name in {"assistant_resource_search", "assistant_change_detection"}:
        kind = (
            "smart_search" if name == "assistant_resource_search" else args.get("kind")
        )
        if kind not in {"smart_search", "change_pair", "change_mission"}:
            raise HTTPException(422, "分析类型无效。")
        if kind == "change_mission":
            from workbench_resources import association

            for key in ["baseline_mission", "current_mission"]:
                await association(
                    bridge,
                    s,
                    {"route_id": args.get("route_id"), "mission_id": args.get(key)},
                )
        job = await resource_json(
            bridge.assistant,
            s,
            "POST",
            "/analyses/" + kind,
            {k: v for k, v in args.items() if k != "kind"},
        )
        return {
            "analysis": job,
            "open_action": {
                "type": "workbench",
                "view": "resources",
                "analysis_id": job["id"],
            },
            "message": "视觉分析已排队，可以在资源库查看进度与结果。",
        }
    raise HTTPException(422, "工作流工具名称无效。")
