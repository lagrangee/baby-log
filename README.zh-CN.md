# Baby Log

Baby Log 是一个基于 Cloudflare Workers、Static Assets 和 D1 的单家庭婴儿照护记录工具。它用于快速日常记录、清单和里程碑追踪、家人只读视图、独立的机器可读 JSON 端点，以及完整导出。

[English README](./README.md)

## 范围

Baby Log 帮助家庭观察、记录、汇总，并为问诊准备问题。它不是医疗诊断系统、临床决策支持工具、社交产品、多租户 SaaS，也不是附件或照片管理系统。

内置快捷记录被有意限制为：亲喂、奶瓶、小便、大便、睡眠开始/醒来、体温、用药和备注。二级记录为：症状、趴趴时间和生长测量。

## 功能

- 管理端日常记录，包含快捷按钮和详情表单。
- 家人只读视图，并提供少量辅助记录入口。
- 清单和里程碑追踪。
- 状态、时间线、问诊摘要、生长参考和 machine JSON 端点。
- 完整导出。
- 应用顶部/登录页提供 English/中文切换。

## 架构

- Cloudflare Worker 提供 API。
- Cloudflare Static Assets 提供 React/Vite 前端。
- Cloudflare D1 是唯一事实源。
- 每日摘要由事件表实时派生，不作为独立事实源存储。
- 所有存储时间戳使用 UTC。
- `local_date` 由服务端根据 `app_profile.timezone` 派生。
- machine endpoint 是独立 JSON，不依赖 cookie 登录。

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars
npm run build
npm run d1:migrate:local
ALLOW_DEV_DEFAULT_PASSWORDS=true npm run cf:dev -- --local --port 8787
```

仅当本地设置 `ALLOW_DEV_DEFAULT_PASSWORDS=true` 时，开发默认密码才可用：

- admin: `admin`
- read-only: `read`

生产环境不要启用默认密码。

## Cloudflare 配置

`wrangler.toml` 只能作为可公开提交的模板。Git 中只保留占位 route 和占位 D1 ID。真实域名、D1 ID、token 和密码应放在 ignored 本地文件、生成的部署配置或 Cloudflare 设置中。

创建 D1 数据库：

```bash
npx wrangler d1 create baby_log
```

把返回的 database ID 填入私有部署配置，或在 Cloudflare dashboard 中配置。若使用本地命令行部署，真实值应放入 ignored 文件，例如 `wrangler.local.toml` 或 `wrangler.prod.toml`。

生产运行时变量和 secret 应在 Worker 设置中配置，不要写入 Git：

- `ADMIN_PASSWORD`
- `READ_PASSWORD`
- `SESSION_SECRET`
- `BABY_LOG_MACHINE_BASE_URL`
- `BABY_LOG_MACHINE_TOKEN`

可选的本地自动化变量：

- `BABY_LOG_CHATGPT_SOURCE_DIR`

执行 D1 migration：

```bash
npm run d1:migrate:local
npm run d1:migrate:remote
```

使用被 Git 忽略的本地 Wrangler 配置部署：

```bash
cp wrangler.toml wrangler.local.toml
# 在 wrangler.local.toml 中填入真实 Worker route 和 D1 database ID。
npm run cf:deploy:local
```

使用生成的 Wrangler 配置部署：

```bash
cp .env.example .env
# 在 .env 中填入真实 Worker route 和 D1 database ID。
npm run cf:deploy
```

Cloudflare Workers Builds 连接 GitHub 时可使用：

- build command: `npm run build`
- deploy command: `npm run cf:deploy`
- production branch: `main`
- required build variables/secrets: `BABY_LOG_WORKER_NAME`, `BABY_LOG_ROUTE_PATTERN`, `BABY_LOG_D1_DATABASE_NAME`, `BABY_LOG_D1_DATABASE_ID`

生成的部署配置默认使用 `keep_vars = true`，这样 Wrangler deploy 不会覆盖 dashboard 中维护的运行时变量。

如果是把已有 Worker 接到这个新仓库，Cloudflare 里的 Worker name 必须和 `BABY_LOG_WORKER_NAME` 一致。要把旧 Git repo 平移到 `lagrangee/baby-log`，先断开旧 build integration，再把这个 Worker 重新连接到新 repo，最后推一个小 commit 确认 build。

生产 D1 migration 需要明确执行，不要默认认为 Git push 已迁移远端数据库。

## Public Repo Hygiene

推送到 public repo 前：

- 不要提交 `.dev.vars`、`.env`、真实 `wrangler.*.toml`、导出文件、review zip、SQLite 文件和规划文档。
- 只提交占位 Cloudflare route 和 D1 ID。
- 对干净的新仓库运行 secret scan。
- 家庭事实、导出记录、machine token、D1 ID、真实域名都按私密信息处理。

## Scripts

```bash
npm test
npm run build
npm run chatgpt:export
npm run review:zip
```

## License

当前尚未声明 license。若要开放给更广泛的外部复用，请先补充 license。
