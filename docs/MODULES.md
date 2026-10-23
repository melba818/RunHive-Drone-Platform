# 模块维护说明

本文件仅说明已批准源码子集，不授予受控文件、客户资产或生产系统的访问权限。

| 模块 | 源码与入口 | 可执行范围和边界 |
|---|---|---|
| RunOS Web | `apps/runos-web`；Next standalone `server.js` | 使用现有 package-lock；Node 22.23.3，Next 16.2.0；执行 `tools/engineering/build-web.cjs`。浏览器测试只连接测试容器的 127.0.0.1:3000 |
| RunOS API | `services/runos-api/app`；`main:app` | Python 3.12.15，CPU 验证需求见 `requirements.validation.txt`；测试入口 `worker_entry.py` 禁止应用执行子进程及非回环连接，不进行训练或推理 |
| PHP/SSO | `services/php/app/api/controller/Runos.php` | `php-http.php` 使用真实 ThinkPHP 8.1.1、原始 Api/BaseController、ThinkORM 与合成 MariaDB。它是限定入口测试应用，不是全插件业务系统；不能替代生产入口或原 Composer lock |
| Agent Web | `apps/agent-web/ui`、`web` | 保留源码和已有测试；匹配的根 TS 配置、完整依赖锁及部分导入目标未恢复，不给出未经验证的完整启动命令 |
| Agent 平台 | `services/agent-platform` | 已批准 Python/路由契约子集；`assistant_service`、`serve` 等受控源不在 Git，不能用替代服务宣称完整恢复 |
| LLM 中心 | `services/llm-center/gateway`、`runtime`、`php` | 现有源码保持；运行入口、模型及远程节点依赖尚未全部获准，不在本验证集合启动真实模型服务 |
| 门户及其他前端 | `web/index.html`、其余 `apps/*` | portal 匹配的可编辑源码缺失；不把 dist、静态入口或其他版本视为完整源码 |

## 依赖与配置

Python CPU 验证集合不含 Torch、Ultralytics、生产权重和受控 `_vendor`。不要以安装官方 timm 取代自研实现。原训练需求保留，不能使用 CPU 验证集合覆盖它。

PHP 45 包仍为历史候选元数据。新验证集合仅锁定实际使用的公开框架包、扩展和运行库；保留许可来源及精确引用，不导入生产 vendor。

验证环境变量模板位于 `deploy/env/validation.env.example`。配置只在合成环境使用；真实数据库、API、SSO、Redis、GPU 和远程节点均不作为测试输入。

## 协作

从最终收尾分支开展独立开发；使用小范围提交，提交前检查 `git diff --cached` 和准入 CI。禁止 `git add .`、清理受控文件或将旧路径 146 项材料重新入库。原 main、阶段提交及既有缺口证据保留。

任何构建或部署变更都必须关联固定 Git tree、源码 SHA-256、运行时公开依赖摘要和实际测试日志。仅生成方案、静态检查通过或组件通过，均不等于生产发布验收。
