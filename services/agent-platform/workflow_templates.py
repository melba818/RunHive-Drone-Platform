"""Versioned, inactive examples with real resource bindings and explicit review gates."""

from copy import deepcopy

NODE_TYPES = {
    "vlm_search": {
        "label": "VLM 智能搜索",
        "description": "分析图片或抽样视频，返回匹配画面与目标说明。",
    },
    "change_pair": {
        "label": "两图变化检测",
        "description": "配准两张图片，标记候选差异，可选 VLM 语义复核。",
    },
    "change_mission": {
        "label": "航线任务变化检测",
        "description": "按同一航线、任务和航点匹配前后影像。",
    },
    "onsite_search": {
        "label": "原地搜索",
        "description": "对选定视频在固定位置抽帧搜索，关联设备时先准备人工核对的任务计划。",
    },
    "task_plan": {
        "label": "任务计划",
        "description": "根据现有航线和设备准备任务草稿，禁止自动下发飞行。",
    },
    "annotation": {
        "label": "自动标注",
        "description": "调用原应用标注任务，保留已有正式标注。",
    },
    "annotation_review": {
        "label": "标注效果复核",
        "description": "等待人工检查标注、处理候选与失败项。",
    },
    "dataset_split": {
        "label": "划分数据集",
        "description": "按比例生成新数据集，保留源数据。",
    },
    "training_prepare": {
        "label": "训练参数核对",
        "description": "使用划分后的数据准备原训练草稿。",
    },
    "training": {
        "label": "模型训练",
        "description": "确认后提交原训练接口，跟踪真实任务状态。",
    },
    "tune_prepare": {
        "label": "微调参数核对",
        "description": "绑定实际模型、数据与训练参数。",
    },
    "tune": {
        "label": "大模型微调",
        "description": "确认后提交原微调服务，跟踪实际结果。",
    },
    "approval": {
        "label": "人工确认",
        "description": "暂停工作流，等待用户核对并继续。",
    },
    "report": {"label": "结果归档", "description": "汇总上游分析与任务结果。"},
}

FIELDS = {
    "query": {
        "label": "搜索目标",
        "type": "text",
        "required": True,
        "placeholder": "例如：河岸新增垃圾堆或水面漂浮物",
    },
    "provider_id": {
        "label": "视觉语言模型",
        "type": "resource",
        "source": "vision_models",
        "required": True,
    },
    "resource_ids": {
        "label": "图片／视频",
        "type": "resources",
        "source": "media",
        "required": True,
    },
    "before_id": {
        "label": "基准图片",
        "type": "resource",
        "source": "images",
        "required": True,
    },
    "after_id": {
        "label": "对比图片",
        "type": "resource",
        "source": "images",
        "required": True,
    },
    "airline_id": {
        "label": "航线",
        "type": "resource",
        "source": "routes",
        "required": True,
    },
    "equipment_id": {"label": "设备", "type": "resource", "source": "devices"},
    "baseline_mission": {
        "label": "基准任务",
        "type": "resource",
        "source": "missions",
        "required": True,
    },
    "current_mission": {
        "label": "对比任务",
        "type": "resource",
        "source": "missions",
        "required": True,
    },
    "dataset_id": {
        "label": "数据集",
        "type": "resource",
        "source": "datasets",
        "required": True,
    },
    "annotation_model_id": {
        "label": "标注模型",
        "type": "resource",
        "source": "annotation_models",
        "required": True,
    },
    "label": {"label": "目标类别", "type": "text", "required": True},
    "model_type": {
        "label": "训练架构",
        "type": "resource",
        "source": "training_architectures",
        "required": True,
    },
    "model_name_or_path": {
        "label": "基础模型",
        "type": "resource",
        "source": "tune_models",
        "required": True,
    },
    "dataset": {
        "label": "微调数据集",
        "type": "resource",
        "source": "tune_datasets",
        "required": True,
    },
    "epochs": {
        "label": "训练轮数",
        "type": "number",
        "min": 1,
        "max": 10000,
        "default": 10,
    },
    "num_train_epochs": {
        "label": "微调轮数",
        "type": "number",
        "min": 0.01,
        "max": 100,
        "default": 3,
    },
    "interval_seconds": {
        "label": "视频抽帧间隔（秒）",
        "type": "number",
        "min": 1,
        "max": 300,
        "default": 10,
    },
    "rth_altitude": {
        "label": "返航高度（米）",
        "type": "number",
        "min": 20,
        "max": 500,
        "default": 100,
    },
    "sensitivity": {
        "label": "差异阈值",
        "type": "number",
        "min": 5,
        "max": 80,
        "default": 25,
    },
    "assume_aligned": {
        "label": "确认两图来自固定机位和相同视角",
        "type": "boolean",
        "default": False,
    },
    "objective": {"label": "任务目标", "type": "text", "required": True},
}


def template(ident, name, description, category, event, nodes, fields, defaults=None):
    chain = [
        {
            "id": f"n{i+1}",
            "type": kind,
            "label": NODE_TYPES[kind]["label"],
            "config": {},
            "position": {"x": i * 240, "y": 120},
        }
        for i, kind in enumerate(nodes)
    ]
    return {
        "id": ident,
        "name": name,
        "description": description,
        "category": category,
        "trigger": {"kind": category, "event": event, "interval_minutes": 1440},
        "nodes": chain,
        "edges": [
            {"id": f"e{i}", "source": chain[i - 1]["id"], "target": chain[i]["id"]}
            for i in range(1, len(chain))
        ],
        "fields": {key: deepcopy(FIELDS[key]) for key in fields},
        "bindings": defaults or {},
        "enabled": False,
        "template_version": 1,
    }


TEMPLATES = [
    template(
        "periodic-search",
        "定期巡检影像智能搜索",
        "按周期检索所选影像，例如河岸垃圾、水面漂浮物。",
        "periodic",
        "",
        ["vlm_search", "report"],
        ["query", "provider_id", "resource_ids", "interval_seconds"],
        {"interval_seconds": 10},
    ),
    template(
        "upload-search",
        "新影像自动搜索",
        "资源上传后自动检索新文件，保留匹配画面。",
        "event",
        "resource.uploaded",
        ["vlm_search", "report"],
        ["query", "provider_id", "interval_seconds"],
        {"interval_seconds": 10},
    ),
    template(
        "periodic-change",
        "定期两图变化检测",
        "对比基准图与当前图，输出候选变化区域。",
        "periodic",
        "",
        ["change_pair", "report"],
        ["before_id", "after_id", "sensitivity", "assume_aligned"],
        {"sensitivity": 25, "assume_aligned": False},
    ),
    template(
        "mission-change",
        "航线任务完成后变化检测",
        "任务完成后按航点关联新旧任务影像；缺少影像会明确停在待补充状态。",
        "event",
        "flight_task.completed",
        ["change_mission", "report"],
        ["airline_id", "baseline_mission", "sensitivity", "assume_aligned"],
        {"sensitivity": 25, "assume_aligned": False},
    ),
    template(
        "onsite-search",
        "原地搜索与结果归档",
        "对固定位置拍摄的视频抽帧搜索；可关联现有航线与设备。",
        "event",
        "manual.trigger",
        ["onsite_search", "report"],
        ["query", "provider_id", "resource_ids", "interval_seconds", "equipment_id"],
        {"interval_seconds": 2},
    ),
    template(
        "inspection-plan",
        "巡检任务计划",
        "关联航线与设备，拆分准备、采集和分析步骤，保存可核对的任务草稿。",
        "periodic",
        "",
        ["task_plan", "approval", "report"],
        ["objective", "airline_id", "equipment_id", "rth_altitude"],
        {"rth_altitude": 100},
    ),
    template(
        "annotation-training",
        "自动标注 → 复核 → 训练",
        "使用原标注与训练接口。先检查效果，再划分数据并核对训练参数。",
        "event",
        "dataset.ready",
        [
            "annotation",
            "annotation_review",
            "dataset_split",
            "training_prepare",
            "approval",
            "training",
            "report",
        ],
        ["dataset_id", "annotation_model_id", "label", "model_type", "epochs"],
        {"epochs": 10},
    ),
    template(
        "periodic-annotation-training",
        "周期性标注与训练准备",
        "周期准备新一轮标注，保留效果与训练确认节点。",
        "periodic",
        "",
        [
            "annotation",
            "annotation_review",
            "dataset_split",
            "training_prepare",
            "approval",
            "training",
            "report",
        ],
        ["dataset_id", "annotation_model_id", "label", "model_type", "epochs"],
        {"epochs": 10},
    ),
    template(
        "tune-workflow",
        "训练数据就绪 → 大模型微调",
        "绑定实际基础模型和训练数据，核对后启动微调并归档结果。",
        "event",
        "dataset.ready",
        ["tune_prepare", "approval", "tune", "report"],
        ["model_name_or_path", "dataset", "num_train_epochs"],
        {"num_train_epochs": 3},
    ),
    template(
        "periodic-tune",
        "周期性大模型微调",
        "定期准备微调任务，保留资源校验与人工核对。",
        "periodic",
        "",
        ["tune_prepare", "approval", "tune", "report"],
        ["model_name_or_path", "dataset", "num_train_epochs"],
        {"num_train_epochs": 3},
    ),
]


def templates():
    return deepcopy(TEMPLATES)
