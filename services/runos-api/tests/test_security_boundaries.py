"""Run in an isolated, CPU-only environment with approved dependencies installed.

Uses the real application, signature verification and resource store. All identities,
files and SQLite records are synthetic. Does not contact SSO, train or load models.
"""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path


class SecurityBoundaries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="runos-security-")
        cls.root = Path(cls.temp.name)
        cls.old_env = dict(os.environ)
        secret = cls.root / "session-secret"
        secret.write_text("synthetic-test-key-only-" * 4, encoding="ascii")
        os.environ.update(
            RUNOS_DATA_ROOT=str(cls.root / "admin-101"),
            RUNOS_SHARED_CONFIG_ROOT=str(cls.root / "shared"),
            RUNOS_OWNER_ADMIN_ID="101",
            RUNOS_SKIP_RUNTIME_INSTALL="1",
            RUNOS_SESSION_SECRET_FILE=str(secret),
            NEXUSHIVE_API_URL="http://127.0.0.1:9",
            CUDA_VISIBLE_DEVICES="-1",
        )
        # The application historically uses its app directory as the Python root.
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))
        from fastapi.testclient import TestClient
        import main
        from core.nexushive import issue_session
        cls.app = main.app
        cls.client = TestClient(cls.app)
        cls.a = issue_session({"admin_id": 101, "username": "synthetic-A"})
        cls.b = issue_session({"admin_id": 202, "username": "synthetic-B"})

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        os.environ.clear()
        os.environ.update(cls.old_env)
        cls.temp.cleanup()

    def headers(self, token=None):
        return {"Authorization": "Bearer " + (token or self.a)}

    def test_anonymous_and_spoofed_headers_are_rejected(self):
        response = self.client.get("/api/datasets", headers={"X-User-ID": "101", "X-Tenant-ID": "101"})
        self.assertEqual(response.status_code, 401)

    def test_other_worker_identity_is_rejected(self):
        self.assertEqual(self.client.get("/api/datasets", headers=self.headers(self.b)).status_code, 403)

    def test_own_worker_and_query_tenant_override(self):
        response = self.client.get("/api/datasets?tenant_id=202", headers=self.headers())
        self.assertEqual(response.status_code, 200)

    def test_upload_cannot_write_parent(self):
        target = self.root / "admin-101" / "escaped.txt"
        response = self.client.post("/api/datasets/load?dataset_name=upload-test", headers=self.headers(), files={"files": ("../../escaped.txt", b"synthetic", "text/plain")})
        self.assertIn(response.status_code, (400, 422))
        self.assertFalse(target.exists())

    def test_dataset_folder_dot_names_stay_beneath_root(self):
        from core.workspace import _make_dataset_folder
        from config import settings
        for name in (".", "..", "...", "safe-name"):
            with self.subTest(name=name):
                _, folder = _make_dataset_folder(name)
                self.assertEqual(folder.resolve().parent, settings.DATASETS_DIR.resolve())

    def test_download_cannot_read_other_worker_or_follow_symlink(self):
        from config import settings
        dataset = settings.DATASETS_DIR / "security-download"
        dataset.mkdir(exist_ok=True)
        settings.active_datasets[dataset.name] = {"id": dataset.name, "name": dataset.name, "format": "yolo", "num_images": 1}
        other = self.root / "admin-202"
        other.mkdir(exist_ok=True)
        private = other / "sentinel.txt"
        private.write_text("synthetic-B-private", encoding="utf-8")
        (dataset / "link.txt").symlink_to(private)
        for tail in ("%2e%2e/%2e%2e/%2e%2e/admin-202/sentinel.txt", "link.txt"):
            with self.subTest(path=tail):
                response = self.client.get("/api/datasets/security-download/image-file/" + tail, headers=self.headers())
                self.assertIn(response.status_code, (400, 403, 404))
                self.assertNotIn(b"synthetic-B-private", response.content)

    def test_download_own_image_bytes_unchanged(self):
        from config import settings
        dataset = settings.DATASETS_DIR / "own-download"
        dataset.mkdir(exist_ok=True)
        settings.active_datasets[dataset.name] = {"id": dataset.name, "name": dataset.name, "format": "yolo", "num_images": 1}
        content = b"synthetic-owned-image"
        (dataset / "own.png").write_bytes(content)
        response = self.client.get("/api/datasets/own-download/image-file/own.png", headers=self.headers())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, content)

    def test_resource_store_checks_owner_even_with_known_id(self):
        from fastapi import HTTPException
        from resource_store import ResourceStore
        store = ResourceStore(self.root / "synthetic-library")
        row = store.add(202, "owned-by-B", "folder")
        self.assertEqual(store.get(202, row["id"])["owner"], 202)
        with self.assertRaises(HTTPException) as caught:
            store.get(101, row["id"])
        self.assertEqual(caught.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
