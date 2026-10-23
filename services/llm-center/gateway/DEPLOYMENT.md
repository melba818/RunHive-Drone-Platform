> 公开版说明：本文为生产部署文档的脱敏版，宿主路径、服务账号标识与密钥文件路径已泛化；环境变量名、端口与挂载语义为默认值示例。

# 双中心认证网关

入口 `/llm-center/tune/`、`/llm-center/agent/`。PHP launch 白名单 module=tune|agent，客户端 tenant/admin_id/header 不作为授权依据。audience 与 AES-GCM AAD 为 runhive-tune/runhive-agent；复用 nz_llmcenter_sso_ticket 表，不变更旧表结构。60 秒单次票据，父 Runhive Token 每请求复核。

镜像 runhive-dual-gateway:20261007。测试 gateway4024/controller4025/PHP4034；生产配置由发布者决定。独立 Python 依赖，不修改 RunOS 运行环境。

环境：LLM_BIND_ADDRESSES=127.0.0.1,172.17.0.1；LLM_GATEWAY_PORT=4020；LLM_PHP_URL=http://127.0.0.1:1819；LLM_RUNTIME_URL=http://127.0.0.1:4021；LLM_INTERNAL_KEY_FILE=/secrets/<internal-key-file>；LLM_RUNTIME_KEY_FILE=/secrets/<runtime-key-file>；LLM_SESSION_DB=/state/dual-sessions.sqlite3；HTTP环境 LLM_COOKIE_SECURE=0。

UID <service-uid> hostnetwork，只绑定显式loopback+Docker bridge；nginx同源转发，SSE不缓冲并传递Upgrade/Origin/原Host。两个secret只读挂载，state属于<uid>；PHP internal secret <uid>:<php-gid>/0640，control secret <uid>:<gid>/0600。

Opaque模块cookie各自限定路径，HttpOnly/SameSite=Strict；同账号进另一中心保留原中心会话。browser-group cookie只含随机ID，任一模块切换账号即服务器撤销组内所有旧账号SID；模块退出只撤本模块。父账号退出/停用在下一请求失效，持续SSE/WS每15秒复核。

ensure {tenant_id,module} 返回 {tenant_id,module,base_url,instance_key,state:'ready',native_token?}。tune40100—40999，agent41100—41999，loopback及模块匹配；native_token仅服务器注入Authorization，浏览器私钥/tenant/auth headers剥除重建，下游Set-Cookie不透传。

可信bootstrap读fragment立即清ticket，POST同模块exchange，等真正instancehealth才通知ready(admin_id/module)，导航/ui/?section=白名单。nativeadapter以同模块auth/me验证身份后接收sectionchange。调参文件仅exports/cache-gradio；智能体原生文件API realpath限定/workspace，旧session/symlink也复核。server与gateway同时阻断原生auth/claim/admin/HMR/安装/机器配对/终端危险管理；本机nativeCLI亦不可绕过。工具子进程强制Landlock，不可由usersettings关闭，nativeAPI_TOKEN不进入工具环境。

生成HTML/SVG/workflow使用CSP sandbox且无allow-same-origin，代理保留该CSP；可信工作台正常同源。业务workflow handler收不到private instance/auth headers。所有用户错误中文。

应用预览由已登录工作台 POST agent/auth/preview {source,renew_url?} 签发120秒只读cap。入口限独立应用目录HTML或workflow ui，HTML/JS/CSS/JSON等资源通过preview/<cap>/<asset>加载，无需第三方Cookie；cap只关联当前SID及固定目录，各资源再次复核parent Token，切账号/退出即失效。续期仅同SID同source，90秒续同URL，关闭后不续。文件realpath复核固定应用目录，symlink不能扩宽；cap页面CSP opaque、CORS仅null，无native或Hive凭据、无写接口。nginx该路径禁accesslog或记录脱敏模块/状态，不能记录cap。动态业务API不由静态cap授权。

v2使用独立dual-sessions.sqlite3；即使共享文件亦只新增dual_sessions/browser_groups/preview_caps三个表，旧v1 sessions五列不变。旧v1原类在v2新增表后create/get已真实验证，默认回滚仅换源码与镜像，保留后续用户工作区与数据。

已验证30项ASGI网关、23项真实PHP/MariaDB模块票据；native server新增7项runhive-guard.test.ts由统一原生build验证。真实双模块fixture入口为php/test_dual_integration.py。fixture只独立DB，结束清理容器/匿名数据库卷/密钥/环境文件/私有SQLite，生产数据与原账号未修改。
