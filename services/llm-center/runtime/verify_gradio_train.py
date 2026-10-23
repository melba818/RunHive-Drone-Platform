"""Exercise the actual Factory UI training adapter and loss PlotData on the test tenant."""
import json
import os
from pathlib import Path

from gradio_client import Client

import ui

client = Client('http://127.0.0.1:7860', headers={'X-LLM-Instance-Key': os.environ['LLM_INSTANCE_KEY']}, download_files='/tmp/llm-client-check', verbose=False)
client.predict('/tenant/data', '监督微调', api_name='/list_datasets')
mapping = {e._id: ui.engine.manager.get_id_by_elem(e) for e in ui.engine.manager.get_elem_list()}
config = client.config
dep = next(d for d in config['dependencies'] if d.get('api_name') == 'run_train')
components = {c['id']: c for c in config['components']}
overrides = {
    'top.lang': 'zh', 'top.model_name': 'CPU 验证模型（Tiny Llama）', 'top.model_path': '/models/tiny-llama', 'top.template': 'default', 'top.finetuning_type': 'lora',
    'train.training_stage': '监督微调', 'train.dataset_dir': '/tenant/data', 'train.dataset': ['quickstart'], 'train.learning_rate': '0.001', 'train.num_train_epochs': '1', 'train.max_samples': '4', 'train.compute_type': 'fp32', 'train.cutoff_len': 32, 'train.batch_size': 2, 'train.gradient_accumulation_steps': 1, 'train.logging_steps': 1, 'train.save_steps': 10,
    'train.extra_args': '{"max_steps":3,"optim":"adamw_torch","gradient_checkpointing":false}', 'train.lora_rank': 4, 'train.lora_alpha': 8, 'train.lora_target': 'q_proj,v_proj', 'train.output_dir': 'ui-dual-acceptance-20261007',
}
values = [overrides.get(mapping.get(i), components[i]['props'].get('value')) for i in dep['inputs']]
job = client.submit(*values, api_name='/run_train')
result = job.result(timeout=180)
serialized = json.dumps(result, ensure_ascii=False)
record = {'factory_ui_training_adapter': True, 'completed': '任务状态：已完成' in serialized, 'loss_plot_returned': 'data:image/' in serialized, 'result_types': [type(x).__name__ for x in result]}
Path('/tenant/jobs/gradio-ui-verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2))
print('UI_TRAIN_VERIFICATION', record, flush=True)
if not record['completed']:
    print(serialized[-7000:], flush=True)
    raise RuntimeError('UI training did not complete')
