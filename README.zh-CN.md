<div align="center">

# RunHive

**为无人机集群运营而生的 AI 原生平台 —— 一个内置的 Agent 助手，陪你标注数据、规划航线、微调大模型，全部在一个控制台里完成。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v1.0.0-blue.svg)](https://github.com/melba818/runhive/releases)

</div>

## 🎬 先看演示

点击下方海报播放 2 分 40 秒的产品演示 —— 这是一段真实操作录像：内置的 **Copilot 智能助手**全程用对话驱动完整工作流：AI 辅助标注 → Agent 航线规划 → 大模型微调。

[![RunHive 产品演示](docs/media/shot-dashboard.jpg)](docs/media/runhive-demo.mp4)

▶ 仓库内视频：[docs/media/runhive-demo.mp4](docs/media/runhive-demo.mp4) · 高清原版：[Google Drive](https://drive.google.com/file/d/1WXHunPKn8j_smbo4kIC76s3jNx_MgLMx/view?usp=drive_link)

## ✨ 核心亮点

### 🤖 一个真正能"干活"的 Copilot 智能助手
RunHive 把 Agent 助手嵌进了每一个工作台。它不只是聊天 —— 它会调用平台工具，用分步引导卡片带你完成多步骤任务，全程留痕、每一步由你确认。对它说一句"帮我准备自动标注""给这片水域创建一条巡检航线""我要进行大模型微调"，它就会替你驱动 RunOS、航线规划器和大模型中心。

### 🗺️ Agent 航线规划
说清任务，航线自动生成。演示中一句话就生成了一条覆盖湖面的 **67 个航点、1.7 公里**测绘航线 —— 每个航点可设高度、速度、云台俯仰与动作（如开始录像），带高度曲线剖面与三维预览，一键保存进航线库，并支持 KMZ 导入/导出，无缝衔接 DJI 工作流。

### 🧠 大模型微调，全程引导
大模型中心为全平台调度模型运行时。选基座模型、选数据集（或导入你自己的 ShareGPT / Alpaca / 纯文本数据），在可视化工作台里就能发起微调 —— 不用再手写 YAML。Copilot 也可以用对话方式分步带你走完同样的流程。

### 🏷️ RunOS —— 数据引擎
数据集管理、AI 辅助批量标注（视觉大模型预标注 + 人工复核）、质量检查、训练/验证划分、YOLO 训练与推理、模型管理，以及视觉目标跟踪模块。飞行影像进来，可部署的模型出去。

### 🚁 机队与飞行运营
项目、飞行器与机场管理、飞行任务与飞行记录（含 OSD 轨迹）、媒体库、健康（HMS）告警与 DJI 生态对接 —— 全部收拢在一个带角色权限体系的门户里。

## 📸 界面一览

| | |
|---|---|
| ![资产总览与 Copilot](docs/media/shot-dashboard.jpg) | ![Agent 航线规划](docs/media/shot-route-planning.jpg) |
| **资产总览** —— 机队、航线与数据成果尽在一张活地图，右侧是 Copilot | **Agent 航线规划** —— 描述任务，航线即刻生成 |
| ![航线编辑器](docs/media/shot-route-editor.jpg) | ![Copilot 引导大模型微调](docs/media/shot-finetune.jpg) |
| **航线编辑器** —— 逐航点高度/速度/云台/动作与高度曲线 | **大模型微调** —— 一句"我要进行大模型微调"，助手分步引导 |
| ![RunOS AI 标注](docs/media/shot-annotation.jpg) | ![大模型中心微调工作台](docs/media/shot-llm-center.jpg) |
| **AI 标注** —— 视觉大模型批量预标注，人工复核把关 | **大模型中心** —— 数据集导入与训练工作台 |
| ![RunOS 数据集](docs/media/shot-runos.jpg) | ![登录页](docs/media/shot-login.jpg) |
| **RunOS 数据集** —— 浏览、标注、训练一气呵成 | **一个门户**，管好整个机队 |

## 🧩 模块构成

- **门户与 PHP 业务后端**（`services/php`）—— 账号、项目、飞行任务与业务 API，是其他所有模块的集成底座。
- **RunOS**（`apps/runos-web`、`services/runos-api`）—— 数据集管理、标注工作流、质量复核、模型训练/推理、视觉跟踪。
- **Agent 平台**（`apps/agent-web`、`services/agent-platform`）—— 基于 [PenguinHarness](https://github.com/Prism-Shadow/penguin-harness) 的多智能体工作台（对话、工具、MCP 桥接、机器接入）；归属说明见 `NOTICE`。
- **大模型中心**（`services/llm-center`、`apps/llm-center-web`）—— 网关、特权运行时控制器与 PHP 集成层，为全平台调度 LLM 实例、微调任务与推理服务。
- **助手与工作台壳**（`apps/assistant-web`、`apps/workbench-web`）。

## 🚀 快速开始

**只想试试？** 到 [Releases](https://github.com/melba818/runhive/releases) 下载一键演示包：解压后执行 `docker compose up -d`，打开 <http://localhost:1819/>，用演示账号 `admin` / `runhive-demo` 登录即可。演示包内置脱敏的种子数据库，零配置启动完整门户体验。

**从源码构建（开发环境）：**

1. 克隆本仓库。
2. 复制 `deploy/env/` 下的环境模板与各模块的示例 env 文件，按你的环境填值。
3. 按模块安装依赖（PHP 后端用 Composer，前端应用用 pnpm/npm，Python 服务用 pip）。
4. 构建与运行命令见各模块 README 与 `docs/MODULES.md`。

## 📄 许可证与第三方代码

RunHive 自有代码以 **MIT 许可证**发布 —— 见 [LICENSE](LICENSE)。

本仓库同时包含或集成了采用各自许可证的第三方组件（包括 Apache-2.0 组件、GPL-3.0 谱系的 vendored 跟踪代码、OFL-1.1 字体等）。再分发前请阅读 [NOTICE](NOTICE) 中的完整归属清单。

## 🤝 参与贡献 · 安全

贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)；安全问题报告见 [SECURITY.md](SECURITY.md)。
