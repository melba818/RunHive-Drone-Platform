# 静态环境变量索引

仅保存获准源码中的变量名、引用位置与读取形式，不保存默认值、连接地址、密码或 Token。Python 使用与当前源码 SHA-256 绑定的本地镜像 AST 提取字面量读取，排除赋值和动态名称前缀；其他形式使用按语言过滤的静态文本匹配。静态匹配不证明可达性、完整加载链或配置必填性；注释、条件分支和不可达代码仍可能出现引用。行号对应未修改的 A-10 源码。

模板中的作用说明保守保留，不能由变量名推断完整配置契约。重复名称可能属于不同服务，严禁跨服务自动共享。

| 变量 | 所属模块 | 作用说明 | 是否必须 | 敏感性 | 配置读取来源 |
|---|---|---|---|---|---|
| `BACKEND_URL` | runos-web | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `apps/runos-web/app/api/runos-auth/exchange/route.ts:6` (node-process); `apps/runos-web/app/api/runos-auth/identity/route.ts:6` (node-process); `apps/runos-web/app/api/runos-auth/session/route.ts:7` (node-process); `apps/runos-web/lib/tenant-backend.ts:5` (node-process) |
| `LLM_AGENT_IMAGE` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/agent_runtime.py:51` (python-getenv) |
| `LLM_AGENT_PORT_START` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/agent_runtime.py:62` (python-getenv) |
| `LLM_BIND_ADDRESSES` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/gateway/serve.py:11` (python-environ-get) |
| `LLM_CONTROL_PORT` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/agent_runtime.py:31` (python-getenv); `services/llm-center/runtime/agent_runtime.py:73` (python-getenv) |
| `LLM_CONTROL_URL` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/ui.py:27` (python-environ-read) |
| `LLM_COOKIE_SECURE` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 是，按敏感项管理 | `services/llm-center/gateway/app.py:69` (python-getenv); `services/llm-center/gateway/test_v1_app.py:53` (python-getenv) |
| `LLM_GATEWAY_PORT` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/gateway/serve.py:12` (python-environ-get) |
| `LLM_HOST_RUNTIME_SOURCE` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/agent_runtime.py:90` (python-environ-read) |
| `LLM_INSTANCE_KEY` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 是，按敏感项管理 | `services/llm-center/runtime/ui.py:26` (python-environ-read); `services/llm-center/runtime/verify_gradio_train.py:10` (python-environ-read) |
| `LLM_INTERNAL_KEY_FILE` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 是，按敏感项管理 | `services/llm-center/gateway/app.py:66` (python-getenv); `services/llm-center/gateway/test_v1_app.py:50` (python-getenv) |
| `LLM_INTERNAL_SECRET_FILE` | llm-center, php | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 是，按敏感项管理 | `services/php/app/common/library/LlmcenterSession.php:31` (php-getenv); `services/llm-center/php/app/common/library/LlmcenterSession.php:31` (php-getenv) |
| `LLM_PHP_URL` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/gateway/app.py:64` (python-getenv); `services/llm-center/gateway/test_v1_app.py:48` (python-getenv) |
| `LLM_ROOT_PATH` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/ui.py:644` (python-getenv) |
| `LLM_RUNTIME_KEY_FILE` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 是，按敏感项管理 | `services/llm-center/gateway/app.py:67` (python-getenv); `services/llm-center/gateway/test_v1_app.py:51` (python-getenv) |
| `LLM_RUNTIME_URL` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/gateway/app.py:65` (python-getenv); `services/llm-center/gateway/test_v1_app.py:49` (python-getenv) |
| `LLM_SANDBOX_FORCE_UNAVAILABLE` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/agent_sandbox.py:34` (python-getenv) |
| `LLM_SESSION_DB` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/gateway/app.py:68` (python-getenv); `services/llm-center/gateway/test_v1_app.py:52` (python-getenv) |
| `LLM_TENANT_ID` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/ui.py:25` (python-environ-read) |
| `LLM_TENANT_UID` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/agent_runtime.py:76` (python-getenv) |
| `LLM_TEST_STAGE` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/verify_native_agent.py:9` (python-environ-read) |
| `LLM_UI_PORT` | llm-center | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/ui.py:647` (python-getenv) |
| `LMM_EVIDENCE_FORMAT` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/lmm/render.py:42` (python-environ-get) |
| `NEXT_PUBLIC_API_URL` | runos-web | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `apps/runos-web/components/lmm-view.tsx:42` (node-process); `apps/runos-web/components/vlm-view.tsx:23` (node-process) |
| `NEXT_PUBLIC_RUNHIVE_URL` | runos-web | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `apps/runos-web/components/runhive-auth-gate.tsx:14` (node-process); `apps/runos-web/components/runhive-auth-gate.tsx:121` (node-process) |
| `NEXUSHIVE_API_URL` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/core/nexushive.py:35` (python-environ-get) |
| `OSTRACK_CKPT` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/services/ostrack_service/server.py:61` (python-environ-get) |
| `OSTRACK_HOST` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/services/ostrack_service/server.py:58` (python-environ-get) |
| `OSTRACK_KEEPALIVE_S` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/services/ostrack_service/server.py:66` (python-environ-get) |
| `OSTRACK_MAX_BODY_MB` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/services/ostrack_service/server.py:64` (python-environ-get) |
| `OSTRACK_PORT` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/services/ostrack_service/server.py:59` (python-environ-get) |
| `OSTRACK_TOKEN_FILE` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 是，按敏感项管理 | `services/runos-api/app/services/ostrack_service/server.py:60` (python-environ-get) |
| `RUNOS_ALLOW_CROSS_TENANT_EXCHANGE` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/routers/nexushive_auth.py:29` (python-environ-get) |
| `RUNOS_DATA_ROOT` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/config/settings.py:27` (python-environ-get); `services/runos-api/app/config/settings.py:21` (python-environ-get) |
| `RUNOS_FRONTEND_ORIGIN` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/main.py:80` (python-environ-get) |
| `RUNOS_LAN_HOSTS` | php | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/php/app/admin/controller/Appcenter.php:65` (php-getenv) |
| `RUNOS_LAN_PORT` | php | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/php/app/admin/controller/Appcenter.php:67` (php-getenv) |
| `RUNOS_OWNER_ADMIN_ID` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/main.py:100` (python-environ-get); `services/runos-api/app/routers/health.py:14` (python-environ-get); `services/runos-api/app/routers/lmm.py:1072` (python-environ-get); `services/runos-api/app/routers/nexushive_auth.py:30` (python-environ-get) |
| `RUNOS_PLATFORM_CONFIG_ADMIN_ID` | php, runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/php/app/common/library/RunosWorkspace.php:25` (php-getenv); `services/php/app/common/library/RunosWorkspace.php:86` (php-getenv); `services/runos-api/app/config/settings.py:23` (python-environ-get) |
| `RUNOS_PRESERVE_TEMP` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/core/startup.py:115` (python-environ-get) |
| `RUNOS_PROJECT_ROOT` | runos-web | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `apps/runos-web/lib/tenant-backend.ts:71` (node-process) |
| `RUNOS_SHARED_CONFIG_ROOT` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/config/settings.py:24` (python-environ-get) |
| `RUNOS_SKIP_RUNTIME_INSTALL` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/main.py:41` (python-environ-get) |
| `RUNOS_WRITE_DATASET_METADATA` | runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/runos-api/app/core/workspace.py:59` (python-environ-get) |
| `VLX_SEEK_BASE_URL` | llm-center, runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/vlx_client.py:169` (python-environ-get); `services/runos-api/app/lmm/vlx_client.py:169` (python-environ-get) |
| `VLX_SEEK_MAX_NEW_TOKENS` | llm-center, runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 是，按敏感项管理 | `services/llm-center/runtime/vlx_client.py:180` (python-environ-get); `services/runos-api/app/lmm/vlx_client.py:180` (python-environ-get) |
| `VLX_SEEK_NODE` | llm-center, runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/vlx_client.py:167` (python-environ-get); `services/runos-api/app/lmm/vlx_client.py:167` (python-environ-get) |
| `VLX_SEEK_TOKEN` | llm-center, runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 是，按敏感项管理 | `services/llm-center/runtime/vlx_client.py:171` (python-environ-get); `services/runos-api/app/lmm/vlx_client.py:171` (python-environ-get) |
| `VLX_SEEK_TRANSPORT` | llm-center, runos-api | 静态配置引用；具体业务语义待服务负责人确认 | 待确认 | 待确认，不填生产值 | `services/llm-center/runtime/vlx_client.py:165` (python-environ-get); `services/runos-api/app/lmm/vlx_client.py:165` (python-environ-get) |

共 49 个去重名称，74 处静态引用。排除测试路径及系统/框架管理名称的引用 71 处；未覆盖动态变量名、别名、配置文件读取、自定义加载器及 PHP 点号键到环境变量的映射。
