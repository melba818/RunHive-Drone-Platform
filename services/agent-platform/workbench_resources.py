"""Authenticated resource adapter to the existing account-routed RunOS worker."""

import json, re, tempfile
from urllib.parse import urlencode
from fastapi import HTTPException, Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask

RESOURCE_PATH = re.compile(
    r"^/api/assistant/resources(?:/(?:catalog|folders|upload|[a-f0-9]{32}(?:/(?:file|thumbnail))?|analyses/(?:smart_search|change_pair|change_mission|history|jobs/[a-f0-9]{32})))?$"
)


async def association(bridge, s, metadata):
    value = dict(metadata)
    route = value.get("route_id")
    mission = value.get("mission_id")
    if route:
        rows = (await bridge.php(s, "query", {"resource": "routes", "id": str(route)}))[
            "result"
        ].get("list", [])
        if not rows:
            raise HTTPException(422, "所选关联航线不可用。")
    if mission:
        rows = (
            await bridge.php(
                s, "query", {"resource": "flight_tasks", "id": str(mission)}
            )
        )["result"].get("list", [])
        if not rows:
            raise HTTPException(422, "所选关联任务不可用。")
        actual = str(rows[0].get("airline_id", ""))
        if route and str(route) != actual:
            raise HTTPException(422, "所选任务不属于此航线。")
        value["route_id"] = actual
    return value


async def raw_runos(service, s, method, path, **kwargs):
    base = path.split("?", 1)[0]
    if not RESOURCE_PATH.fullmatch(base):
        raise HTTPException(422, "资源接口无效。")
    # Resolve and authorize the per-account cookie using the existing SSO adapter.
    import time

    cached = service.cookies.get(s["tenant_id"])
    if not cached or cached[1] < time.time():
        await service.runos(s, "GET", "/api/assistant/catalog")
    else:
        await service.bridge.php(s, "authorize_runos")
    cached = service.cookies.get(s["tenant_id"])
    request = service.bridge.client.build_request(
        method,
        "http://127.0.0.1:4000/api/proxy" + path,
        headers={"Cookie": "runos_session=" + cached[0], **kwargs.pop("headers", {})},
        timeout=300,
        **kwargs
    )
    request.headers["Cookie"] = "runos_session=" + cached[0]
    response = await service.bridge.client.send(request, stream=True)
    if response.status_code >= 400:
        raw = await response.aread()
        await response.aclose()
        if response.status_code == 401:
            service.cookies.pop(s["tenant_id"], None)
        try:
            message = json.loads(raw).get("detail", "资源操作未完成。")
        except ValueError:
            message = "资源操作未完成。"
        raise HTTPException(response.status_code, str(message)[:500])
    return response


async def resource_json(service, s, method, suffix="", data=None):
    response = await raw_runos(
        service,
        s,
        method,
        "/api/assistant/resources" + suffix,
        **({"json": data} if data is not None else {})
    )
    try:
        return json.loads(await response.aread())
    finally:
        await response.aclose()


def install(app, prefix, identity, write, bounded_json):
    @app.get(prefix + "/resources")
    async def listed(request: Request):
        s = await identity(request)
        allowed = {"kind", "parent", "q", "page", "limit", "route_id", "mission_id"}
        if set(request.query_params) - allowed:
            raise HTTPException(422, "资源筛选字段无效。")
        return await resource_json(
            app.state.bridge.assistant,
            s,
            "GET",
            "?" + urlencode(dict(request.query_params)),
        )

    @app.post(prefix + "/resources/upload")
    async def upload(request: Request):
        s = await identity(request)
        await write(request, s)
        name = request.query_params.get("name", "")
        parent = request.query_params.get("parent", "")
        metadata = request.query_params.get("metadata", "{}")
        if (
            not name
            or len(name) > 180
            or len(metadata) > 4000
            or "\n" in name
            or "\r" in name
        ):
            raise HTTPException(422, "上传信息无效。")
        try:
            meta = json.loads(metadata)
        except ValueError:
            raise HTTPException(422, "资源关联信息无效。") from None
        if not isinstance(meta, dict):
            raise HTTPException(422, "资源关联信息无效。")
        metadata = json.dumps(
            await association(app.state.bridge, s, meta), ensure_ascii=False
        )
        size = 0
        with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024) as spool:
            async for chunk in request.stream():
                size += len(chunk)
                if size > 512 * 1024 * 1024:
                    raise HTTPException(413, "文件不能超过 512 MB。")
                spool.write(chunk)
            if not size:
                raise HTTPException(422, "文件内容为空。")
            spool.seek(0)
            response = await raw_runos(
                app.state.bridge.assistant,
                s,
                "POST",
                "/api/assistant/resources/upload",
                files={"file": (name, spool, "application/octet-stream")},
                data={"parent": parent, "metadata": metadata},
            )
            try:
                result = json.loads(await response.aread())
            finally:
                await response.aclose()
        await app.state.workflows.event(
            s,
            "resource.uploaded",
            result["id"],
            {"resource_id": result["id"], "kind": result["kind"]},
        )
        return result

    @app.post(prefix + "/resources/folders")
    async def folder(request: Request):
        s = await identity(request)
        await write(request, s)
        return await resource_json(
            app.state.bridge.assistant,
            s,
            "POST",
            "/folders",
            await bounded_json(request),
        )

    @app.patch(prefix + "/resources/{ident}")
    async def update(ident: str, request: Request):
        if not re.fullmatch("[a-f0-9]{32}", ident):
            raise HTTPException(404, "资源不存在。")
        s = await identity(request)
        await write(request, s)
        body = await bounded_json(request)
        if isinstance(body.get("metadata"), dict):
            body["metadata"] = await association(app.state.bridge, s, body["metadata"])
        return await resource_json(
            app.state.bridge.assistant, s, "PATCH", "/" + ident, body
        )

    @app.get(prefix + "/resources/{ident}/file")
    @app.get(prefix + "/resources/{ident}/thumbnail")
    async def media(ident: str, request: Request):
        variant = request.url.path.rsplit("/", 1)[-1]
        if not re.fullmatch("[a-f0-9]{32}", ident):
            raise HTTPException(404, "资源不存在。")
        s = await identity(request)
        suffix = "/" + ident + "/" + variant
        if request.query_params.get("download") == "true":
            suffix += "?download=true"
        headers = {}
        if request.headers.get("range"):
            headers["Range"] = request.headers["range"][:100]
        response = await raw_runos(
            app.state.bridge.assistant,
            s,
            "GET",
            "/api/assistant/resources" + suffix,
            headers=headers,
        )
        safe = {
            k: v
            for k, v in response.headers.items()
            if k.lower()
            in {
                "content-type",
                "content-length",
                "content-range",
                "accept-ranges",
                "content-disposition",
                "x-content-type-options",
                "content-security-policy",
            }
        }
        safe["Cache-Control"] = "private, no-store"
        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            headers=safe,
            background=BackgroundTask(response.aclose),
        )

    @app.post(prefix + "/resources/analyses/{kind}")
    async def analysis(kind: str, request: Request):
        if kind not in {"smart_search", "change_pair", "change_mission"}:
            raise HTTPException(404, "分析类型无效。")
        s = await identity(request)
        await write(request, s)
        body = await bounded_json(request)
        if kind == "change_mission":
            await association(
                app.state.bridge,
                s,
                {
                    "route_id": body.get("route_id"),
                    "mission_id": body.get("baseline_mission"),
                },
            )
            await association(
                app.state.bridge,
                s,
                {
                    "route_id": body.get("route_id"),
                    "mission_id": body.get("current_mission"),
                },
            )
        return await resource_json(
            app.state.bridge.assistant, s, "POST", "/analyses/" + kind, body
        )

    @app.get(prefix + "/resources/analyses/jobs/{ident}")
    async def job(ident: str, request: Request):
        s = await identity(request)
        return await resource_json(
            app.state.bridge.assistant, s, "GET", "/analyses/jobs/" + ident
        )

    @app.get(prefix + "/resources/analyses/history")
    async def history(request: Request):
        return await resource_json(
            app.state.bridge.assistant,
            await identity(request),
            "GET",
            "/analyses/history",
        )
