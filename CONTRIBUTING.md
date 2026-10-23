# Contributing to RunHive

Thanks for your interest in RunHive. This document describes how to set up a
development environment and how contributions are reviewed.

## Repository layout

- apps/ — web frontends (RunOS web, Agent web and UI library, assistant,
  LLM center shell, workbench)
- services/ — backends (RunOS API, Agent platform, LLM center, PHP business
  backend)
- contracts/ — cross-service contracts
- deploy/ — deployment examples and environment templates
- docs/ — architecture and module documentation

See docs/MODULES.md for the module map and docs/HANDOVER.md for engineering
conventions (branching, validation order, and what is intentionally not in
this repository, such as production data, model weights and secrets).

## Development setup

1. Copy the environment templates in deploy/env/ and the per-module example
   files, and fill in values for your own environment. Never commit real
   credentials, production endpoints or customer data.
2. Install module dependencies from the lockfiles of each module
   (Composer, pnpm/npm, pip) rather than copying vendor directories.
3. Run the module's documented build and test commands before submitting.

## Contribution rules

- Keep changes scoped to one module or one concern per pull request.
- Do not commit generated artifacts (build output, caches, exports), real
  environment files, database dumps or model weights.
- Third-party code must keep its original license and attribution; add an
  entry to NOTICE when you vendor or adapt external code.
- Security-sensitive changes (authentication, file access, sandboxing)
  require a description of the threat model in the pull request.

## Reporting issues

Use the issue tracker of this repository. For security vulnerabilities, do
not open a public issue; follow SECURITY.md instead.
