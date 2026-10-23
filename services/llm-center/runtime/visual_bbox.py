"""Pure attachment metadata and bounding-box protocol helpers.

No filesystem lookup, model call, image upload, or account state is performed here.
Pixel coordinates refer to the uploaded image's original encoded raster; this module
does not resize the image or apply an EXIF orientation transform.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import io
import json
import math
import re
import warnings

from PIL import Image, UnidentifiedImageError


_BBOX_REQUEST = re.compile(
    r"(?<![a-z0-9_])bbox(?![a-z0-9_])|bounding[\s_-]+box(?:es)?\b|"
    r"边界框|矩形框|返回框|检测框|坐标定位",
    re.I,
)
_SUMMARY_PROMPTS = {
    "Summarize the task transcript above. The summary will replace the transcript as its only record, "
    "so include everything needed to continue the task — the original request, current state, next steps, "
    "and any learnings. Do not call any tools; reply with text only, in exactly this format and nothing after it:"
    "\n\n[summary]put the summary text here...[/summary]",
    "Your previous reply was not a usable summary. Reply again with text only, no tool calls, "
    "in exactly this format and nothing after it:\n\n[summary]put the summary text here...[/summary]",
}
_DATA_IMAGE = re.compile(r"^data:image/(?:png|jpeg|webp);base64,", re.I)


def _text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict)
            and part.get("type") == "text"
            and isinstance(part.get("text"), str)
        )
    return ""


def is_bbox_request(messages) -> bool:
    """Recognize the latest actual user request, excluding native compaction prompts."""
    for row in reversed(messages):
        if isinstance(row, dict) and row.get("role") == "user":
            text = _text(row.get("content")).strip()
            return text not in _SUMMARY_PROMPTS and bool(_BBOX_REQUEST.search(text))
    return False


def latest_image_info(normalizedmessages):
    """Return real raster metadata for the latest inline image, or None if absent.

    A malformed latest image is an error: it must not silently select an older image.
    Stable byte identity makes resubmitting the same attachment unambiguous.
    """
    for row in reversed(normalizedmessages):
        if not isinstance(row, dict) or not isinstance(row.get("content"), list):
            continue
        for part in reversed(row["content"]):
            if not isinstance(part, dict) or part.get("type") != "image_url":
                continue
            value = part.get("image_url")
            url = value.get("url") if isinstance(value, dict) else None
            if not isinstance(url, str) or not _DATA_IMAGE.match(url):
                raise ValueError("定位图片必须为已上传的内嵌图片。")
            if len(url) > 7 * 1024**2:
                raise ValueError("定位图片超出允许大小。")
            try:
                raw = base64.b64decode(url.split(",", 1)[1], validate=True)
                if not raw:
                    raise ValueError("empty image")
                with warnings.catch_warnings():
                    warnings.simplefilter("error", Image.DecompressionBombWarning)
                    with Image.open(io.BytesIO(raw)) as image:
                        width, height = image.size
                        if image.format not in {"PNG", "JPEG", "WEBP"}:
                            raise ValueError("unsupported image")
                        image.verify()
                if width <= 0 or height <= 0:
                    raise ValueError("empty raster")
            except (ValueError, binascii.Error, OSError, SyntaxError, UnidentifiedImageError,
                    Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
                raise ValueError("定位图片编码或图像内容无效。") from error
            digest = hashlib.sha256(raw).hexdigest()
            return {
                "width": width,
                "height": height,
                "sha256": digest,
                "image_id": "sha256:" + digest,
            }
    return None


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("定位结果包含重复字段。")
        result[key] = value
    return result


def _invalid_constant(value):
    raise ValueError("定位坐标必须是有限数值。")


def validate_bbox_answer(content, info) -> str:
    """Validate explicit coordinate units and return canonical original-pixel JSON.

    Both unit systems use xyxy. Pixel decimals are rounded outwards; normalized
    coordinates are explicitly scaled by the trusted raster dimensions first.
    Invalid bounds are rejected before conversion, never guessed or clamped.
    """
    if not isinstance(info, dict):
        raise ValueError("定位请求缺少原图，请恢复上传图片后重试。")
    width, height = info.get("width"), info.get("height")
    if (type(width) is not int or type(height) is not int
            or width <= 0 or height <= 0
            or not isinstance(info.get("image_id"), str) or not info["image_id"]):
        raise ValueError("原图元数据无效。")
    if not isinstance(content, str):
        raise ValueError("定位结果必须为 JSON 文本。")
    try:
        answer = json.loads(content, object_pairs_hook=_unique_object,
                            parse_constant=_invalid_constant)
    except (json.JSONDecodeError, TypeError) as error:
        raise ValueError("定位结果不是有效 JSON。") from error
    if not isinstance(answer, dict) or set(answer) != {"coordinate_system", "detections"}:
        raise ValueError("定位结果须包含且仅包含坐标单位和检测框列表。")
    unit = answer["coordinate_system"]
    if not isinstance(unit, str) or unit not in {"pixel", "normalized_1000"}:
        raise ValueError("定位坐标单位必须明确为 pixel 或 normalized_1000。")
    detections = answer["detections"]
    if not isinstance(detections, list):
        raise ValueError("检测框必须为列表。")
    result = []
    for detection in detections:
        if not isinstance(detection, dict) or set(detection) != {"label", "bbox"}:
            raise ValueError("每个检测框须包含且仅包含 label 和 bbox。")
        label, box = detection["label"], detection["bbox"]
        if not isinstance(label, str) or not label.strip():
            raise ValueError("检测框类别名称无效。")
        if not isinstance(box, list) or len(box) != 4:
            raise ValueError("检测框必须为四个 xyxy 坐标。")
        if any(type(value) not in {int, float}
               or (isinstance(value, float) and not math.isfinite(value)) for value in box):
            raise ValueError("定位坐标必须是有限数值，不能为布尔值。")
        x1, y1, x2, y2 = box
        bound_x, bound_y = (width, height) if unit == "pixel" else (1000, 1000)
        if not (0 <= x1 < x2 <= bound_x and 0 <= y1 < y2 <= bound_y):
            raise ValueError("检测框越界、方向错误或面积为空。")
        if unit == "normalized_1000":
            x1, x2 = x1 * width / 1000, x2 * width / 1000
            y1, y2 = y1 * height / 1000, y2 * height / 1000
        pixels = [math.floor(x1), math.floor(y1), math.ceil(x2), math.ceil(y2)]
        result.append({"label": label.strip(), "bbox": pixels})
    return json.dumps({
        "image_id": info["image_id"],
        "image_size": {"width": width, "height": height},
        "bbox_format": "xyxy",
        "coordinate_system": "pixel",
        "detections": result,
    }, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
