# 接口契约资料索引

此目录目前只有说明，没有已获准的正式 OpenAPI 文件。本轮没有将静态候选 JSON 改名或转换为正式规范，也没有填写推测的参数、请求或响应 Schema。

| 服务 | 静态候选记录 | 证据文件（仓库外 finish 归档） | SHA-256 |
|---|---|---|---|
| RunOS API | 242 个原字面量候选 | runos-api-api-candidates-final.json | afc1307f42508de2a2a274862cba482ad8376f5e8213a8252d9fd362241bab79 |
| Agent 平台 | 3 个原候选 + 53 个补充（8 个静态、45 个符号化） | agent-platform-api-candidates-final.json | 60aa77cbe8875c3b39649ca8374f7f499a1520fbc545184f431f8a96a7728436 |
| LLM 网关 | 18 个静态补充候选 | llm-center-gateway-api-candidates-final.json | 95c1199faffb60c19a74f256bda9694ced0f2c97193d4695c0bc0ae475750068 |

总计 316 条候选记录，不是 316 个唯一、可达、已验证接口。证据位于工作区 `archive/baselines/finish-20261015T142103/`，继续留在 Git 外。

原来源路径映射：runos-backend → services/runos-api/app；agent-platform-source → services/agent-platform；llm-center-source/gateway → services/llm-center/gateway。部分 Agent 源码未入库，应对每条候选继续区分已跟踪与受控来源。

后续正式契约准入需要：定位当前获准源码及 blob；确认注册路径、router 前缀、方法、动态展开、唯一性、身份/租户边界；取得可验证的请求和响应定义；通过独立格式及语义检查；记录来源 SHA-256、审核人与未覆盖范围。

必要的运行验证仅在 A-12 获批的隔离环境，使用 Mock/离线依赖开展；不得导入生产 FastAPI 应用或调用生产接口来补齐资料。尚未验证的候选继续在仓库外，不影响本轮资料建设提交。
