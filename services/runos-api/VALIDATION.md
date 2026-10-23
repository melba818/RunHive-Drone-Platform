# RunOS API isolated verification

The historical entry point is `main:app`, with `app/` as the Python import root.
`requirements.validation.txt` is a new CPU-only verification profile, not a
historical lock or complete model/training dependency closure. It uses public,
hashed Linux wheels and headless OpenCV. Production requirements are unchanged.

Run `tests/test_security_boundaries.py` in a separate nonroot, network-disabled
container with these dependencies installed. The tests import the real application
and use synthetic identities, local files and SQLite records. They neither train
models nor contact real SSO. Set the application's Python import root to `app/`.
Runtime data, temporary directories and synthetic session keys must be disposable.
Set `RUNOS_SKIP_RUNTIME_INSTALL=1`; do not mount production files or credentials.

Verified boundaries include signature rejection, worker owner matching, dataset
upload/download path containment and ResourceStore owner filtering. This does not
prove a complete role model, production SSO, GPU/model availability or arbitrary
local-folder import safety. The existing load-local/browse-folder APIs accept
filesystem paths; allowed external import roots and service-account access need an
explicit policy before multi-tenant security approval. Shared model/compute storage
is another distinct authorization boundary. Controlled `_vendor` remains excluded.
