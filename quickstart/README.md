# RunHive Quickstart / 快速启动

One command brings up the RunHive portal — the same entry point as a production deployment — with a sanitized demo database.

一条命令启动 RunHive 门户（与生产部署一致的入口），内置脱敏的演示数据库。

## Run / 启动

```bash
git clone https://github.com/melba818/runhive.git
cd runhive/quickstart
docker compose up -d
```

Then open <http://localhost:1819/> and log in with the demo account:

启动后打开 <http://localhost:1819/>，使用演示账号登录：

- Username / 账号：`admin`
- Password / 密码：`runhive-demo`

The first start builds the PHP backend image (Composer dependencies are installed from `services/php/composer.lock`) and initializes the database; allow a few minutes. Set `DEMO_PORT` to change the host port.

首次启动会构建 PHP 后端镜像（Composer 依赖按 `services/php/composer.lock` 安装）并初始化数据库，需要几分钟。可用环境变量 `DEMO_PORT` 修改宿主机端口。

Stop / 停止：`docker compose down`（add `-v` to also drop the demo data / 加 `-v` 同时清除演示数据）。

## Scope / 范围

- Included: the portal (served from its built distribution — see `docs/SOURCE-GAPS.md`), the PHP business backend, MariaDB and Redis, with seeded menus, rules and demo content.
- Not included in this minimal quickstart: the RunOS, LLM-center and Agent-center services — for those, use the **Full version** below.
- 包含：门户（以构建产物形式提供，见 `docs/SOURCE-GAPS.md`）、PHP 业务后端、MariaDB 与 Redis，附菜单、权限规则与演示数据种子。
- 本精简版不包含：RunOS、大模型中心、Agent 中心等独立服务——需要它们请用下方的**完全版本**。

## Demo values — change before any real use / 演示值说明

`backend.env`, the database credentials in `docker-compose.yml`, contain throwaway demo-only values so the stack starts with zero configuration. The inter-service secrets in `runtime/` are generated fresh on first start by the `init` service (and `runtime/` is git-ignored, so no secret is ever committed). **Never reuse them outside this local demo** — generate your own secrets for a real deployment.

`backend.env`、`docker-compose.yml` 中的数据库口令均为一次性的演示值，只为零配置启动；`runtime/` 内的服务间密钥由 `init` 服务在首次启动时本地生成（且 `runtime/` 已被 git 忽略，不会入库）。**切勿用于真实部署**，正式环境请自行生成。

---

# Full version / 完全版本

Everything the demo video shows — the portal plus **RunOS** (data engine), the **LLM center** (fine-tuning workspaces) and the **Agent platform** (the Copilot's tool layer) — in one deployment:

演示视频里的完整形态 —— 门户 + **RunOS**（数据引擎）+ **大模型中心**（微调工作区）+ **Agent 平台**（Copilot 的工具层），一套部署全部拉起：

```bash
git clone https://github.com/melba818/runhive.git
cd runhive/quickstart
./start-full.sh
```

Then open <http://localhost:1819/> (demo account `admin` / `runhive-demo`) and launch RunOS, the LLM center or the Agent center from the portal's app center — no further setup. RunOS also answers on <http://localhost:14000/> after launch.

打开 <http://localhost:1819/>（演示账号 `admin` / `runhive-demo`），在门户应用中心里启动 RunOS、大模型中心或 Agent 中心即可，无需其他配置。RunOS 启动后也可从 <http://localhost:14000/> 进入。

### Notes / 说明

- **Bring your own model key / 自备模型密钥**：the AI features call a model provider at runtime. Copy `.env.example` to `.env` in this directory and fill in **your own** provider key (`RUNHIVE_LLM_API_KEY`, base URL and model) *before* the first start. Without it the stack runs normally, but AI calls report that no model is configured. The repository contains **no real keys** — all inter-service secrets are generated locally on first start into `runtime-full/` (git-ignored).
  AI 功能运行时需要调用模型服务。首次启动前把 `.env.example` 复制为本目录下的 `.env`，填入**你自己的**服务商密钥（`RUNHIVE_LLM_API_KEY`、接口地址与模型名）。不填也能正常启动，只是 AI 调用会提示未配置模型。仓库内**不含任何真实密钥**——服务间密钥在首次启动时本地生成到 `runtime-full/`（已被 git 忽略）。
- **First boots are slow / 首次启动偏慢**：the first start builds several images (including the fine-tuning workspace, ~2 GB) and each workspace container loads its ML stack on first launch. Allow ample time on first run; later starts are fast.
  首次启动要构建多个镜像（含约 2 GB 的微调工作区镜像），每个工作区容器第一次打开时也要加载训练框架，请留足时间；后续启动会快很多。
- **Actually training** needs a GPU and model weights, which are out of scope for this one-click stack; the fine-tuning workspace UI, datasets and job management all work on CPU.
  真正发起训练需要 GPU 与模型权重，不在一键部署的范围内；微调工作区的界面、数据集与任务管理在 CPU 上可正常使用。
- **Agent workbench image / Agent 工作台镜像**：the Agent *platform* service (used by the portal Copilot) is included. The standalone Agent workbench runs a dedicated image built from the upstream [PenguinHarness](https://github.com/Prism-Shadow/penguin-harness) project; until that image is built and tagged `runhive-agent-workspace:latest`, agent workspace sessions report the missing image instead of failing silently.
  门户 Copilot 使用的 Agent *平台*服务已包含。独立的 Agent 工作台使用由上游 [PenguinHarness](https://github.com/Prism-Shadow/penguin-harness) 项目构建的专用镜像；在镜像构建并打上 `runhive-agent-workspace:latest` 标签之前，Agent 工作区会话会明确报告镜像缺失。
- Stop / 停止：`docker compose -f docker-compose.full.yml down`（add `-v` to also drop the data / 加 `-v` 同时清除数据）。Generated secrets live in `runtime-full/` and state in `state-full/`; delete both to reset completely.
  生成的密钥在 `runtime-full/`、状态在 `state-full/`；删除这两个目录即可完全重置。
