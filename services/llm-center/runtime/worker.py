"""Run official LlamaFactory training, evaluation or export in a tenant job container."""
import json
import os
import sys
import shutil
import zipfile
from pathlib import Path

from runtime_common import sanitize_args

job_id, operation = sys.argv[1:]
if len(job_id) != 32 or any(c not in "0123456789abcdef" for c in job_id):
    raise SystemExit("任务编号无效。")
args = json.loads((Path("/tenant/jobs") / job_id / "args.json").read_text())
args, cpu = sanitize_args(args, operation, Path("/tenant"))
if args.get("output_dir"):
    os.environ["LLAMABOARD_WORKDIR"] = args["output_dir"]
if operation == "export":
    from llamafactory.train.tuner import export_model
    export_model(args)
    export_dir = Path(args["export_dir"])
    files = [p for p in export_dir.rglob("*") if p.is_file()]
    total_size = sum(p.stat().st_size for p in files)
    if shutil.disk_usage(export_dir).free > total_size + 1024**3:
        archive = export_dir.with_suffix(".zip")
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as bundle:
            for file in files:
                bundle.write(file, file.relative_to(export_dir))
        print("已生成当前账号的模型导出压缩包。", flush=True)
    else:
        print("当前磁盘余量不足以生成压缩包，可分别下载已导出的模型文件。", flush=True)
else:
    from llamafactory.train.tuner import run_exp
    run_exp(args)
print("任务已完成。", flush=True)
