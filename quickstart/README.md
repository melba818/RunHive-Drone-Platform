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
- Not included: the RunOS, LLM-center and Agent-center services. Those are separate deployables documented under `docs/` and each module's README.
- 包含：门户（以构建产物形式提供，见 `docs/SOURCE-GAPS.md`）、PHP 业务后端、MariaDB 与 Redis，附菜单、权限规则与演示数据种子。
- 不包含：RunOS、大模型中心、Agent 中心等独立服务，它们的部署方式见 `docs/` 与各模块 README。

## Demo values — change before any real use / 演示值说明

`backend.env`, the database credentials in `docker-compose.yml`, and the files in `runtime/` contain throwaway demo-only values so the stack starts with zero configuration. **Never reuse them outside this local demo** — generate your own secrets for a real deployment.

`backend.env`、`docker-compose.yml` 中的数据库口令与 `runtime/` 内的文件均为一次性的演示值，只为零配置启动。**切勿用于真实部署**，正式环境请自行生成。
