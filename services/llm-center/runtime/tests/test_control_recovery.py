"""Independent control review fixtures; no live controller or Docker calls."""
import ast
import copy
import importlib.util
import json
import sqlite3
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

RUNTIME = Path(__file__).resolve().parents[1]


def functions(names, namespace):
    nodes = [copy.deepcopy(node) for node in ast.parse((RUNTIME/'control.py').read_text('utf-8')).body
             if isinstance(node, ast.FunctionDef) and node.name in names]
    for node in nodes:
        node.decorator_list = []
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'reviewed-control-functions', 'exec'), namespace)
    return namespace


class ControlReviewTests(unittest.TestCase):
    def test_worker_started_before_controller_interruption_is_adopted_without_restart(self):
        with tempfile.TemporaryDirectory() as root:
            dbfile = Path(root)/'control.sqlite'
            conn = sqlite3.connect(dbfile)
            conn.executescript("CREATE TABLE jobs(id TEXT PRIMARY KEY,tenant INT,operation TEXT,status TEXT,cpu INT,created REAL,reason TEXT,container TEXT,updated REAL,args TEXT,gpu TEXT,exit_code INT);INSERT INTO jobs VALUES('fixture',901,'train','queued',1,1,'',NULL,1,'{}',NULL,NULL);")
            conn.commit(); conn.close()
            failed = [False]
            actions, containers = [], {}

            class DB:
                def __enter__(self):
                    self.conn = sqlite3.connect(dbfile)
                    self.conn.row_factory = sqlite3.Row
                    return self
                def __exit__(self, *error):
                    self.conn.rollback() if error[0] else self.conn.commit()
                    self.conn.close()
                def execute(self, sql, *args):
                    if sql.startswith("UPDATE jobs SET status='running'") and not failed[0]:
                        failed[0] = True
                        raise RuntimeError('fixture interruption after Docker worker start')
                    return self.conn.execute(sql, *args)

            def docker(method, path, **kwargs):
                actions.append((method, path))
                if method == 'DELETE': containers.clear()
                if path.startswith('/containers/create'):
                    containers['runhive-llm-job-fixture'] = {'State': {'Running': False, 'Status': 'created'}}
                if path.endswith('/start'):
                    containers['runhive-llm-job-fixture'] = {'State': {'Running': True, 'Status': 'running'}}

            namespace = functions({'schedule_once', 'reconcile'}, {
                'LOCK': threading.RLock(), 'db': DB, 'time': time, 'json': json,
                'common_container': lambda tenant: {'Env': [], 'HostConfig': {}},
                'inspect': containers.get, 'docker': docker, 'append_log': lambda *args: None,
                'DOCKER': SimpleNamespace(get=lambda path: SimpleNamespace(status_code=200, content=b'fixture worker log'))
            })
            with self.assertRaises(RuntimeError): namespace['schedule_once']()
            with DB() as db:
                self.assertEqual(db.execute('SELECT status FROM jobs').fetchone()[0], 'starting')
            namespace['schedule_once']()
            with DB() as db:
                self.assertEqual(db.execute('SELECT status FROM jobs').fetchone()[0], 'running')
            self.assertFalse(any(method == 'DELETE' for method, path in actions))
            self.assertEqual(sum(path.endswith('/start') for method, path in actions), 1)

    def test_tenant_resource_response_omits_other_accounts_job_identity(self):
        namespace = functions({'resources'}, {
            'Request': object, 'authorize': lambda request, tenant: None,
            'gpu_status': lambda: {'probe_ok': True, 'gpus': [], 'runos_active_tasks': [
                {'tenant': 'admin-902', 'id': 'private-other-account-job', 'status': 'running'}],
                'qwen_running': 0, 'qwen_waiting': 0}
        })
        result = namespace['resources'](901, None)
        serialized = json.dumps(result)
        self.assertNotIn('admin-902', serialized)
        self.assertNotIn('private-other-account-job', serialized)
        self.assertEqual(result['existing_task_count'], 1)
        self.assertTrue(result['existing_tasks_busy'])

    def test_gpu_allocation_requires_known_free_unleased_resources(self):
        namespace = functions({'choose_gpu'}, {})
        choose = namespace['choose_gpu']
        base = {'probe_ok': True, 'runos_active_tasks': [], 'qwen_running': 0, 'qwen_waiting': 0,
                'gpus': [{'uuid': 'GPU-fixture', 'free_mb': 30000, 'utilization': 0}]}
        self.assertEqual(choose(base, 24000, set())[0], 'GPU-fixture')
        self.assertIsNone(choose(base, 24000, {'GPU-fixture'})[0])
        self.assertIsNone(choose({**base, 'probe_ok': False}, 24000, set())[0])
        self.assertIsNone(choose({**base, 'runos_active_tasks': [{'status': 'running'}]}, 24000, set())[0])
        self.assertIsNone(choose({**base, 'qwen_waiting': 1}, 24000, set())[0])
        self.assertIsNone(choose(base, 29000, set())[0])

    def test_control_request_bounds_apply_without_frontend_validation(self):
        spec = importlib.util.spec_from_file_location('review_common', RUNTIME/'runtime_common.py')
        common = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(common)
        with tempfile.TemporaryDirectory() as model:
            tiny = next(item for item in common.MODEL_NAMES.values() if item.get('cpu'))
            tiny['path'] = model
            args = {'model_name_or_path': model, 'dataset_dir': 'data', 'dataset': 'quickstart', 'do_train': True}
            valid, _ = common.sanitize_args({**args, 'max_steps': 10}, 'train')
            self.assertEqual(valid['max_steps'], 10)
            for extra in [{'max_steps': 100001}, {'num_train_epochs': float('inf')},
                          {'cutoff_len': 32769}, {'trust_remote_code': True, 'model_name_or_path': '/other-account/model'},
                          {'output_dir': '/state/tenants/admin-902/saves'}]:
                with self.subTest(extra=extra), self.assertRaises(ValueError):
                    common.sanitize_args({**args, **extra}, 'train')


if __name__ == '__main__':
    unittest.main(verbosity=2)
