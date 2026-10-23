# 运行层最终验收

Agent 官方源码固定 commit：`d56d9ced7350b45aeb053b2b823574e84660bf4a`。

最终 Agent 镜像：`sha256:dff4d8c48ef3e4a43e950f0b2094332921f8295bc16e1fce7d649f4b87071e07`。

Factory 镜像：`sha256:63d9ec6c16733580fcf48dfe1c0709995f4b7f800ba0bae103abc3737e20a7d9`，新界面源以只读挂载发布。

## 实际结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| core/server/web 类型检查 | 通过 | agent-release-typecheck.log；最后两个界面修改另通过 agent-final-checks.log |
| CLI/server/core 与 Web 生产构建 | 通过 | agent-release-build.log；最终 Web 重新构建见 agent-final-checks.log |
| Web 安全与中文展示测试 | 7/7 通过 | agent-final-checks.log 的真实 Node 测试段 |
| 原生服务端护栏 | 7/7 通过 | agent-final-server-tests.log，Vitest |
| 上传、身份、请求体、SSE EOF、GPU 调度和崩溃接管 | 25/25 通过 | runtime-python-tests-final.log |
| 原生 Agent 文件任务 | 通过 | agent-native-file-verification.json；最终镜像新账号默认项目产生自动临时工作目录 |
| 原生 SDK 文件工具隔离/只读 | 10/10 通过 | agent-sdk-sandbox-verification.json；agent-sdk-sandbox-final.log |
| Landlock shell/Node 和不支持内核时拒绝执行 | 8/8 通过 | sandbox-fixture/workspace/sandbox-verification.json |
| Agent 未加载 GPU | 通过 | agent-final-container-verification.json |
| VLX 中央 broker 视觉协议 | HTTP 200 | agent-vlx-broker-verification.json，合成红色方块，未重载模型 |
| Factory 原生界面 CPU 微调 | 通过 | factory-ui-train-verification.log；实际 3 步训练完成并返回损失图 |

最终原生文件任务会话 `session-2026-10-07-16-39-23-b783febf`，实际 `write_file`、`read_file` 及对应工具结果均为 completed，文件内容为“Runhive Agent 验收通过”，会话回到 idle。测试采用用户隔离工作区，未执行生产工具任务。

最终 Agent 容器检查：runc、1011:1011、CapDrop ALL、只读根文件系统；挂载仅本账号 `/data`、`/workspace` 与只读 `/opt/runtime`；DeviceRequests/Devices 为空；CUDA_VISIBLE_DEVICES 为空，NVIDIA_VISIBLE_DEVICES=void，容器 `/dev/nvidia*` 为空。

原生 SDK read_file 读取 `/data/api-token` 及指向令牌的工作区符号链接均被拒绝；读取 proc 的虚拟零大小文件只返回无内容的通用结果，未读到父进程环境。另通过实际 shell 验证 proc 环境读取被内核拒绝。只读任务仍可读自身工作区但不能写入。测试不打印任何认证材料。

## 实际限制

当前既有 Qwen vLLM 服务未启用原生 tool-call parser。Agent 使用经真实验证的严格 JSON schema 兼容适配，校验后才允许工具调用，不把普通聊天成功当作原生工具支持。上下文为 8192；单次调用返回完模型决定后才向原生客户端输出 SSE。用户取消停止后续工具执行，已发送的有界模型请求可能仍会完成。

VLX 用于附图的视觉定位；此次合成图测试证明连接协议，不作为业务模型效果评估。CPU 小模型微调证明 Factory 原生流程可运行，未声称 32B 业务模型完成微调。GPU 训练不自动卸载既有推理服务。

此报告只记录运行层验证。整页浏览器视觉验收没有由运行层执行；统一登录、双账号隔离、短期预览资源与实际浏览器证据由认证模块另行报告。最终交付 JSON 在测试控制服务释放后记录清理状态。
