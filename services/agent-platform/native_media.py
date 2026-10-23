"""Import authorized DJI task media through the configured storage service only."""

import json, tempfile
from pathlib import Path
from urllib.parse import urlsplit
from fastapi import HTTPException
from workbench_resources import raw_runos, resource_json


async def mission_assets(bridge, s, mission_id):
    rows = (
        await bridge.php(
            s, "query", {"resource": "flight_tasks", "id": str(mission_id)}
        )
    )["result"].get("list", [])
    if not rows:
        raise HTTPException(404, "任务不存在。")
    task = rows[0]
    if not task.get("bid"):
        raise HTTPException(422, "任务缺少媒体关联标识。")
    assets = (
        await bridge.php(
            s,
            "query",
            {"resource": "media", "filters": {"flight_id": task["bid"]}, "limit": 100},
        )
    )["result"].get("list", [])
    return task, assets


async def import_asset(bridge, s, media_id, mission_id=None):
    resolved = await bridge.php(
        s, "media_resolve", {"resource": "media", "id": str(media_id)}
    )
    row = resolved["asset"]
    metadata = {"source_media_id": str(row["id"]), "description": "由平台任务媒体导入"}
    if mission_id:
        task, _ = await mission_assets(bridge, s, mission_id)
        if str(row.get("flight_id", "")) != str(task.get("bid", "")):
            raise HTTPException(422, "所选媒体不属于此任务。")
        metadata.update(route_id=str(task["airline_id"]), mission_id=str(task["id"]))
    for old in (await resource_json(bridge.assistant, s, "GET", "?limit=500"))["items"]:
        if old["metadata"].get("source_media_id") == str(row["id"]):
            if mission_id:
                await resource_json(
                    bridge.assistant,
                    s,
                    "PATCH",
                    "/" + old["id"],
                    {"metadata": {k: metadata[k] for k in ["route_id", "mission_id"]}},
                )
            return old
    for source, target in [
        ("lng", "longitude"),
        ("lat", "latitude"),
        ("c_time", "captured_at"),
    ]:
        if row.get(source) is not None:
            metadata[target] = row[source]
    url = resolved["download_url"]
    parsed = urlsplit(url)
    # The PHP adapter already pins local static paths or the configured object
    # storage origin and checks native RBAC. Never follow unvalidated redirects.
    if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
        raise HTTPException(422, "媒体下载信息无效。")
    suffix = Path(parsed.path).suffix.lower()
    name = str(row.get("name") or "任务媒体-" + str(row["id"]))
    if not Path(name).suffix:
        name += suffix
    size = 0
    with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024) as spool:
        async with bridge.client.stream(
            "GET", url, headers={"Cookie": ""}, follow_redirects=False, timeout=90
        ) as response:
            if response.status_code != 200:
                raise HTTPException(
                    422, "任务媒体文件暂不可访问，请检查原存储服务或上传副本。"
                )
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > 512 * 1024 * 1024:
                    raise HTTPException(413, "任务媒体超过 512 MB 上限。")
                spool.write(chunk)
        spool.seek(0)
        response = await raw_runos(
            bridge.assistant,
            s,
            "POST",
            "/api/assistant/resources/upload",
            files={"file": (name, spool, "application/octet-stream")},
            data={"parent": "", "metadata": json.dumps(metadata, ensure_ascii=False)},
        )
        try:
            return json.loads(await response.aread())
        finally:
            await response.aclose()


async def import_mission(bridge, s, mission_id):
    task, assets = await mission_assets(bridge, s, mission_id)
    imported = []
    errors = []
    for asset in assets:
        try:
            imported.append(await import_asset(bridge, s, asset["id"], task["id"]))
        except HTTPException as exc:
            errors.append({"media_id": asset["id"], "message": str(exc.detail)[:300]})
    return {
        "task_id": str(task["id"]),
        "route_id": str(task["airline_id"]),
        "items": imported,
        "errors": errors,
    }
