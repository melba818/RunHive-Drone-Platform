# RunHive

RunHive is a self-hosted platform for drone data operations and AI-assisted
workflows. It combines a business portal, the RunOS annotation and model
operations console, a multi-agent workbench, and an LLM center that brokers
model runtimes for the other modules.

This repository contains the source code of the platform: web frontends,
backend services, cross-service contracts and deployment examples. It does
not contain production configuration, credentials, customer data, exported
datasets or model weights.

## Modules

- Portal and PHP business backend (services/php) — accounts, projects,
  flight-task and business APIs that the other modules integrate with.
- RunOS (apps/runos-web, services/runos-api) — dataset management, annotation
  workflows, quality review and model training/inference operations,
  including a visual object tracking module.
- Agent platform (apps/agent-web, services/agent-platform) — a multi-agent
  workbench (chat, tools, MCP bridges, machine access) built on
  PenguinHarness; see NOTICE for the upstream attribution.
- LLM center (services/llm-center, apps/llm-center-web) — gateway, privileged
  runtime controller and PHP integration that broker LLM instances and jobs
  for the platform.
- Assistant and workbench shells (apps/assistant-web, apps/workbench-web).

## Quick start (development)

1. Clone this repository.
2. Copy the environment templates from deploy/env/ and each module's
   example env file; fill in values for your environment.
3. Install dependencies per module from its lockfile (Composer for the PHP
   backend, pnpm/npm for the web apps, pip for the Python services).
4. Follow the per-module README and docs/MODULES.md for build and run
   commands, and docs/ for architecture notes.

## License

RunHive's own code is released under the MIT License; see LICENSE.

This repository also contains or integrates third-party components under
their own licenses (including Apache-2.0, GPL-3.0-lineage vendored tracking
code, and OFL-1.1 fonts). See NOTICE for the full attribution list before
redistributing.

## Contributing

See CONTRIBUTING.md. Security reports: see SECURITY.md.
