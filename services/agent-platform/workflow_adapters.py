def task_completed(task):
    if task.get("status") in {
        "completed",
        "done",
        "success",
        "succeeded",
        "finish",
        "finished",
    }:
        return True
    end = task.get("end_time")
    if task.get("status") != "ok" or not end:
        return False
    if isinstance(end, (int, float)):
        return end > 100000000
    try:
        return int(str(end)[:4]) >= 2000
    except ValueError:
        return False


def training_config(cfg, dataset_id):
    model = cfg.get("model_type", "yolov8n")
    # Use the original shared architecture contract, never a made-up weight name.
    if model.startswith("rtdetrv2"):
        kind = "rtdetrv2"
    elif "-seg" in model:
        kind = "segmentation"
    elif "-cls" in model:
        kind = "classification"
    elif model.startswith("yolo"):
        kind = "yolo"
    elif model.startswith("rfdetr"):
        kind = "rfdetr"
    elif model.startswith("rtdetr"):
        kind = "rtdetr"
    else:
        kind = model
    return {
        "dataset_id": dataset_id,
        "model_type": kind,
        "model_arch": model,
        "epochs": cfg.get("epochs", 10),
        "batch_size": cfg.get("batch_size", 16),
        "image_size": cfg.get("image_size", 640),
        "device": cfg.get("device", "auto"),
        "name": cfg.get("training_name", "工作流训练"),
        "initial_weights": "builtin",
    }
