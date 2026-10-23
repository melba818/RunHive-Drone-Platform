# 源码完整性及权利边界

> 2026-10-16 更新：下文为原 A-11 来源缺口登记。RunOS Web 已完成离线依赖安装、typegen、TypeScript、Next standalone 构建及真实浏览器/API/PHP/MariaDB 限定链路验证；RunOS API 已完成原生启动和 CPU 权限回归。当前执行授权及验证范围以 `VALIDATION-RUNBOOK.md`、`MODULES.md` 和仓库外最终验收证据为准。完整 PHP 插件、Agent/LLM/portal、受控跟踪源码和真实训练仍未恢复或未完整验收；本工程不能直接用于生产发布。

当前 Git 基线包含 1,716 个获准来源文件及工程资料，不代表全部生产源码已经恢复。以下限制真实保留，不以空目录、其他版本或占位实现补齐。

## RunOS 跟踪源码

已复制 119 项 `_vendor` 仍位于旧受控路径，不在 Git，也未迁移到新 app 目录。上游 MIT 许可依据存在，但本地修改及声明履行未全部确认；内部复制不等于 Git 入库或外部分发许可。以下 8 项未复制：

- `services/runos-api/app/lmm/tracking/_vendor/_init_backup.txt`：来源链未完全确认。
- `services/runos-api/app/lmm/tracking/_vendor/timm/__init__.py`：自研 timm 替身的上游版本、许可链仍待确认。
- `services/runos-api/app/lmm/tracking/_vendor/timm/data.py`：自研 timm 替身的上游版本、许可链仍待确认。
- `services/runos-api/app/lmm/tracking/_vendor/timm/models/__init__.py`：自研 timm 替身的上游版本、许可链仍待确认。
- `services/runos-api/app/lmm/tracking/_vendor/timm/models/helpers.py`：自研 timm 替身的上游版本、许可链仍待确认。
- `services/runos-api/app/lmm/tracking/_vendor/timm/models/layers.py`：自研 timm 替身的上游版本、许可链仍待确认。
- `services/runos-api/app/lmm/tracking/_vendor/timm/models/registry.py`：自研 timm 替身的上游版本、许可链仍待确认。
- `services/runos-api/app/lmm/tracking/_vendor/timm/models/vision_transformer.py`：自研 timm 替身的上游版本、许可链仍待确认。

不得安装官方 timm 替换这些实现；在许可、完整性和导入路径闭环前，不能声称跟踪功能可构建运行。

## 前端和门户

| 模块 | 已有资料 | 缺口 |
|---|---|---|
| runos-web | package.json、package-lock.json、Next/TypeScript 配置和源码 | 已批准子集构建和限定真实集成已验证；排除内容及全项目生产验证边界仍保留 |
| agent-web | ui、web 包清单、TypeScript 配置和源码子集 | 冻结来源无锁文件，若干受控源码未入库 |
| assistant-web | 4 项静态脚本 | 无独立包清单或构建驱动 |
| llm-center-web | 14 项源码子集 | 无独立包清单/构建驱动及锁文件 |
| workbench-web | 5 项源码子集 | 无独立包清单/构建驱动及锁文件 |
| portal | 来源 7 项均为 dist，未入库 | 匹配生产版本的可编辑源码缺失，不以 dist 或其他版本冒充 |

## 依赖、数据和接口

- PHP 45 包为静态元数据候选；不含 2,517 项 vendor，未执行 Composer，无新生成或经验证的 composer.lock，不保证可复现。
- 账户/业务 SQL、上传、航线、模型权重、图片字体与其他静态素材按原分类排除。LLM 一项安全 DDL 子集不代表完整数据库或备份。
- 146 个受控保留文件继续在原位置；含未决第三方权利、内部资料和秘密候选。疑似秘密不等于确认泄露，也不因此允许修改或删除原件。
- 316 条静态接口候选含动态模板与重复可能，Schema、完整前缀、认证及运行有效性未确认，未导入正式 OpenAPI。
- web 静态引用分析不证明资产闭包完整；1,041 条未解析引用虽已分类，仍存在动态上下文与资料边界，不得据此裁剪生产资产。
- A-10 仅重排路径，未修改 import、配置或业务逻辑。A-11 不修复这些代码；后续适配、安装、构建、启动和部署均须相应授权。

## 后续处理

portal、第三方修改许可、素材与数据归属由源码/业务/权利负责人提供证据；实际模块维护人、资源窗口和隔离环境由项目与运维负责人确认。技术验证可在获批的 A-12 中开展；未获批前保持缺口，不把资料治理结论升级为运行结论。

## 2026-10-23 受控文件恢复（第一批，分支 restore/controlled-batch1-20261023）

经项目权利人授权逐项审查 A-10 retained 清单（146 项）后恢复入库，全部经 SHA-256 与 retained-precommit.json 核对一致：

- SRC-01：Agent Web 的 9 个受控目标已补入现行布局 apps/agent-web/web/（src/lib/strings.ts、strings-en.ts、features/machines/ssh-host-dialog.tsx、features/builtin-browser/address.ts、e2e/layout.spec.mjs、e2e/llm-errors.spec.mjs 及 3 个 test 文件）；提交 bd04a75。SRC-01 余下事项仅剩历史全量测试恢复问题，与受控文件无关。
- SRC-04：agent-platform-source/assistant_service.py、serve.py、README.md 解除保留入库（文件一直在工作树中，此前被 .gitignore 压住）；全文复核未见秘密值；提交 74d7ea1。SRC-04 其余缺口（助手后端 routes/actions/tests）不在本批范围。
- LLM Center：services/llm-center/runtime/control.py 已补入；全文复核仅含 Docker 网桥/回环等架构常量，无秘密值；提交 63bd3c2。
- 旧布局影子副本（apps/agent/、llm-center-source/runtime/control.py）已在核对 SHA 后清除；llm-center-source 下 2 个 DEPLOYMENT.md（待脱敏）与 9 个 verification.json（运行产物，不开源）仍按 .gitignore 保留在工作树外跟踪之外。
- 未处理：runos-backend 的 _vendor/lib 119 项（OSTrack/PyTracking 第三方，许可链见开源整理方案）与自研 timm 替身 8 项、backend 的 Install.php，待权利与许可结论后分批处理。


## 2026-10-23 受控文件恢复（第二批：_vendor 与文档，分支 chore/oss-scaffolding）

经权利人确认按推荐方案执行：

- _vendor（选项 A）：runos-backend 的 lmm/tracking/_vendor 共 126 个文件（OSTrack/PyTracking 的 lib 119 + 自研 timm 替身 8，剔除杂散的 _init_backup.txt）已按现行布局补入 services/runos-api/app/lmm/tracking/_vendor/，与 deploy 逐文件 SHA 一致；目录内含第三方说明 README（上游归属与许可谱系），根目录 NOTICE 同步登记，该目录不适用 RunHive MIT。提交 493c62c。
- DEPLOYMENT.md 两份已脱敏（宿主路径、服务账号标识、密钥文件路径泛化）后补入 services/llm-center 的 runtime/gateway 目录；提交 548838a。同批补入 llm-center-web 缺失的 2 个 svg 资源（navigation.json 引用）。
- LLM 前端差异定性：repo 的 apps/llm-center-web 为 2026-10-15 重建版（领先 deploy 的 10-11 版），非缺口。
- Install.php 不单独入库：属 BuildAdmin/ThinkPHP 框架安装器组件，由上游 Composer 包提供，NOTICE 已作归属说明。
- 仍保留在跟踪之外：9 个 verification.json（运行产物，不开源）。
- 公开导出：已从本分支干净工作树导出新仓库 runhive-public（单一初始提交，无旧历史）；导出时泛化了 control.py、ostrack_service 中的宿主机默认路径，并排除了内部过程文档（HANDOVER、VALIDATION-TODO、ASSET-INVENTORY、VALIDATION-RUNBOOK）与 tools/preview、tools/engineering 的服务器专用脚本。门户可编辑源码（SRC-02）仍缺失，公开版 README 与本登记如实说明。
