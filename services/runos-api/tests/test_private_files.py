"""Real RunOS API private-file authorization tests. Run only in an isolated environment."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest


class PrivateFiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="runos-b05-")
        cls.base = Path(cls.temp.name)
        cls.a = cls.base / "admin-101"
        cls.b = cls.base / "admin-202"
        cls.a.mkdir(); cls.b.mkdir()
        cls.old = dict(os.environ)
        key = cls.base / "synthetic-key"
        key.write_text("synthetic-b05-key-" * 8)
        os.environ.update(RUNOS_DATA_ROOT=str(cls.a), RUNOS_SHARED_CONFIG_ROOT=str(cls.base / "shared"), RUNOS_OWNER_ADMIN_ID="101", RUNOS_SESSION_SECRET_FILE=str(key), RUNOS_SKIP_RUNTIME_INSTALL="1", NEXUSHIVE_API_URL="http://127.0.0.1:9")
        import main
        from core.nexushive import issue_session
        from fastapi.testclient import TestClient
        cls.client = TestClient(main.app)
        cls.headers = {"Authorization": "Bearer " + issue_session({"admin_id": 101})}
        cls.other = {"Authorization": "Bearer " + issue_session({"admin_id": 202})}
        cls.source = cls.a / "source" / "nested"
        cls.source.mkdir(parents=True)
        (cls.source / "readme.txt").write_text("synthetic owned content")
        (cls.b / "sentinel.txt").write_text("synthetic tenant B private")
        (cls.b / "dataset_metadata.json").write_text(json.dumps({'id':'synthetic-B','name':'synthetic-B','format':'yolo','num_images':1}))
        cls.before_b = {p.relative_to(cls.b).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in cls.b.rglob('*') if p.is_file()}

    @classmethod
    def tearDownClass(cls):
        after = {p.relative_to(cls.b).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in cls.b.rglob('*') if p.is_file()}
        assert after == cls.before_b, "Denied requests modified synthetic tenant B"
        cls.client.close(); os.environ.clear(); os.environ.update(cls.old); cls.temp.cleanup()

    def post(self, path, **kwargs):
        return self.client.post(path, headers=self.headers, **kwargs)

    def test_own_nested_import_preserved(self):
        r = self.post('/api/datasets/load-local', json={'folder_path': str(self.source), 'dataset_name': 'owned-import'})
        self.assertEqual(r.status_code, 200)

    def test_cross_tenant_import_denied_before_side_effect(self):
        from config import settings
        previous = set(settings.active_datasets)
        names = set(settings.DATASETS_DIR.iterdir())
        r = self.post('/api/datasets/load-local', json={'folder_path': str(self.b), 'dataset_name': 'cross-import'})
        self.assertIn(r.status_code, (403, 404))
        self.assertEqual(set(settings.active_datasets), previous)
        self.assertEqual(set(settings.DATASETS_DIR.iterdir()), names)
        self.assertNotIn(str(self.b), r.text)

    def test_relative_traversal_denied(self):
        r = self.post('/api/datasets/load-local', json={'folder_path': '../admin-202', 'dataset_name': 'relative-cross'})
        self.assertIn(r.status_code, (403, 404))

    def test_nonexistent_external_path_not_created(self):
        target = self.b / 'must-not-exist'
        r = self.post('/api/datasets/load-local', json={'folder_path': str(target)})
        self.assertIn(r.status_code, (403, 404))
        self.assertFalse(target.exists())
        self.assertNotIn(str(target), r.text)

    def test_browse_both_aliases_deny_cross_tenant(self):
        for route in ['/api/browse-folders', '/api/datasets/browse-folders']:
            with self.subTest(route=route):
                r = self.post(route, params={'path': str(self.b)})
                self.assertIn(r.status_code, (403, 404))
                self.assertNotIn('sentinel.txt', r.text)
                self.assertNotIn(str(self.b), r.text)

    def test_own_browser_and_parent_clamped(self):
        for route in ['/api/browse-folders', '/api/datasets/browse-folders']:
            r = self.post(route, params={'path': str(self.a)})
            self.assertEqual(r.status_code, 200)
            self.assertNotEqual(r.json().get('parent_path'), str(self.base))

    def test_symlink_source_escape_denied(self):
        link = self.a / 'escape-link'; link.symlink_to(self.b, target_is_directory=True)
        try:
            r = self.post('/api/datasets/load-local', json={'folder_path': str(link)})
            self.assertIn(r.status_code, (403, 404))
        finally:
            link.unlink()

    def test_nested_symlink_escape_denied(self):
        link = self.source / 'escape.txt'; link.symlink_to(self.b / 'sentinel.txt')
        try:
            r = self.post('/api/datasets/load-local', json={'folder_path': str(self.source)})
            self.assertIn(r.status_code, (403, 404))
        finally:
            link.unlink()

    def test_image_alias_cannot_escape(self):
        from config import settings
        directory = settings.DATASETS_DIR / 'alias-test'; directory.mkdir(exist_ok=True)
        settings.active_datasets[directory.name] = {'id': directory.name, 'format': 'yolo', 'name': directory.name}
        r = self.client.get('/api/image/alias-test/%2e%2e/%2e%2e/%2e%2e/admin-202/sentinel.txt', headers=self.headers)
        self.assertIn(r.status_code, (403, 404))
        self.assertNotIn(b'synthetic tenant B private', r.content)

    def test_video_external_input_denied_before_job_creation(self):
        from config import settings
        before = set(settings._extraction_jobs)
        for route,kwargs in [('/api/video/info', {'params': {'video_path': str(self.b / 'sentinel.txt')}}), ('/api/video/extract', {'json': {'video_path': str(self.b / 'sentinel.txt'), 'output_name':'unauthorized-output'}})]:
            if route.endswith('/info'):r = self.client.get(route, headers=self.headers, **kwargs)
            else:r = self.post(route, **kwargs)
            self.assertIn(r.status_code, (403, 404))
        self.assertEqual(set(settings._extraction_jobs), before)

    def test_other_worker_credential_cannot_import(self):
        r = self.client.post('/api/datasets/load-local', headers=self.other, json={'folder_path': str(self.source)})
        self.assertEqual(r.status_code, 403)

    def test_private_browser_skips_external_shared_alias(self):
        link = self.a / 'shared-alias'; link.symlink_to(self.base / 'shared', target_is_directory=True)
        try:
            r = self.post('/api/browse-folders', params={'path':str(self.a)})
            self.assertEqual(r.status_code,200)
            self.assertNotIn('shared-alias', [item['name'] for item in r.json()['items']])
        finally:
            link.unlink()

    def test_export_rejects_escaping_display_name_before_archive(self):
        from config import settings
        folder = settings.DATASETS_DIR / 'export-boundary'; folder.mkdir(exist_ok=True)
        (folder / 'readme.txt').write_text('synthetic owned export')
        settings.active_datasets[folder.name] = {'id':folder.name,'name':'../../admin-202/unauthorized','format':'yolo'}
        target = self.b / 'unauthorized_yolo.zip'
        r = self.client.get('/api/export/'+folder.name, headers=self.headers)
        self.assertIn(r.status_code,(403,404))
        self.assertFalse(target.exists())

    def test_restore_skips_legacy_cross_tenant_symlink(self):
        from config import settings
        from core.workspace import _restore_datasets
        link = settings.DATASETS_DIR / 'legacy-cross-tenant'
        link.symlink_to(self.b, target_is_directory=True)
        try:
            _restore_datasets()
            self.assertNotIn(link.name, settings.active_datasets)
        finally:
            link.unlink()

    def test_open_file_descriptor_survives_leaf_symlink_replacement(self):
        from core.file_access import owned_file_response
        original = self.a / 'descriptor.txt'; original.write_text('owned original bytes')
        response = owned_file_response(original)
        original.rename(self.a / 'descriptor-before-replacement.txt')
        original.symlink_to(self.b / 'sentinel.txt')
        async def collect():
            return b''.join([b async for b in response.body_iterator])
        try:
            self.assertEqual(asyncio.run(collect()), b'owned original bytes')
        finally:
            original.unlink()


if __name__ == '__main__':
    unittest.main()
