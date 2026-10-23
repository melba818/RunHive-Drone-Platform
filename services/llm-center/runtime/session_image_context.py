"""Restore one trusted user image from an authenticated tenant's bound Session.

This module is only called AFTER the controller authenticates the tenant. It never
accepts a model-supplied file path, summary reference, tool image or external URL.
The original Trace and image bytes remain unchanged. A content-addressed copy in
the Session scratchpad gives read_file an actual account-local attachment path.
"""
from __future__ import annotations

import base64
import binascii
from contextlib import closing
from datetime import datetime
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import sqlite3
import stat
from typing import TypedDict
import warnings

from PIL import Image, UnidentifiedImageError


MAX_DATA_URL_CHARS = 7 * 1024 * 1024
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_RECORD_BYTES = 8 * 1024 * 1024
MAX_META_BYTES = 128 * 1024
SESSION_ID = re.compile(r"session-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-[0-9a-f]{8}\Z", re.ASCII)
RESOURCE_ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z", re.ASCII)
DATE_DIR = re.compile(r"\d{4}-\d{2}-\d{2}\Z", re.ASCII)
DATA_IMAGE = re.compile(r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})\Z", re.ASCII)
FORMATS = {"png": ("PNG", "png"), "jpeg": ("JPEG", "jpg"), "webp": ("WEBP", "webp")}


class SessionImage(TypedDict):
    image_url: str
    width: int
    height: int
    sha256: str
    image_id: str
    native_path: str


def _link_or_reparse(st: os.stat_result) -> bool:
    return stat.S_ISLNK(st.st_mode) or bool(
        getattr(st, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    )


def _checked_path(root: Path, target: Path, *, missing: bool = False) -> bool:
    """Reject symlinks at EVERY component, including an in-root cross-tenant link."""
    try:
        parts = target.relative_to(root).parts
    except ValueError as exc:
        raise ValueError("会话附件路径超出本账号目录，已阻止读取。") from exc
    current = root
    for part in parts:
        if part in {"", ".", ".."}:
            raise ValueError("会话附件路径无效，已阻止读取。")
        current = current / part
        try:
            st = current.lstat()
        except FileNotFoundError:
            if missing:
                return False
            raise
        if _link_or_reparse(st):
            raise ValueError("会话附件目录包含不受支持的链接，已阻止读取。")
    # Recheck the canonical spelling too; this also checks containment on Windows.
    try:
        target.resolve(strict=True).relative_to(root)
    except ValueError as exc:
        raise ValueError("会话附件路径超出本账号目录，已阻止读取。") from exc
    return True


def _open_read(root: Path, target: Path):
    _checked_path(root, target)
    fd = os.open(target, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0))
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError("会话附件不是普通文件，已阻止读取。")
        _checked_path(root, target)
        return os.fdopen(fd, "rb")
    except BaseException:
        os.close(fd)
        raise


def _reverse_lines(stream):
    """Scan a shard backwards without loading an unbounded Trace into memory."""
    stream.seek(0, os.SEEK_END)
    position = stream.tell()
    tail = b""
    oversized = False
    while position:
        length = min(64 * 1024, position)
        position -= length
        stream.seek(position)
        chunks = stream.read(length).split(b"\n")
        if len(chunks) == 1:
            if not oversized:
                tail = chunks[0] + tail
                if len(tail) > MAX_RECORD_BYTES:
                    tail = b""
                    oversized = True
            continue
        final = chunks[-1] + tail
        if not oversized and 0 < len(final) <= MAX_RECORD_BYTES:
            yield final
        for line in reversed(chunks[1:-1]):
            if 0 < len(line) <= MAX_RECORD_BYTES:
                yield line
        tail = chunks[0]
        oversized = len(tail) > MAX_RECORD_BYTES
        if oversized:
            tail = b""
    if not oversized and tail:
        yield tail


def _decode_image(value: object) -> tuple[bytes, str, int, int] | None:
    if not isinstance(value, str) or len(value) > MAX_DATA_URL_CHARS:
        return None
    match = DATA_IMAGE.fullmatch(value)
    if match is None:
        return None
    payload = match[2]
    if len(payload) > ((MAX_IMAGE_BYTES + 2) // 3) * 4:
        return None
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        return None
    expected_format, ext = FORMATS[match[1]]
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format != expected_format:
                    return None
                width, height = image.size
                if width < 1 or height < 1:
                    return None
                image.verify()
            # verify() checks headers/structure; load() also refuses truncated image data.
            with Image.open(io.BytesIO(raw)) as image:
                image.load()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return None
    return raw, ext, width, height


class SessionImageContextResolver:
    def __init__(self, root: str | os.PathLike[str]):
        self.root = Path(root).absolute()

    def resolve_group(self, tenant: int | str, sid: str) -> list[SessionImage]:
        """Latest original upload group, ordered as submitted, scoped to this Session."""
        result = self.resolve(tenant, sid, _group=True)
        return result or []

    def resolve(self, tenant: int | str, sid: str, *, image_sha256: str | None = None, _group=False) -> SessionImage | list[SessionImage] | None:
        """Return the latest valid user upload belonging to this exact bound Session."""
        if not isinstance(sid, str) or SESSION_ID.fullmatch(sid) is None:
            raise ValueError("会话标识无效，请刷新页面后重试。")
        if image_sha256 is not None and (not isinstance(image_sha256,str) or re.fullmatch(r'[0-9a-f]{64}',image_sha256,re.ASCII) is None):
            raise ValueError("图片标识无效，请刷新页面后重试。")
        try:
            datetime.strptime(sid[8:-9], "%Y-%m-%d-%H-%M-%S")
        except ValueError as exc:
            raise ValueError("会话标识无效，请刷新页面后重试。") from exc
        if isinstance(tenant, bool) or not isinstance(tenant, (int, str)) or re.fullmatch(r"[1-9][0-9]{0,15}", str(tenant), re.ASCII) is None:
            raise ValueError("账号标识无效，已阻止读取会话附件。")
        try:
            root = self.root.resolve(strict=True)
        except FileNotFoundError:
            return None
        account = root / "agents" / ("admin-" + str(tenant)) / "data"
        database = account / "web.db"
        if not _checked_path(root, database, missing=True):
            return None
        # SQLite's normal read-only mode observes the current WAL without creating a DB.
        for suffix in ("-wal", "-shm", "-journal"):
            _checked_path(root, Path(str(database) + suffix), missing=True)
        try:
            with closing(sqlite3.connect(database.as_uri() + "?mode=ro", uri=True, timeout=2)) as connection:
                connection.execute("PRAGMA query_only=ON")
                row = connection.execute(
                    "SELECT project_id, agent_id FROM sessions WHERE session_id = ?", (sid,)
                ).fetchone()
        except sqlite3.DatabaseError:
            return None
        _checked_path(root, database)
        if row is None:
            return None
        project, agent = row
        if not all(isinstance(value, str) and RESOURCE_ID.fullmatch(value) for value in row):
            return None
        agent_dir = account / project / "agents" / agent
        traces = agent_dir / "traces"
        if not _checked_path(root, traces, missing=True):
            return None
        if not traces.is_dir():
            return None
        shard_pattern = re.compile(re.escape(sid) + r"_([0-9]{1,12})\.jsonl\Z", re.ASCII)
        shards = []
        for date in traces.iterdir():
            if DATE_DIR.fullmatch(date.name) is None:
                continue
            _checked_path(root, date)
            if not date.is_dir():
                continue
            for shard in date.iterdir():
                match = shard_pattern.fullmatch(shard.name)
                if match is not None and int(match[1]) > 0:
                    shards.append((int(match[1]), date.name, shard))
        collected = []
        total_image_bytes = 0
        for _, _, shard in sorted(shards, key=lambda item: (item[0], item[1]), reverse=True):
            with _open_read(root, shard) as stream:
                first = stream.readline(MAX_META_BYTES + 1)
                if len(first) > MAX_META_BYTES:
                    continue
                try:
                    meta = json.loads(first)
                except (ValueError, UnicodeError):
                    continue
                if not isinstance(meta, dict) or meta.get("type") != "session_meta" or not isinstance(meta.get("payload"), dict) or meta["payload"].get("session_id") != sid:
                    continue
                for line in _reverse_lines(stream):
                    try:
                        message = json.loads(line)
                    except (ValueError, UnicodeError):
                        continue
                    if not isinstance(message, dict) or message.get("type") != "model_msg":
                        continue
                    if message.get("origin"):
                        if _group and collected:
                            return list(reversed(collected))
                        continue
                    payload = message.get("payload")
                    if not isinstance(payload, dict) or payload.get("type") != "image_url" or payload.get("role") != "user":
                        if _group and collected:
                            return list(reversed(collected))
                        continue
                    image_url = payload.get("image_url")
                    decoded = _decode_image(image_url)
                    if decoded is None:
                        if image_sha256 is not None:continue
                        # This is the latest bound user image. Falling back to an older
                        # valid upload would silently identify a different frame.
                        raise ValueError("最近上传的图片无法读取，请重新上传有效的 PNG、JPEG 或 WebP 图片后重试。")
                    raw, ext, width, height = decoded
                    sha = hashlib.sha256(raw).hexdigest()
                    if image_sha256 is not None and sha!=image_sha256:continue
                    filename = "runhive-image-" + sha + "." + ext
                    scratch = agent_dir / "scratchpad" / sid
                    self._store(root, scratch, filename, raw, sha)
                    result = {
                        "image_url": image_url,
                        "width": width,
                        "height": height,
                        "sha256": sha,
                        "image_id": "sha256:" + sha,
                        "native_path": str(PurePosixPath("/data", project, "agents", agent, "scratchpad", sid, filename)),
                    }
                    if not _group:
                        return result
                    collected.append(result)
                    total_image_bytes += len(raw)
                    if len(collected) > 32 or total_image_bytes > 20 * 1024**2:
                        raise ValueError("图片数量超出处理范围，请分批提交。")
            # A shard starts a separate context. Do not merge an earlier task's
            # attachments into a group merely because compaction split the Trace.
            if _group and collected:
                return list(reversed(collected))
        return [] if _group else None

    @staticmethod
    def _store(root: Path, scratch: Path, filename: str, raw: bytes, sha: str) -> None:
        # Only create these two directories AFTER finding an image in a bound Trace.
        for directory in (scratch.parent, scratch):
            if not _checked_path(root, directory, missing=True):
                try:
                    directory.mkdir(mode=0o700)
                except FileExistsError:
                    pass
            _checked_path(root, directory)
            if not directory.is_dir():
                raise ValueError("会话附件目录无效，已阻止保存图片。")
        target = scratch / filename
        _checked_path(root, target, missing=True)
        try:
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0), 0o600)
        except FileExistsError:
            with _open_read(root, target) as stream:
                stored = stream.read(MAX_IMAGE_BYTES + 1)
            if len(stored) != len(raw) or hashlib.sha256(stored).hexdigest() != sha or stored != raw:
                raise ValueError("会话图片缓存校验失败，已阻止读取。")
            return
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            _checked_path(root, target)
        except BaseException:
            # Remove only the exclusive-created file; never delete an existing attachment.
            try:
                target.unlink()
            except OSError:
                pass
            raise


def resolve_session_image(root: str | os.PathLike[str], tenant: int | str, sid: str) -> SessionImage | None:
    return SessionImageContextResolver(root).resolve(tenant, sid)
