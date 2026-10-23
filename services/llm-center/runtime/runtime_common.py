"""Paths and job arguments shared by the isolated LlamaFactory runtime."""
from __future__ import annotations

import json
import math
import re
from pathlib import Path, PurePosixPath

FACTORY_COMMIT = "95ac3f2373b82662c1bd855c284d3379e6a763d3"
FACTORY_VERSION = "0.9.4"
TENANT = Path("/tenant")
MODEL_NAMES = {
    "CPU 验证模型（Tiny Llama）": {"path": "/models/tiny-llama", "template": "default", "cpu": True, "trainable": True},
    "Qwen3-VL-32B（已加载服务）": {"path": "remote://qwen", "template": "qwen3_vl", "remote": "qwen", "trainable": False},
    "VLX-Seek-1.5（已加载服务）": {"path": "remote://vlx", "template": "default", "remote": "vlx", "trainable": False},
}
# Additional unquantized base models may be approved by the platform administrator.
# The catalog is in the platform model mount, never in the writable tenant mount.
catalog_path = Path("/models/catalog.json")
if catalog_path.exists():
    for model_name, item in json.loads(catalog_path.read_text()).items():
        if model_name in MODEL_NAMES or not isinstance(item, dict):
            continue
        path = str(item.get("path", ""))
        if not path.startswith("/base-models/") or ".." in PurePosixPath(path).parts:
            raise ValueError("平台基础模型清单包含无效路径。")
        MODEL_NAMES[model_name] = item
ALLOWED_EXTRA = {"max_steps", "seed", "optim", "weight_decay", "eval_steps", "save_total_limit", "use_reentrant_gc", "disable_gradient_checkpointing", "gradient_checkpointing", "eval_strategy"}


def relative_name(value: str, *, allow_slash: bool = True) -> str:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise ValueError("名称为空或包含无效字符。")
    p = PurePosixPath(value)
    if p.is_absolute() or ".." in p.parts or any(part.startswith(".") for part in p.parts):
        raise ValueError("仅允许当前账号工作区内的相对路径。")
    if not allow_slash and len(p.parts) != 1:
        raise ValueError("名称中不能包含目录分隔符。")
    if len(value) > 240 or any(c in value for c in [":", "\n", "\r"]):
        raise ValueError("名称过长或包含无效字符。")
    return str(p)


def contained(value: str | Path, root: Path, *, allow_relative: bool = True) -> Path:
    if "\\" in str(value) or "\x00" in str(value) or ".." in PurePosixPath(str(value)).parts:
        raise ValueError("路径超出当前账号工作区。")
    p = Path(value)
    if not p.is_absolute():
        if not allow_relative:
            raise ValueError("该路径必须位于当前账号工作区。")
        p = root / p
    root = root.resolve()
    p = p.resolve()
    if not p.is_relative_to(root):
        raise ValueError("路径超出当前账号工作区。")
    return p


def validate_extra(raw: str | dict) -> dict:
    try:
        extra = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError:
        raise ValueError("附加参数不是有效的 JSON 对象，请检查格式。")
    if not isinstance(extra, dict) or set(extra) - ALLOWED_EXTRA:
        raise ValueError("附加参数包含未经允许的路径、模型或运行设置。")
    if any(isinstance(v, (dict, list)) for v in extra.values()):
        raise ValueError("附加参数格式不受支持。")
    if "max_steps" in extra and not 1 <= int(extra["max_steps"]) <= 100000:
        raise ValueError("训练步数应在 1 到 100000 之间。")
    if extra.get("optim", "adamw_torch") not in {"adamw_torch", "adafactor", "sgd"}:
        raise ValueError("请选择受支持的优化器。")
    return extra


def validate_dataset_info(data_root: Path) -> None:
    info_path = contained("dataset_info.json", data_root)
    info = json.loads(info_path.read_text("utf-8"))
    if not isinstance(info, dict):
        raise ValueError("数据集索引格式错误。")
    for name, item in info.items():
        relative_name(name, allow_slash=False)
        if not isinstance(item, dict) or set(item) - {"file_name", "formatting", "columns", "tags", "ranking", "subset", "split"}:
            raise ValueError("数据集索引仅支持本账号上传的本地数据。")
        fn = contained(item.get("file_name", ""), data_root)
        if fn.suffix not in {".json", ".jsonl", ".csv", ".parquet"} or not fn.is_file():
            raise ValueError("数据集文件不存在或格式不受支持。")


def sanitize_args(args: dict, operation: str, tenant_root: Path | None = None) -> tuple[dict, bool]:
    """Validate before a worker is created, and replace every writable path."""
    if not isinstance(args, dict) or len(args) > 180:
        raise ValueError("任务参数格式错误。")
    args = dict(args)
    permitted = {
        "stage", "do_train", "do_eval", "do_predict", "model_name_or_path", "cache_dir", "preprocessing_num_workers", "finetuning_type", "template", "rope_scaling", "flash_attn", "use_unsloth", "enable_liger_kernel", "dataset_dir", "dataset", "eval_dataset", "cutoff_len", "learning_rate", "num_train_epochs", "max_samples", "per_device_train_batch_size", "gradient_accumulation_steps", "lr_scheduler_type", "max_grad_norm", "logging_steps", "save_steps", "warmup_steps", "neftune_noise_alpha", "packing", "neat_packing", "train_on_prompt", "mask_history", "resize_vocab", "use_llama_pro", "enable_thinking", "report_to", "use_galore", "use_apollo", "use_badam", "use_swanlab", "output_dir", "fp16", "bf16", "pure_bf16", "plot_loss", "trust_remote_code", "ddp_timeout", "include_num_input_tokens_seen", "adapter_name_or_path", "quantization_bit", "quantization_method", "double_quantization", "freeze_trainable_layers", "freeze_trainable_modules", "freeze_extra_modules", "lora_rank", "lora_alpha", "lora_dropout", "loraplus_lr_ratio", "create_new_adapter", "use_rslora", "use_dora", "pissa_init", "pissa_convert", "lora_target", "additional_target", "pref_beta", "pref_ftx", "pref_loss", "freeze_vision_tower", "freeze_multi_modal_projector", "freeze_language_model", "image_max_pixels", "image_min_pixels", "video_max_pixels", "video_min_pixels", "val_size", "eval_strategy", "eval_steps", "per_device_eval_batch_size", "predict_with_generate", "max_new_tokens", "top_p", "temperature", "export_dir", "export_size", "export_device", "export_legacy_format", "max_steps", "seed", "optim", "weight_decay", "save_total_limit", "use_reentrant_gc", "disable_gradient_checkpointing", "gradient_checkpointing",
    }
    unsupported = set(args) - permitted
    if unsupported:
        raise ValueError("任务包含未开放的参数：" + "、".join(sorted(unsupported)))
    bounds = {"max_steps": (1, 100000), "num_train_epochs": (0.01, 100), "max_samples": (1, 1000000), "gradient_accumulation_steps": (1, 128), "per_device_train_batch_size": (1, 16), "per_device_eval_batch_size": (1, 16), "cutoff_len": (8, 32768), "learning_rate": (1e-8, .1), "max_new_tokens": (8, 2048), "save_total_limit": (1, 20), "lora_rank": (1, 256), "lora_alpha": (1, 1024), "logging_steps": (1, 100000), "save_steps": (1, 100000), "warmup_steps": (0, 100000), "weight_decay": (0, 1)}
    for key, (lower, upper) in bounds.items():
        if args.get(key) is not None:
            try:
                number = float(args[key])
            except (ValueError, TypeError):
                raise ValueError("任务数值参数格式错误：" + key)
            if not math.isfinite(number) or not lower <= number <= upper:
                raise ValueError(f"参数 {key} 应在 {lower} 到 {upper} 之间。")
    if args.get("optim", "adamw_torch") not in {"adamw_torch", "adafactor", "sgd"}:
        raise ValueError("请选择受支持的优化器。")
    model = next((m for m in MODEL_NAMES.values() if m["path"] == args.get("model_name_or_path")), None)
    if model is None:
        raise ValueError("请选择平台提供的基础模型。")
    if not model.get("trainable"):
        raise ValueError("该模型当前连接平台推理服务，可在对话测试中使用；微调需另行配置并验证兼容的训练权重。")
    cpu = bool(model.get("cpu"))
    if not Path(model["path"]).is_dir():
        raise ValueError("基础模型权重当前不可用，请联系管理员检查模型清单。")
    for key, root in [("output_dir", TENANT / "saves"), ("export_dir", TENANT / "exports")]:
        if args.get(key):
            value = str(args[key])
            if value.startswith("saves/") and key == "output_dir":
                value = value[6:]
            args[key] = str(contained(value, root))
    if args.get("adapter_name_or_path"):
        vals = str(args["adapter_name_or_path"]).split(",")
        args["adapter_name_or_path"] = ",".join(str(contained(v[6:] if v.startswith("saves/") else v, TENANT / "saves")) for v in vals)
    args["cache_dir"] = "/tenant/cache/huggingface"
    args["trust_remote_code"] = False
    if operation in {"train", "eval"}:
        if args.get("dataset_dir") not in {"data", "/tenant/data"}:
            raise ValueError("数据集目录固定为当前账号的数据空间。")
        args["dataset_dir"] = "/tenant/data"
        args["preprocessing_num_workers"] = 2
        args.setdefault("save_total_limit", 3)
        for key in ["dataset", "eval_dataset"]:
            if args.get(key):
                for name in str(args[key]).split(","):
                    relative_name(name, allow_slash=False)
        if not 8 <= int(args.get("cutoff_len", 1024)) <= 32768:
            raise ValueError("序列长度应在 8 到 32768 之间。")
        if not 1 <= int(args.get("per_device_train_batch_size", args.get("per_device_eval_batch_size", 1))) <= 64:
            raise ValueError("批大小应在 1 到 64 之间。")
        if args.get("stage", "sft") not in {"sft", "pt", "dpo", "kto", "rm"}:
            raise ValueError("该训练阶段尚未开放。")
    args["report_to"] = "none" if operation != "export" else args.pop("report_to", None)
    if operation == "export":
        args.pop("report_to", None)
        args["export_device"] = "cpu"
    for key in ["use_unsloth", "enable_liger_kernel", "use_galore", "use_apollo", "use_badam", "use_swanlab"]:
        if args.get(key):
            raise ValueError("该扩展尚未在隔离运行环境中启用。")
    if cpu:
        args.update(fp16=False, bf16=False, pure_bf16=False, flash_attn="disabled") if operation != "export" else None
    if tenant_root:
        validate_dataset_info(tenant_root / "data") if operation != "export" else None
        for key in ["adapter_name_or_path"]:
            for value in str(args.get(key, "")).split(","):
                if value:
                    contained(value.removeprefix("/tenant/"), tenant_root)
    return {k: v for k, v in args.items() if v is not None}, cpu
