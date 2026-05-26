# 部署 — Cloud Run

将 Next.js 应用部署至 Google Cloud Run，作为公开服务读取一个 GCS bucket。通过 Workload Identity 认证，无需写入密钥文件。

## 占位符约定

本仓库公开，所有 GCP 标识符在文档与 CI workflow 中均以占位符出现，运维者执行命令时按下表替换为真实值（敏感值统一通过 [GitHub Repository Variables](https://docs.github.com/en/actions/learn-github-actions/variables) 注入到 CI，本地手动操作时直接 export 为环境变量）。

| 占位符 | 含义 | 在 CI 中对应的 Repository Variable |
| --- | --- | --- |
| `<GCP_PROJECT>` | GCP 项目 ID | `GCP_PROJECT` |
| `<PROJECT_NUMBER>` | GCP 项目编号（纯数字） | `PROJECT_NUMBER` |
| `<REGION>` | Cloud Run / Cloud Scheduler 所在区域 | `REGION` |
| `<SERVICE>` | Cloud Run 服务名 | `SERVICE` |
| `<BUCKET>` | 存放 case JSON 的 GCS bucket | `GCS_BUCKET` |
| `<CLOUD_RUN_URL>` | Cloud Run 服务根 URL（含 `https://`） | `REBUILD_AUDIENCE` |
| `<RUNTIME_SA>` | Cloud Run 运行时 SA 邮箱 | `RUNTIME_SA` |
| `<DEPLOY_SA>` | 部署 SA 邮箱（GitHub Actions 使用） | `DEPLOY_SA` |
| `<SCHEDULER_SA>` | Cloud Scheduler 调用 SA 邮箱 | `SCHEDULER_SA` |
| `<WIF_PROVIDER>` | Workload Identity Provider 资源全名 | `WIF_PROVIDER` |
| `<OPERATOR_EMAIL>` | 个人 Google 账号（仅手动部署可选用） | （不入库） |
| `<REPO>` | GitHub `owner/name`（限制 OIDC token 用） | （不入库） |

本机调试时可将上述值放入 shell 环境，例如：

```bash
export GCP_PROJECT=...
export REGION=us-central1
export SERVICE=...
export BUCKET=...
# 以下两个等服务部署完成后再 export
export CLOUD_RUN_URL=$(gcloud run services describe "$SERVICE" \
  --region="$REGION" --project="$GCP_PROJECT" --format='value(status.url)')
```

## 前提条件

- `gcloud` 已认证为 `<GCP_PROJECT>` 项目的 owner / editor
  （验证：`gcloud config get-value project` 和 `gcloud auth list`）
- 以下 API 已在项目中启用：
  - `run.googleapis.com`
  - `cloudbuild.googleapis.com`
  - `artifactregistry.googleapis.com`
  - `cloudscheduler.googleapis.com`（用于"缓存索引"章节的定时重建）
- 工作目录为仓库根目录

## 部署参数

| 项目 | 值 |
| --- | --- |
| GCP 项目 | `<GCP_PROJECT>` |
| Cloud Run 服务名 | `<SERVICE>` |
| 区域 | `<REGION>`（bucket 与服务同大陆以减少出站费用） |
| 运行时 SA | `<RUNTIME_SA>` |
| 运行时 SA 权限 | bucket 上的 `roles/storage.objectViewer`，以及 `_indexes/` 前缀上的 `roles/storage.objectCreator`（条件限定，见缓存索引章节） |
| 部署 SA | `<DEPLOY_SA>` |
| 部署 SA 权限 | `roles/run.admin`、`roles/cloudbuild.builds.editor`、`roles/iam.serviceAccountUser`、`roles/artifactregistry.writer`、`roles/storage.admin` |
| 访问控制 | 公开（`--allow-unauthenticated`），内容为非敏感 TPU CI 指标 |
| 资源配置 | 1 vCPU / 512 Mi / 最大 3 实例 / 支持缩容至零 |
| 环境变量 | `GCS_BUCKET=<BUCKET>`、`SCHEDULER_SA_EMAIL=<SCHEDULER_SA>`、`REBUILD_AUDIENCE=<CLOUD_RUN_URL>` |

## 一次性初始设置

以下命令均可安全重复执行。先 `export` 上文的占位符变量。

### 1. 创建运行时服务账号

```bash
gcloud iam service-accounts create "${RUNTIME_SA%@*}" \
  --project="$GCP_PROJECT" \
  --display-name="$SERVICE Cloud Run runtime"
```

### 2. 授予 SA 对 bucket 的读取权限

```bash
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/storage.objectViewer"
```

### 3. 创建部署服务账号

部署 SA 仅供 GitHub Actions CI/CD 使用，与运行时 SA 分离以遵循最小权限原则。

```bash
gcloud iam service-accounts create "${DEPLOY_SA%@*}" \
  --project="$GCP_PROJECT" \
  --display-name="$SERVICE GitHub Actions deployer"
```

### 4. 授予部署 SA 所需权限

```bash
for role in roles/run.admin roles/cloudbuild.builds.editor \
            roles/iam.serviceAccountUser roles/artifactregistry.writer \
            roles/storage.admin; do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
    --member="serviceAccount:$DEPLOY_SA" \
    --role="$role" --condition=None
done
```

### 5. 配置 Workload Identity Federation

创建 WIF Pool、OIDC Provider，并绑定到部署 SA：

```bash
gcloud iam workload-identity-pools create github-actions \
  --location=global --project="$GCP_PROJECT"

gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --workload-identity-pool=github-actions \
  --location=global --project="$GCP_PROJECT" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='<REPO>'"

gcloud iam service-accounts add-iam-policy-binding \
  "$DEPLOY_SA" \
  --project="$GCP_PROJECT" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/attribute.repository/<REPO>"
```

### 6. （可选）允许个人账号手动部署

仅在需要 `gcloud run deploy` 手动部署时执行。

```bash
gcloud iam service-accounts add-iam-policy-binding \
  "$RUNTIME_SA" \
  --member="user:<OPERATOR_EMAIL>" \
  --role="roles/iam.serviceAccountUser" \
  --project="$GCP_PROJECT"
```

### 验证设置

```bash
gcloud iam service-accounts describe "$RUNTIME_SA" \
  --project="$GCP_PROJECT" --format='value(email,disabled)'
```

预期输出：显示邮箱，`disabled=False`。

```bash
gcloud storage buckets get-iam-policy "gs://$BUCKET" \
  --format=json | grep -A1 "${RUNTIME_SA%@*}"
```

预期输出：显示 `roles/storage.objectViewer` 的绑定。

## 缓存索引：Cloud Scheduler + 写权限

Dashboard 用 `gs://<BUCKET>/_indexes/YYYY-MM-DD.json` 作为按天聚合的 summary 缓存——读路径变成"先读索引、缺失则懒生成并写回"，时序图也复用这层缓存。今天的索引由 Cloud Scheduler 每 10 分钟主动重建，历史天的索引一旦生成即不可变。

### 1. 给 runtime SA 加索引写权限（条件限定到 `_indexes/` 前缀）

```bash
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/storage.objectCreator" \
  --condition="expression=resource.name.startsWith(\"projects/_/buckets/$BUCKET/objects/_indexes/\"),title=indexes_only,description=Limit writes to the dashboard cache prefix"
```

最坏情况下 runtime SA 也只能写入 `_indexes/` 前缀，原始 case 数据零写权限。

### 2. 创建 Scheduler 专用 SA，仅授予 Cloud Run invoker

```bash
gcloud iam service-accounts create "${SCHEDULER_SA%@*}" \
  --project="$GCP_PROJECT" \
  --display-name="$SERVICE Cloud Scheduler caller"

gcloud run services add-iam-policy-binding "$SERVICE" \
  --region="$REGION" --project="$GCP_PROJECT" \
  --member="serviceAccount:$SCHEDULER_SA" \
  --role="roles/run.invoker"
```

这个 SA 不碰 GCS、不碰 Cloud Run 管理面，唯一能力就是以 OIDC 身份调用 `/api/rebuild-today`。

### 3. 创建 Cloud Scheduler job（每 10 分钟）

```bash
gcloud scheduler jobs create http "${SERVICE}-rebuild-today" \
  --location="$REGION" --project="$GCP_PROJECT" \
  --schedule="*/10 * * * *" --time-zone=UTC \
  --http-method=POST --uri="${CLOUD_RUN_URL}/api/rebuild-today" \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --oidc-token-audience="$CLOUD_RUN_URL"
```

更新 cadence 时用 `gcloud scheduler jobs update http`；要临时停掉重建用 `gcloud scheduler jobs pause`。

### 4. Cloud Run 环境变量

部署时必须同时设置：

- `SCHEDULER_SA_EMAIL` —— `/api/rebuild-today` 校验 OIDC token 的 `email` claim 必须等于此值
- `REBUILD_AUDIENCE` —— OIDC token 的 `aud` 必须等于此值（即 Cloud Run 服务的根 URL）

两者由 CI 通过 Repository Variables（`SCHEDULER_SA` / `REBUILD_AUDIENCE`）注入；手动部署示例见 [手动部署](#手动部署) 章节。

### 验证

```bash
gcloud scheduler jobs run "${SERVICE}-rebuild-today" \
  --location="$REGION" --project="$GCP_PROJECT"

gcloud storage ls "gs://$BUCKET/_indexes/"
```

预期：`_indexes/<today>.json` 存在；之后查看 Cloud Run logs 应看到 200 响应而非 401/403。

## CI/CD

通过 GitHub Actions 自动部署，使用 Workload Identity Federation (WIF) 认证到 GCP，无需存储密钥。所有 GCP 标识符通过 [GitHub Actions Repository Variables](https://docs.github.com/en/actions/learn-github-actions/variables) 注入，**不硬编码在 workflow 文件中**。

| 触发 | 工作流 | 行为 |
| --- | --- | --- |
| Push to main | `deploy.yml` | 运行 CI 检查后部署到生产（100% 流量） |
| PR opened/updated | `preview.yml` | 运行 CI 检查后部署为 tagged revision（0% 流量），在 PR 评论中贴预览链接 |
| PR closed | `cleanup.yml` | 移除对应的 revision tag |

PR 预览 URL 形如：`https://pr-{number}---<SERVICE>-<PROJECT_NUMBER>.<REGION>.run.app`

### Repository Variables 总表

| 名称 | 用途 |
| --- | --- |
| `GCP_PROJECT` | 项目 ID |
| `PROJECT_NUMBER` | 项目编号（仅 WIF 设置阶段需要） |
| `REGION` | Cloud Run / Scheduler 区域 |
| `SERVICE` | Cloud Run 服务名 |
| `GCS_BUCKET` | 存放 case JSON 的 bucket |
| `RUNTIME_SA` | 运行时 SA 邮箱 |
| `DEPLOY_SA` | 部署 SA 邮箱 |
| `SCHEDULER_SA` | Cloud Scheduler SA 邮箱 |
| `WIF_PROVIDER` | Workload Identity Provider 资源全名 |
| `REBUILD_AUDIENCE` | Cloud Run 服务根 URL（OIDC `aud`） |

新增（或重命名）变量后，触发一次 `deploy.yml` 才能让运行时拿到新值。

## 手动部署

日常部署由 GitHub Actions 自动处理（推送到 `main` 即触发）。如需手动部署：

```bash
export CLOUD_RUN_URL=$(gcloud run services describe "$SERVICE" \
  --region="$REGION" --project="$GCP_PROJECT" --format='value(status.url)')

gcloud run deploy "$SERVICE" \
  --source=. \
  --region="$REGION" \
  --project="$GCP_PROJECT" \
  --service-account="$RUNTIME_SA" \
  --allow-unauthenticated \
  --set-env-vars="GCS_BUCKET=$BUCKET,SCHEDULER_SA_EMAIL=$SCHEDULER_SA,REBUILD_AUDIENCE=$CLOUD_RUN_URL" \
  --cpu=1 --memory=512Mi --max-instances=3 --min-instances=0
```

> `REBUILD_AUDIENCE` 必须等于 Cloud Scheduler `--oidc-token-audience` 的值；两边都从 `gcloud run services describe ... status.url` 取，自动保证一致。

首次部署耗时 5-8 分钟，后续约 2-3 分钟（依赖缓存生效）。

## 故障排查

| 症状 | 原因 | 解决方法 |
| --- | --- | --- |
| `/api/cases` 返回 503 "Run gcloud auth..." | 运行时 SA 无 bucket 读取权限 | 重新执行初始设置步骤 2 |
| 构建失败 "next: not found" | `next` 仅在 devDependencies 中 | 移至 `dependencies` |
| `npm ci` 构建失败 | `package-lock.json` 未同步 | 本地执行 `npm install` 并提交 lockfile |
| 冷启动延迟 > 5s | min-instances=0，首次请求需启动容器 | 设置 `--min-instances=1`（约 $10/月闲置费用） |
| 详情端点 502 / 超时 | 默认 5 分钟超时通常足够，检查数据大小 | 按需增加 `--timeout=600` |
| Cloud Run URL 返回 403 | `--allow-unauthenticated` 未设置 | 重新部署时加上该参数 |
| Scheduler job 持续 401 | `REBUILD_AUDIENCE` 与服务 URL 不一致，或 OIDC token audience 配置错误 | 核对 `REBUILD_AUDIENCE` env var 与 `--oidc-token-audience` 都等于 `gcloud run services describe` 返回的根 URL |
| Scheduler job 持续 403 | `SCHEDULER_SA_EMAIL` env var 与 job 的 `--oidc-service-account-email` 不一致 | 两者必须严格相等（含项目 ID） |
| `_indexes/` 始终为空 | runtime SA 缺少 objectCreator 条件绑定 | 重新执行"缓存索引"章节第 1 步 |

## 清理

如需完全移除：

```bash
gcloud scheduler jobs delete "${SERVICE}-rebuild-today" \
  --location="$REGION" --project="$GCP_PROJECT" --quiet

gcloud run services delete "$SERVICE" \
  --region="$REGION" --project="$GCP_PROJECT" --quiet

gcloud iam service-accounts delete "$SCHEDULER_SA" \
  --project="$GCP_PROJECT" --quiet

gcloud iam service-accounts delete "$RUNTIME_SA" \
  --project="$GCP_PROJECT" --quiet

gcloud iam service-accounts delete "$DEPLOY_SA" \
  --project="$GCP_PROJECT" --quiet
```

SA 删除后 bucket IAM 绑定自动失效，bucket 本身及 `_indexes/` 下的聚合文件保留。如需一并清理缓存：

```bash
gcloud storage rm -r "gs://$BUCKET/_indexes/"
```

## 未来：锁定访问

如需从公开切换为邮件白名单访问：

1. 重新部署时使用 `--no-allow-unauthenticated`
2. 授予 Google Group 或特定用户 Cloud Run 服务上的 `roles/run.invoker`
3. 配置 IAP（Identity-Aware Proxy），使浏览器请求重定向至 Google 登录页

需要 OAuth 客户端 + IAP 品牌配置，届时另写文档。
