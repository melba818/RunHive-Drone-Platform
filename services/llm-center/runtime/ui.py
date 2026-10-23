"""Official LlamaFactory WebUI with Runhive tenancy, localization and job adapters."""
from __future__ import annotations

import base64
import html
import io
import json
import os
import time
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import quote

import gradio as gr
import httpx
import uvicorn
import yaml
from fastapi import FastAPI, Request
from starlette.responses import FileResponse, JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from runtime_common import MODEL_NAMES, TENANT, contained, relative_name, sanitize_args, validate_extra
from workspace_store import WorkspaceError

ID = int(os.environ["LLM_TENANT_ID"])
KEY = os.environ["LLM_INSTANCE_KEY"]
CONTROL = os.environ["LLM_CONTROL_URL"].rstrip("/")
HEADERS = {"X-LLM-Instance-Key": KEY, "X-LLM-Tenant-ID": str(ID)}


def user_error(error):
    if isinstance(error, httpx.HTTPError):
        return "服务连接暂时不可用，请稍后重试。"
    text = str(error)
    if not any('\u4e00' <= char <= '\u9fff' for char in text):
        return "输入内容或参数格式不正确，请检查后重试。"
    return text


def api(method, suffix, body=None, timeout=180):
    r = httpx.request(method, f"{CONTROL}/internal/tenants/{ID}/{suffix}", headers=HEADERS, json=body, timeout=timeout)
    if r.status_code >= 400:
        try:
            detail = r.json().get("detail", "服务请求未能完成。")
        except Exception:
            detail = "服务请求未能完成，请稍后重试。"
        raise WorkspaceError(detail, r.status_code)
    return r.json()


# Patch path helpers before Factory imports their aliases into components and Runner.
from llamafactory.extras import constants
from llamafactory.webui import common

constants.SUPPORTED_MODELS.clear()
for name, item in MODEL_NAMES.items():
    constants.SUPPORTED_MODELS[name] = {constants.DownloadSource.DEFAULT: item["path"]}
    constants.DEFAULT_TEMPLATE[name] = item["template"]
constants.MULTIMODAL_SUPPORTED_MODELS.update({"Qwen3-VL-32B（已加载服务）", "VLX-Seek-1.5（已加载服务）"})
stage_labels = {"Supervised Fine-Tuning": "监督微调", "Pre-Training": "预训练", "Reward Modeling": "奖励模型", "PPO": "PPO 强化学习", "DPO": "DPO 偏好优化", "KTO": "KTO 偏好优化"}
for name, value in list(constants.TRAINING_STAGES.items()):
    constants.TRAINING_STAGES.pop(name)
    constants.TRAINING_STAGES[stage_labels.get(name, name)] = value


def safe_save_dir(*parts):
    if not parts:
        return "/tenant/saves"
    if len(parts) == 1 and str(parts[0]).startswith("/tenant/saves/"):
        return str(contained(parts[0], TENANT / "saves"))
    clean = [relative_name(str(p).replace(" ", "")) for p in parts]
    return str(contained("/".join(clean), TENANT / "saves"))


original_load_args = common.load_args
original_save_args = common.save_args


def safe_config_path(value):
    raw = str(value)
    if raw.startswith("llamaboard_config/"):
        raw = raw[len("llamaboard_config/"):]
    return contained(raw, TENANT / "llamaboard_config")


def safe_load_args(value):
    return original_load_args(safe_config_path(value))


def safe_save_args(value, args):
    # The official Runner also writes training configuration into an approved output folder.
    raw = str(value)
    if raw.startswith("/tenant/saves/"):
        path = contained(raw, TENANT / "saves")
    else:
        path = safe_config_path(raw)
    path.parent.mkdir(parents=True, exist_ok=True)
    return original_save_args(path, args)


def safe_dataset_info(value):
    if value not in {"data", "/tenant/data", None}:
        raise ValueError("数据集目录固定为当前账号的数据空间。")
    return api("GET", "workspace/catalog", timeout=15)


common.get_save_dir = safe_save_dir
common.load_args = safe_load_args
common.save_args = safe_save_args
common.load_dataset_info = safe_dataset_info
common.DEFAULT_DATA_DIR = "/tenant/data"

from llamafactory.webui.runner import Runner
from llamafactory.webui.chatter import WebChatModel
from llamafactory.webui.components import export as export_component
from llamafactory.webui.locales import LOCALES

for key, message in {"title": '<h2 style="margin:0;color:#303133">大模型中心</h2>', "subtitle": "模型微调、评估、对话与导出。数据和任务按当前账号独立保存。", "load_btn": "连接模型", "unload_btn": "断开连接"}.items():
    if key in LOCALES:
        LOCALES[key]["zh"]["value"] = message


def validate_data(self, data, do_train):
    get = lambda key: data[self.manager.get_elem_by_id(key)]
    name = get("top.model_name")
    if name not in MODEL_NAMES or get("top.model_path") != MODEL_NAMES[name]["path"]:
        raise ValueError("请选择平台提供的基础模型。")
    if do_train:
        validate_extra(get("train.extra_args"))
    for key in ["train.dataset_dir" if do_train else "eval.dataset_dir"]:
        if get(key) not in {"data", "/tenant/data"}:
            raise ValueError("数据集目录固定为当前账号的数据空间。")


orig_train_parse, orig_eval_parse = Runner._parse_train_args, Runner._parse_eval_args


def train_parse(self, data):
    validate_data(self, data, True)
    args = orig_train_parse(self, data)
    return sanitize_args(args, "train", TENANT)[0]


def eval_parse(self, data):
    validate_data(self, data, False)
    args = orig_eval_parse(self, data)
    return sanitize_args(args, "eval", TENANT)[0]


Runner._parse_train_args = train_parse
Runner._parse_eval_args = eval_parse


def monitor(self):
    prefix = "train" if self.do_train else "eval"
    box = self.manager.get_elem_by_id(prefix + ".output_box")
    progress = self.manager.get_elem_by_id(prefix + ".progress_bar")
    self.running = True
    while self.job_id:
        result = api("GET", "jobs/" + self.job_id)
        status = {"queued": "排队中", "starting": "启动中", "running": "运行中", "succeeded": "已完成", "failed": "失败", "cancelled": "已取消"}.get(result["status"], result["status"])
        text = f"**任务状态：{status}**\n\n{display_reason(result)}"
        updates = {box: text, progress: gr.Slider(label="任务进度", value=100 if result["status"] == "succeeded" else 0, visible=True)}
        if self.running_data:
            try:
                from llamafactory.webui.control import get_trainer_info
                output = result["args"].get("output_dir")
                if output:
                    _, bar, info = get_trainer_info("zh", output, self.do_train)
                    if result["status"] == "running":
                        updates[progress] = bar
                    if self.do_train and info.get("loss_viewer"):
                        updates[self.manager.get_elem_by_id("train.loss_viewer")] = info["loss_viewer"]
            except Exception:
                pass
        yield updates
        if result["status"] in {"succeeded", "failed", "cancelled"}:
            self.running, self.running_data, self.job_id = False, None, None
            break
        time.sleep(2)


def launch(self, data, do_train):
    self.do_train = do_train
    box = self.manager.get_elem_by_id(("train" if do_train else "eval") + ".output_box")
    try:
        if self.running:
            raise ValueError("当前账号已有运行中的任务。")
        args = self._parse_train_args(data) if do_train else self._parse_eval_args(data)
        draft_elem=self.manager.get_elem_by_id('top.platform_draft_id')
        rev_elem=self.manager.get_elem_by_id('top.platform_draft_revision')
        did=data.get(draft_elem,'') if do_train else ''
        if did:
            if not __import__('re').fullmatch('[a-f0-9]{32}',str(did)):raise ValueError('参数草稿标识无效。')
            saved=api('PUT','assistant/drafts/'+did,{'revision':int(data.get(rev_elem,0)),'data':{'operation':'train','args':args}})
            data[rev_elem]=saved['revision']
            yield {rev_elem:gr.update(value=saved['revision'])}
            submitted=api('POST','assistant/drafts/'+did+'/execute',{'revision':saved['revision']})
            result=submitted['result']
        else:
            result = api("POST", "jobs", {"operation": "train" if do_train else "eval", "args": args})
        self.running_data, self.job_id = data, result["id"]
        (TENANT / "cache/current-job.json").write_text(json.dumps({"id": self.job_id, "do_train": do_train}), "utf-8")
        yield from monitor(self)
    except (ValueError, httpx.HTTPError) as e:
        self.running = False
        yield {box: user_error(e)}


def abort(self):
    jid = getattr(self, "job_id", None)
    if jid:
        api("POST", "jobs/" + jid + "/cancel")
    self.aborted = True


Runner._launch, Runner.monitor, Runner.set_abort = launch, monitor, abort


def safe_export(lang, model_name, model_path, finetuning_type, checkpoint_path, template, export_size, export_quantization_bit, export_quantization_dataset, export_device, export_legacy_format, export_dir, export_hub_model_id, extra_args):
    try:
        if model_name not in MODEL_NAMES or model_path != MODEL_NAMES[model_name]["path"]:
            raise ValueError("请选择平台提供的基础模型。")
        if export_quantization_bit != "none" or export_hub_model_id:
            raise ValueError("当前开放本账号工作区内的模型导出；量化导出和外部发布暂未启用。")
        args = {"model_name_or_path": model_path, "finetuning_type": finetuning_type, "template": template, "export_size": export_size, "export_device": "cpu", "export_legacy_format": export_legacy_format, "export_dir": str(contained(export_dir, TENANT / "exports"))}
        args.update(validate_extra(extra_args))
        if checkpoint_path:
            checkpoint_path = checkpoint_path if isinstance(checkpoint_path, list) else [checkpoint_path]
            args["adapter_name_or_path"] = ",".join(safe_save_dir(model_name, finetuning_type, x) for x in checkpoint_path)
        elif finetuning_type == "lora":
            raise ValueError("请先选择已完成微调的检查点。")
        args, _ = sanitize_args(args, "export", TENANT)
        job = api("POST", "jobs", {"operation": "export", "args": args})
        while True:
            state = api("GET", "jobs/" + job["id"])
            yield display_reason(state)
            if state["status"] in {"succeeded", "failed", "cancelled"}:
                break
            time.sleep(2)
    except (ValueError, httpx.HTTPError) as e:
        yield user_error(e)


export_component.save_model = safe_export
original_chat_load, original_chat_stream = WebChatModel.load_model, WebChatModel.stream


def chat_load(self, data):
    try:
        get = lambda key: data[self.manager.get_elem_by_id(key)]
        name = get("top.model_name")
        if name not in MODEL_NAMES or get("top.model_path") != MODEL_NAMES[name]["path"]:
            raise ValueError("请选择平台提供的模型。")
        extra = json.loads(get("infer.extra_args"))
        if extra:
            raise ValueError("平台推理服务不允许覆盖运行参数。")
        model = MODEL_NAMES[name]
        if model.get("remote"):
            self.remote = model["remote"]
            self.engine = SimpleNamespace(template=SimpleNamespace(enable_thinking=True))
            yield "已连接平台已加载的模型服务。"
        else:
            if not model.get("cpu"):
                raise ValueError("该基础模型的本地对话需要独立推理资源，请先由平台配置推理服务；当前不会在页面实例中额外加载模型。")
            self.remote = None
            checkpoints = get("top.checkpoint_path")
            for path in checkpoints or []:
                safe_save_dir(name, get("top.finetuning_type"), path)
            yield from original_chat_load(self, data)
    except (ValueError, httpx.HTTPError) as e:
        yield user_error(e)


def chat_stream(self, chatbot, messages, lang, system, tools, image, video, audio, max_new_tokens, top_p, temperature, skip_special_tokens, escape_html, enable_thinking):
    if not getattr(self, "remote", None):
        if self.engine is None:
            chatbot = chatbot + [{"role": "assistant", "content": "请先连接模型。"}]
            yield chatbot, messages
            return
        yield from original_chat_stream(self, chatbot, messages, lang, system, tools, image, video, audio, max_new_tokens, top_p, temperature, skip_special_tokens, escape_html, enable_thinking)
        return
    try:
        if video or audio or tools:
            raise ValueError("当前平台对话支持文本与图片；视频、音频和工具调用暂未开放。")
        body = {"model": self.remote, "messages": messages, "system": system, "max_new_tokens": max_new_tokens, "top_p": top_p, "temperature": temperature}
        if image is not None:
            buffer = io.BytesIO()
            image.convert("RGB").save(buffer, format="PNG")
            body["image_base64"] = base64.b64encode(buffer.getvalue()).decode("ascii")
        response = api("POST", "chat", body)["response"]
        chatbot = chatbot + [{"role": "assistant", "content": response}]
        messages = messages + [{"role": "assistant", "content": response}]
        yield chatbot, messages
    except (ValueError, httpx.HTTPError) as e:
        yield chatbot + [{"role": "assistant", "content": user_error(e)}], messages


WebChatModel.load_model, WebChatModel.stream = chat_load, chat_stream

# Four official tabs and media tabs use the same Chinese labels at construction.
OriginalTab = gr.Tab


def ChineseTab(label=None, **kwargs):
    mapping = {"Train": "模型微调", "Evaluate & Predict": "评估验证", "Chat": "对话测试", "Export": "模型导出", "Image": "图片", "Video": "视频", "Audio": "音频"}
    return OriginalTab(mapping.get(label, label), **kwargs)


gr.Tab = ChineseTab
OriginalAccordion = gr.Accordion


def ChineseAccordion(label=None, **kwargs):
    labels = {"Advanced arguments": "高级参数", "Advanced Arguments": "高级参数", "LoRA configurations": "LoRA 配置", "RLHF configurations": "强化学习配置", "Freeze configurations": "冻结层配置", "GaLore configurations": "GaLore 配置", "APOLLO configurations": "APOLLO 配置", "BAdam configurations": "BAdam 配置", "SwanLab configurations": "SwanLab 配置"}
    return OriginalAccordion(labels.get(label, label), **kwargs)


gr.Accordion = ChineseAccordion
from llamafactory.webui.engine import Engine
from llamafactory.webui.components import create_top, create_train_tab, create_eval_tab, create_infer_tab, create_export_tab, create_footer
from ui_layouts import card, configure_data_root, layout_factory, set_props
configure_data_root(TENANT)
create_top = layout_factory(create_top, "top")
create_train_tab = layout_factory(create_train_tab, "train")
create_eval_tab = layout_factory(create_eval_tab, "eval")
create_infer_tab = layout_factory(create_infer_tab, "infer")
create_export_tab = layout_factory(create_export_tab, "export")



def import_dataset(file_path, name):
    try:
        name = relative_name(name, allow_slash=False)
        if not file_path: raise ValueError("请先选择数据集文件。")
        source = contained(file_path, TENANT / "cache/gradio", allow_relative=False)
        result = api('POST', 'workspace/import', {'name': name, 'cache_file': source.relative_to(TENANT / 'cache/gradio').as_posix()})
        return f"已导入 {result['count']} 条记录。"
    except (ValueError, OSError, TypeError, httpx.HTTPError) as e:
        return user_error(e)


def import_dataset_records(records, name):
    """Use the original validated importer for manually entered Alpaca rows."""
    try:
        name=relative_name(name,allow_slash=False)
        rows=[]
        for row in records or []:
            if len(row)!=3:raise ValueError('每条记录应包含指令、输入和回答。')
            values=[str(v or '').strip() for v in row]
            if not any(values):continue
            if not values[0] or not values[2]:raise ValueError('请填写每条记录的指令和回答。')
            rows.append(dict(zip(['instruction','input','output'],values)))
        if not 1<=len(rows)<=1000:raise ValueError('请填写 1 至 1000 条有效记录。')
        raw=json.dumps(rows,ensure_ascii=False).encode('utf-8')
        if len(raw)>512000:raise ValueError('填写的数据不能超过 512 KB；较大数据请上传文件。')
        import secrets
        source=TENANT/'cache/gradio'/('manual-'+secrets.token_hex(16)+'.json');source.parent.mkdir(parents=True,exist_ok=True)
        try:
            source.write_bytes(raw)
            result=api('POST','workspace/import',{'name':name,'cache_file':source.name})
            return f"已导入 {result['count']} 条记录。"
        finally:source.unlink(missing_ok=True)
    except (ValueError,OSError,TypeError,httpx.HTTPError) as e:return user_error(e)


def display_reason(job):
    # Raw worker output stays in tenant service logs; the product displays task states.
    if job.get("status") == "failed":
        return "任务未能完成，请检查数据和训练参数后重试。"
    reason = str(job.get("reason", ""))
    if any(word in reason.lower() for word in ["traceback", "exception", "llamafactory", "llama-factory", "/opt/", "/home/"]):
        return "任务状态已更新，可在当前页面查看进度和结果。"
    if not any('\u4e00' <= char <= '\u9fff' for char in reason):
        return "任务状态已更新，可在当前页面查看进度和结果。"
    return reason[:400]


def dataset_summary():
    try:
        info = safe_dataset_info("/tenant/data")
        return "\n".join(f"{name} · {item.get('formatting', 'alpaca')}" for name, item in info.items()) or "当前账号暂无训练数据，请先导入数据集。"
    except (ValueError, OSError, TypeError):
        return "训练数据暂时无法读取，请稍后刷新。"


def task_summary():
    try:
        groups = api('GET', 'workspace', timeout=15)['groups']
        statuses = {"queued":"排队中","starting":"启动中","running":"运行中","succeeded":"已完成","failed":"失败","cancelled":"已取消"}
        rows = []
        for group in groups:
            for item in group['items']:
                if item['kind'] != 'job' or item['archived']: continue
                title = html.escape(item['label']); jid = html.escape(item['id'], quote=True)
                rows.append(f'<tr><td title="{title}">{title}</td><td>{statuses[item["status"]]}</td><td><button type="button" data-rh-job-id="{jid}" aria-label="更多操作" title="更多操作">⋯</button></td></tr>')
        table = '<div class="rh-task-table"><table><thead><tr><th>任务名称</th><th>状态</th><th></th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>' if rows else '<p class="rh-task-empty">当前账号暂无任务。</p>'
        return table, '导出成果可在左侧模型导出分组中查看和下载。'
    except (ValueError, httpx.HTTPError) as e:
        return '<p role="alert">'+html.escape(user_error(e))+'</p>', ''


def cancel_current():
    try:
        jobs = api("GET", "jobs")
        for job in jobs:
            if job["status"] in {"queued", "starting", "running"}:
                api("POST", "jobs/" + job["id"] + "/cancel")
                return "当前任务已取消，数据和已有检查点保留。"
        return "当前账号没有排队或运行中的任务。"
    except (ValueError, httpx.HTTPError) as e:
        return user_error(e)


css = Path("/opt/runtime/runhive.css").read_text()
engine = Engine()
engine.runner.job_id = None
current = TENANT / "cache/current-job.json"
if current.exists():
    try:
        state = json.loads(current.read_text())
        job = api("GET", "jobs/" + state["id"])
        if job["status"] in {"queued", "starting", "running"}:
            engine.runner.job_id = state["id"]
            engine.runner.do_train = state["do_train"]
    except Exception:
        pass

locale_script = Path("/opt/runtime/ui_locale.js").read_text()
with gr.Blocks(title="Runhive · 大模型微调", theme=gr.themes.Soft(primary_hue="blue", neutral_hue="slate"), css=css, head="<script>" + locale_script + "</script>", analytics_enabled=False) as demo:
    title = gr.HTML("", visible=False)
    subtitle = gr.HTML("", visible=False)
    engine.manager.add_elems("head", {"title": title, "subtitle": subtitle})
    with gr.Group(elem_id="rh-tune-model-controls"):
        engine.manager.add_elems("top", create_top())
        engine.manager.add_elems("top", {"platform_draft_id":gr.Textbox(value="",visible=False),"platform_draft_revision":gr.Number(value=0,precision=0,visible=False)})
    lang = engine.manager.get_elem_by_id("top.lang")
    lang.value, lang.interactive = "zh", False
    lang.choices = [("简体中文", "zh")]
    engine.manager.get_elem_by_id("top.model_name").choices = [(n, n) for n in MODEL_NAMES]
    engine.manager.get_elem_by_id("top.model_path").interactive = False
    engine.manager.get_elem_by_id("top.hub_name").visible = False
    engine.manager.get_elem_by_id("top.finetuning_type").choices = [("LoRA 微调", "lora"), ("全参数微调", "full"), ("冻结层微调", "freeze")]
    engine.manager.get_elem_by_id("top.quantization_bit").choices = [("不量化", "none"), ("8 位", "8"), ("4 位", "4")]
    with gr.Tabs(elem_id="runhive-tune-sections", selected="data") as sections:
        with gr.Tab("训练数据", id="data", elem_id="rh-tune-section-data"):
            with card("导入数据集", "支持 Alpaca 与 ShareGPT 格式的 JSON / JSONL 文件，单文件上限 64 MB。"):
                with gr.Row(elem_classes=["rh-fields-grid", "rh-grid-2"]):
                    dataset_file = gr.File(label="上传数据集", file_types=[".json", ".jsonl"], type="filepath", elem_id="rh-dataset-upload")
                    dataset_name = gr.Textbox(label="数据集名称", placeholder="例如：业务问答")
                with gr.Row(elem_classes=["rh-actionbar"]):
                    dataset_import = gr.Button("导入数据集", variant="primary")
                import_message = gr.Textbox(label="导入结果", interactive=False)
            import_event = dataset_import.click(import_dataset, [dataset_file, dataset_name], [import_message])
            with card('填写训练数据','每行填写一条指令与回答，输入可以留空；导入后可在微调任务中选择。'):
                manual_name=gr.Textbox(label='数据集名称',placeholder='例如：业务问答补充')
                manual_records=gr.Dataframe(headers=['instruction','input','output'],datatype=['str','str','str'],type='array',row_count=(3,'dynamic'),col_count=(3,'fixed'),label='训练记录',interactive=True)
                manual_import=gr.Button('导入填写的数据',variant='primary')
                manual_result=gr.Textbox(label='导入结果',interactive=False)
            manual_event=manual_import.click(import_dataset_records,[manual_records,manual_name],[manual_result])
            with card("数据列表", "查看当前账号已导入的数据集，可在训练与评估时选择。"):
                with gr.Row(elem_classes=["rh-actionbar"]):
                    refresh_data = gr.Button("刷新数据列表")
                datasets = gr.Textbox(label="已导入数据集", interactive=False, lines=8)
            refresh_data.click(dataset_summary, outputs=[datasets])
            import_event.then(dataset_summary, outputs=[datasets])
            manual_event.then(dataset_summary, outputs=[datasets])
        with gr.Tab("微调任务", id="train", elem_id="rh-tune-section-train"):
            engine.manager.add_elems("train", create_train_tab(engine))
        with gr.Tab("评估验证", id="eval", elem_id="rh-tune-section-eval"):
            engine.manager.add_elems("eval", create_eval_tab(engine))
        with gr.Tab("对话测试", id="chat", elem_id="rh-tune-section-chat"):
            engine.manager.add_elems("infer", create_infer_tab(engine))
        with gr.Tab("模型导出", id="export", elem_id="rh-tune-section-export"):
            engine.manager.add_elems("export", create_export_tab(engine))
            gr.Markdown("**模型导出文件** · 导出完成后刷新列表，即可下载当前账号的文件或压缩包。")
            refresh_exports = gr.Button("刷新导出文件")
            exports = gr.HTML()
    def export_summary():
        return task_summary()[1]
    refresh_exports.click(export_summary, outputs=[exports])
    demo.load(export_summary, outputs=[exports])
    demo.load(dataset_summary, outputs=[datasets])
    for field in ["train.cmd_preview_btn", "eval.cmd_preview_btn"]:
        engine.manager.get_elem_by_id(field).visible = False
    for field in ["train.dataset_dir", "eval.dataset_dir"]:
        elem = engine.manager.get_elem_by_id(field)
        elem.value, elem.interactive = "/tenant/data", False
    engine.manager.get_elem_by_id("infer.extra_args").value = "{}"
    engine.manager.get_elem_by_id("infer.infer_backend").choices = [("平台推理服务 / CPU 验证", "huggingface")]
    engine.manager.get_elem_by_id("infer.infer_backend").interactive = False
    engine.manager.get_elem_by_id("infer.role").choices = [("用户", "user"), ("工具观察", "observation")]
    engine.manager.get_elem_by_id("export.export_device").value = "cpu"
    engine.manager.get_elem_by_id("export.export_device").interactive = False
    engine.manager.get_elem_by_id("export.export_hub_model_id").visible = False
    engine.manager.get_elem_by_id("export.export_quantization_bit").choices = [("不量化", "none")]
    engine.manager.get_elem_by_id("export.export_quantization_bit").interactive = False
    for elem_id in ["top.lang", "top.model_name", "top.model_path", "top.hub_name", "top.finetuning_type", "top.quantization_bit", "train.cmd_preview_btn", "eval.cmd_preview_btn", "train.dataset_dir", "eval.dataset_dir", "infer.extra_args", "infer.infer_backend", "infer.role", "export.export_device", "export.export_hub_model_id", "export.export_quantization_bit"]:
        elem = engine.manager.get_elem_by_id(elem_id)
        set_props(elem, value=elem.value, visible=elem.visible, interactive=elem.interactive)
        if hasattr(elem, "choices"):
            set_props(elem, choices=elem.choices)
    set_props(engine.manager.get_elem_by_id("train.swanlab_project"), value="runhive")
    for name, text in [("start_btn", "开始任务"), ("stop_btn", "停止任务"), ("arg_save_btn", "保存配置"), ("arg_load_btn", "加载配置")]:
        if name in LOCALES:
            LOCALES[name]["zh"]["value"] = text
    for name, text in [("model_name", "选择平台已接入的基础模型。"), ("finetuning_type", "选择参数更新方式。"), ("checkpoint_path", "可选择已有检查点继续训练或验证。")]:
        LOCALES[name]["zh"]["info"] = text
    LOCALES["info_box"]["zh"]["value"] = ""
    set_props(engine.manager.get_elem_by_id("infer.info_box"), placeholder="连接后将在此显示模型状态。")
    set_props(engine.manager.get_elem_by_id("export.info_box"), placeholder="任务运行时将在此显示导出状态。")
    set_props(engine.manager.get_elem_by_id("top.booster"), choices=[("自动", "auto"), ("FlashAttention 2", "flashattn2"), ("Unsloth", "unsloth"), ("Liger Kernel", "liger_kernel")])
    set_props(engine.manager.get_elem_by_id("top.rope_scaling"), choices=[("不启用", "none"), ("线性插值", "linear"), ("动态插值", "dynamic"), ("YaRN", "yarn"), ("Llama 3", "llama3")])
    for elem_name, elem in engine.manager.get_elem_iter():
        if elem_name in LOCALES:
            labels = {key: value for key, value in LOCALES[elem_name]["zh"].items() if key in {"label", "info", "placeholder", "show_label"}}
            if type(elem).__name__ == "Button" and "value" in LOCALES[elem_name]["zh"]:
                labels["value"] = LOCALES[elem_name]["zh"]["value"]
            if labels:
                set_props(elem, **labels)
    def resume():
        # Preserve the official initialization and localization while enforcing Chinese.
        for update in engine.resume():
            yield update
        yield engine.change_lang("zh")
        if engine.runner.job_id:
            yield from monitor(engine.runner)
    demo.load(resume, outputs=engine.manager.get_elem_list(), concurrency_limit=None)
    lang.change(engine.change_lang, [lang], engine.manager.get_elem_list(), queue=False)
    resource_bridge = gr.Textbox(value="", show_label=False, elem_id="rh-resource-apply", elem_classes=["rh-resource-bridge"])


class InstanceAuth:
    def __init__(self, app: ASGIApp):
        from upload_guard import BoundedUploads
        self.app = app
        self.uploads = BoundedUploads(app, TENANT / "cache/gradio")

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        import hmac
        if scope["type"] in {"http", "websocket"} and scope.get("path") != "/health":
            headers = dict(scope.get("headers", []))
            if not hmac.compare_digest(headers.get(b"x-llm-instance-key", b"").decode(), KEY):
                if scope["type"] == "websocket":
                    await send({"type": "websocket.close", "code": 4403})
                else:
                    await JSONResponse({"detail": "账号实例访问未授权。"}, status_code=403)(scope, receive, send)
                return
            if (scope["type"] == "http" and scope.get("method") == "POST"
                    and scope.get("path", "").rstrip("/").endswith("/upload")):
                await self.uploads(scope, receive, send)
                return
        await self.app(scope, receive, send)


application = FastAPI()
@application.get("/health")
def health():
    return {"status": "healthy", "factory": "0.9.4"}


def workspace_name(value, *, allow_slash=True):
    name = relative_name(value, allow_slash=allow_slash)
    if any(ord(char) < 32 or ord(char) == 127 for char in name):
        raise ValueError("名称包含无效字符。")
    return name


def workspace_resources():
    return api('GET', 'workspace', timeout=15)


@application.get("/api/workspace")
def read_workspace():
    try:
        return JSONResponse(workspace_resources(), headers={"Cache-Control": "no-store"})
    except (ValueError, OSError, TypeError, KeyError, httpx.HTTPError):
        return JSONResponse({"detail": "工作区数据暂不可用，请重新刷新。"}, status_code=503, headers={"Cache-Control": "no-store"})


def workspace_idle_state():
    # Official WebChatModel has no busy flag. Its submit/stream and model
    # connection callbacks use Gradio's real queue; loaded only means connected.
    queue = getattr(demo, "_queue", None)
    active = getattr(queue, "active_jobs", None)
    registry = getattr(queue, "event_queue_per_concurrency_id", None)
    runner = getattr(engine, "runner", None)
    running = getattr(runner, "running", None)
    job_id = getattr(runner, "job_id", False)
    if (not isinstance(active, list) or not active or not isinstance(registry, dict)
            or getattr(queue, "stopped", None) is not False or type(running) is not bool
            or (job_id is not None and not isinstance(job_id, str))):
        raise ValueError("任务状态不可用。")
    workers = tuple(active)
    if any(worker is not None and not isinstance(worker, list) for worker in workers):
        raise ValueError("任务状态不可用。")
    active_workers = sum(worker is not None for worker in workers)
    active_events = sum(len(worker) for worker in workers if worker is not None)
    queued_events = 0
    concurrency_active = 0
    for event_queue in tuple(registry.values()):
        events = getattr(event_queue, "queue", None)
        concurrency = getattr(event_queue, "current_concurrency", None)
        if not isinstance(events, list) or type(concurrency) is not int or concurrency < 0:
            raise ValueError("任务状态不可用。")
        queued_events += len(events)
        concurrency_active += concurrency
    has_job = bool(job_id)
    return {"module": "tune", "admin_id": ID, "checked_at": time.time(),
            "idle": not (active_workers or active_events or queued_events or concurrency_active or running or has_job),
            "active_workers": active_workers, "active_events": active_events, "queued_events": queued_events,
            "concurrency_active": concurrency_active, "runner_running": running, "runner_has_job": has_job}


@application.get("/api/workspace/idle")
def read_workspace_idle():
    try:
        return JSONResponse(workspace_idle_state(), headers={"Cache-Control": "no-store"})
    except (ValueError, TypeError, RuntimeError):
        return JSONResponse({"detail": "任务状态暂不可用，请稍后重试。", "idle": False}, status_code=503, headers={"Cache-Control": "no-store"})


@application.get("/api/workspace/exports/{resource:path}")
def download_workspace_export(resource: str):
    try:
        name = workspace_name(resource)
        original = TENANT / "exports" / name
        path = contained(name, TENANT / "exports")
        if original.is_symlink() or not path.is_file():
            raise ValueError("file")
        return FileResponse(path, filename=path.name, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
    except (ValueError, OSError, TypeError):
        return JSONResponse({"detail": "导出文件不可用。"}, status_code=404, headers={"Cache-Control": "no-store"})

from workspace_ui import install as install_workspace_ui
apply_resource_configuration = install_workspace_ui(application, api, TENANT, engine.manager, MODEL_NAMES, constants.TRAINING_STAGES, gr)
with demo:
    editable_resource_inputs=[e for e in engine.manager.get_elem_list() if type(e).__name__ in {"Textbox","Slider","Number","Dropdown","Checkbox","CheckboxGroup","Radio"}]
    bridge_event = resource_bridge.change(apply_resource_configuration, [resource_bridge]+editable_resource_inputs, engine.manager.get_elem_list(), queue=False, api_name=False)
    bridge_event.success(None, js="() => window.dispatchEvent(new Event('rh-resource-applied'))", queue=False)
    bridge_event.failure(None, js="() => window.dispatchEvent(new Event('rh-resource-failed'))", queue=False)

demo.queue(default_concurrency_limit=4, max_size=32)
application = gr.mount_gradio_app(application, demo, path="/", root_path=os.getenv("LLM_ROOT_PATH", "/llm-center/tune"), show_api=False, show_error=False, max_file_size="64mb", allowed_paths=["/tenant/exports", "/tenant/cache/gradio"], blocked_paths=["/tenant/llamaboard_cache", "/tenant/llamaboard_config", "/tenant/chat", "/tenant/jobs", "/models", "/base-models", "/opt/runtime", "/proc", "/etc"])
application = InstanceAuth(application)
if __name__ == "__main__":
    uvicorn.run(application, host="0.0.0.0", port=int(os.getenv("LLM_UI_PORT", "7860")), log_level="warning")
