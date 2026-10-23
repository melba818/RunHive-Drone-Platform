<div align="center">

# RunHive

**An AI-native platform for drone fleet operations — where an agent copilot helps you annotate data, plan routes, and fine-tune models, all in one console.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v1.0.0-blue.svg)](https://github.com/melba818/runhive/releases)

</div>

## 🎬 Watch it in action

Click the poster to play the 2:40 product tour — a real session where the built-in **Copilot agent** drives the whole workflow by conversation: AI-assisted annotation → agent route planning → LLM fine-tuning.

[![RunHive product tour](docs/media/shot-dashboard.jpg)](docs/media/runhive-demo.mp4)

▶ In-repo video: [docs/media/runhive-demo.mp4](docs/media/runhive-demo.mp4) · Full-quality original: [Google Drive](https://drive.google.com/file/d/1WXHunPKn8j_smbo4kIC76s3jNx_MgLMx/view?usp=drive_link)

## ✨ Highlights

### 🤖 A Copilot agent that actually operates the platform
RunHive embeds an agent assistant into every workspace. It doesn't just chat — it calls platform tools, walks you through multi-step tasks with guided cards, and keeps a task ledger while you confirm each step. Ask it to *"prepare auto-annotation"*, *"create a patrol route for this water area"*, or *"start a fine-tuning run"*, and it drives RunOS, the route planner, and the LLM center for you.

### 🗺️ Agent route planning
Describe the mission; the agent generates the route. In the demo, one sentence produces a **67-waypoint, 1.7 km survey route** over a lake — with per-waypoint altitude, speed, gimbal pitch and actions (e.g. start recording), a height profile, 3D preview, one-click save to the route library, and KMZ import/export for DJI workflows.

### 🧠 LLM fine-tuning, guided end to end
The LLM center brokers model runtimes for the whole platform. Pick a base model and a dataset (or import your own in ShareGPT / Alpaca / plain-text formats), and launch fine-tuning from a visual workspace — no YAML spelunking required. The Copilot can drive the same flow conversationally, step by step.

### 🏷️ RunOS — the data engine
Datasets, AI-assisted batch annotation (vision-language models pre-label, humans review), quality control, train/val splits, YOLO training & inference, model management, and a visual object-tracking module. Flight imagery goes in; deployable models come out.

### 🚁 Fleet & flight operations
Projects, aircraft and dock management, flight tasks and records with OSD tracks, a media library, health (HMS) alerts, and DJI ecosystem integration — everything wrapped in one portal with role-based access control.

## 📸 Screenshots

| | |
|---|---|
| ![Asset overview with Copilot](docs/media/shot-dashboard.jpg) | ![Agent route planning — 67 waypoints generated from one sentence](docs/media/shot-route-planning.jpg) |
| **Asset overview** — fleet, routes and data results on a live map, Copilot on the right | **Agent route planning** — describe the mission, get a survey route |
| ![Route editor](docs/media/shot-route-editor.jpg) | ![Copilot-guided LLM fine-tuning](docs/media/shot-finetune.jpg) |
| **Route editor** — per-waypoint altitude / speed / gimbal / actions, height profile | **LLM fine-tuning** — "I want to fine-tune a model", the agent runs the wizard |
| ![AI-assisted annotation in RunOS](docs/media/shot-annotation.jpg) | ![LLM center fine-tuning workspace](docs/media/shot-llm-center.jpg) |
| **AI annotation** — VLM batch pre-labeling with human review in RunOS | **LLM center** — dataset import and training workspaces |
| ![RunOS datasets](docs/media/shot-runos.jpg) | ![Login](docs/media/shot-login.jpg) |
| **RunOS datasets** — browse, annotate, train | **One portal** for the whole fleet |

## 🧩 Modules

- **Portal & PHP business backend** (`services/php`) — accounts, projects, flight-task and business APIs that everything else integrates with.
- **RunOS** (`apps/runos-web`, `services/runos-api`) — dataset management, annotation workflows, quality review, model training/inference, visual tracking.
- **Agent platform** (`apps/agent-web`, `services/agent-platform`) — multi-agent workbench (chat, tools, MCP bridges, machine access) built on [PenguinHarness](https://github.com/Prism-Shadow/penguin-harness); see `NOTICE`.
- **LLM center** (`services/llm-center`, `apps/llm-center-web`) — gateway, privileged runtime controller and PHP integration brokering LLM instances, fine-tuning jobs and inference for the platform.
- **Assistant & workbench shells** (`apps/assistant-web`, `apps/workbench-web`).

## 🚀 Quick start

**Just want to try it?** Clone this repo and run one command — `cd quickstart && docker compose up -d` — then open <http://localhost:1819/> and log in with `admin` / `runhive-demo`. The quickstart boots the full portal experience against a sanitized demo database, no configuration needed. **Want the complete platform from the demo video — RunOS, the LLM center and the Agent platform included?** Run `./start-full.sh` in the same `quickstart/` directory instead. Details: [quickstart/README.md](quickstart/README.md).

**Building from source (development):**

1. Clone this repository.
2. Copy the environment templates from `deploy/env/` and each module's example env file; fill in values for your environment.
3. Install dependencies per module (Composer for the PHP backend, pnpm/npm for the web apps, pip for the Python services).
4. Follow the per-module README and `docs/MODULES.md` for build and run commands.

## 📄 License & third-party code

RunHive's own code is released under the **MIT License** — see [LICENSE](LICENSE).

This repository also contains or integrates third-party components under their own licenses (including Apache-2.0 components, GPL-3.0-lineage vendored tracking code, and OFL-1.1 fonts). See [NOTICE](NOTICE) for the full attribution list before redistributing.

## 🤝 Contributing · Security

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: see [SECURITY.md](SECURITY.md).
