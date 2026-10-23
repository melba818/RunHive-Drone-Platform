> 公开版说明：本文为生产部署文档的脱敏版，宿主路径、服务账号标识与密钥文件路径已泛化；环境变量名、端口与挂载语义为默认值示例。

# 双中心运行层交付

生产发布和回滚由 Runhive 发布脚本完成。此目录不能包含平台模型密钥、原生会话令牌或账号测试密钥。

## 控制服务

命令：`python /opt/runtime/control.py`。网络采用 host；用户 `<uid>:<gid>` 加宿主 Docker socket 组 `<docker-gid>`。仅控制服务可挂载 Docker socket。健康检查 `http://127.0.0.1:4021/health`。

环境变量如下（生产目录由发布脚本填入）：

| 名称 | 值 |
| --- | --- |
| LLM_STATE_ROOT | /state |
| LLM_HOST_STATE_ROOT | /srv/runhive/runtime/llm-center |
| LLM_HOST_RUNTIME_SOURCE | 已冻结的生产 runtime 源码绝对路径 |
| LLM_FACTORY_IMAGE | runtime-dual-delivery.json 的 factory_image |
| LLM_AGENT_IMAGE | runtime-dual-delivery.json 的 agent_image |
| LLM_CONTROL_PORT | 4021 |
| LLM_CONTROL_KEY_FILE | /control-key |
| LLM_PROVIDERS_FILE | /providers.json |
| LLM_DOCKER_BRIDGE_IP | 172.17.0.1 |
| LLM_RUNOS_JOBS_ROOT | /runos-status |
| LLM_HOST_BASE_MODELS | /srv/runhive/models |
| LLM_TENANT_UID | <uid>:<gid> |
| LLM_TUNE_ROOT_PATH | /llm-center/tune |
| LLM_TUNE_PORT_START | 40100 |
| LLM_AGENT_PORT_START | 41100 |

挂载：账号状态到 `/state:rw`；此目录到 `/opt/runtime:ro`；原平台 CPU 验证模型目录到 `/models:ro`；平台基础模型目录到 `/base-models:ro`；RunOS 状态元数据到 `/runos-status:ro`；独立私有配置到 `/providers.json:ro`；控制密钥到 `/control-key:ro`。GPU 可用性检测仅申请 NVIDIA `utility` 能力，不加载模型；训练 worker 经调度才申请指定 GPU 的计算能力。

`/internal/instances/ensure` 接收 `{tenant_id,module}`，module 仅为 `tune` 或 `agent`。返回的 instance_key/native_token 均为网关服务端材料，不能发给浏览器。Agent 原生 API 使用网关注入的 Bearer 和实例密钥；所有 SSE/文件/预览同样需要账号会话。

## 数据和模型

保留 v1 `instances/jobs` 表及 `tenants/admin-ID` 原目录。新增 `agent_instances` 表和 `agents/admin-ID/{data,workspace}`，不改变旧任务含义。停止实例保留账号数据；新镜像只在实例重新创建时生效。

Agent 容器只挂自己的 data/workspace 和只读运行源码。使用非 root、runc、空 CUDA_VISIBLE_DEVICES 和 NVIDIA_VISIBLE_DEVICES=void，未申请 GPU；不挂平台 provider 配置或 Docker socket。Shell 和原生 SDK 文件工具都经 Landlock 执行隔离，无法读取账号 data 令牌、父进程环境或其他账号文件；内核不支持时拒绝执行。只读任务不授予工作区写权限。

Agent 模型请求走中央 broker。当前 Qwen 服务未启用原生工具解析器，因此使用严格 JSON schema 兼容适配：验证工具名、参数 schema 和返回值后才产生 tool_call。模型上下文固定 8192，包含工具 schema 和输出余量。已实际完成原生 Agent 创建并读回测试文件。VLX 为已有视觉定位服务，须附图片，不用于通用文本工具任务。不会重启现有推理服务或重复加载模型。

Factory 仍使用真实官方训练/评估/导出流程。CPU 极小模型验收用于证明流程可运行；现有 32B 模型未进行业务微调验证。GPU 训练保留实际资源检测、全局租约和排队；不会为训练自动停止现有推理服务。

## 构建和验收

官方 Agent commit 固定 `d56d9ced7350b45aeb053b2b823574e84660bf4a`。Node 24.18.0、pnpm 11.18.0，使用仓库锁文件。Dockerfile.runhive 构建基础环境，Dockerfile.buildenv 提供编译工具，build-runtime.sh 完成类型检查、构建、测试及仅产物镜像打包。镜像上下文仅为部署 lib/web，不含用户状态与密钥。

最终镜像、源文件 SHA、真实任务报告和测试清理结果统一见 runtime-dual-delivery.json。界面浏览器视觉验收由主任务报告单独说明；运行层不把配置检查冒充视觉验收。
