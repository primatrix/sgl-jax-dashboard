# 部署 — Cloud Run

将 Next.js 应用部署至 Google Cloud Run，作为公开服务读取 `gs://observability-storage-sglang`。通过 Workload Identity 认证，无需写入密钥文件。

## 前提条件

- `gcloud` 已认证为 `tpu-service-473302` 项目的 owner / editor
  （验证：`gcloud config get-value project` 和 `gcloud auth list`）
- 以下 API 已在项目中启用：
  - `run.googleapis.com`
  - `cloudbuild.googleapis.com`
  - `artifactregistry.googleapis.com`
- 工作目录为仓库根目录

## 部署参数

| 项目 | 值 |
| --- | --- |
| GCP 项目 | `tpu-service-473302` |
| Cloud Run 服务名 | `sgl-jax-dashboard` |
| 区域 | `us-central1`（bucket 位于 `US` 多区域，同大陆零出站费用） |
| 运行时 SA | `sgl-jax-dashboard-runtime@tpu-service-473302.iam.gserviceaccount.com` |
| 运行时 SA 权限 | bucket 上的 `roles/storage.objectViewer`，无项目级权限 |
| 部署 SA | `sgl-jax-dashboard-deployer@tpu-service-473302.iam.gserviceaccount.com` |
| 部署 SA 权限 | `roles/run.admin`、`roles/cloudbuild.builds.editor`、`roles/iam.serviceAccountUser`、`roles/artifactregistry.writer`、`roles/storage.admin` |
| 访问控制 | 公开（`--allow-unauthenticated`），内容为非敏感 TPU CI 指标 |
| 资源配置 | 1 vCPU / 512 Mi / 最大 3 实例 / 支持缩容至零 |
| 环境变量 | `GCS_BUCKET=observability-storage-sglang` |

## 一次性初始设置

以下命令均可安全重复执行。

### 1. 创建运行时服务账号

```bash
gcloud iam service-accounts create sgl-jax-dashboard-runtime \
  --project=tpu-service-473302 \
  --display-name="sgl-jax-dashboard Cloud Run runtime"
```

### 2. 授予 SA 对 bucket 的读取权限

```bash
gcloud storage buckets add-iam-policy-binding gs://observability-storage-sglang \
  --member="serviceAccount:sgl-jax-dashboard-runtime@tpu-service-473302.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

### 3. 允许你的账号扮演运行时 SA

`gcloud run deploy` 需要此权限来将 SA 绑定到服务。

```bash
gcloud iam service-accounts add-iam-policy-binding \
  sgl-jax-dashboard-runtime@tpu-service-473302.iam.gserviceaccount.com \
  --member="user:zhengke.zhou.dev@gmail.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=tpu-service-473302
```

### 验证设置

```bash
gcloud iam service-accounts describe \
  sgl-jax-dashboard-runtime@tpu-service-473302.iam.gserviceaccount.com \
  --project=tpu-service-473302 --format='value(email,disabled)'
```

预期输出：显示邮箱，`disabled=False`。

```bash
gcloud storage buckets get-iam-policy gs://observability-storage-sglang \
  --format=json | grep -A1 sgl-jax-dashboard-runtime
```

预期输出：显示 `roles/storage.objectViewer` 的绑定。

## CI/CD

通过 GitHub Actions 自动部署，使用 Workload Identity Federation (WIF) 认证到 GCP，无需存储密钥。

| 触发 | 工作流 | 行为 |
| --- | --- | --- |
| Push to main | `deploy.yml` | 运行 CI 检查后部署到生产（100% 流量） |
| PR opened/updated | `preview.yml` | 运行 CI 检查后部署为 tagged revision（0% 流量），在 PR 评论中贴预览链接 |
| PR closed | `cleanup.yml` | 移除对应的 revision tag |

PR 预览 URL 格式：`https://pr-{number}---sgl-jax-dashboard-785128357837.us-central1.run.app`

### WIF 配置

已配置完成，以下为参考：

- Workload Identity Pool: `github-actions`（项目 `tpu-service-473302`）
- OIDC Provider: `github-oidc`（限制 `assertion.repository == 'primatrix/sgl-jax-dashboard'`）
- 部署 SA: `sgl-jax-dashboard-deployer@tpu-service-473302.iam.gserviceaccount.com`
- 运行时 SA: `sgl-jax-dashboard-runtime@tpu-service-473302.iam.gserviceaccount.com`（仅 `roles/storage.objectViewer`）
- 部署 SA 项目级角色: `roles/run.admin`、`roles/cloudbuild.builds.editor`、`roles/iam.serviceAccountUser`、`roles/artifactregistry.writer`、`roles/storage.admin`

## 手动部署

部署由 GitHub Actions 自动处理（见 CI/CD 章节）。如需手动部署：

```bash
gcloud run deploy sgl-jax-dashboard \
  --source=. \
  --region=us-central1 \
  --project=tpu-service-473302 \
  --service-account=sgl-jax-dashboard-runtime@tpu-service-473302.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars=GCS_BUCKET=observability-storage-sglang \
  --cpu=1 --memory=512Mi --max-instances=3 --min-instances=0
```

首次部署耗时 5-8 分钟（冷启动 Cloud Build、拉取基础镜像、npm ci、构建）。后续部署约 2-3 分钟（依赖缓存生效）。

Cloud Build 使用 `.gcloudignore` 决定上传内容；若缺失则回退到 `.gitignore`。当前 `.gitignore` 已排除 `node_modules`、`.next`、`.superpowers`、`.harnessed`、`.claude`，无需额外操作。

部署完成后会自动输出预览 URL。

## 重新部署

推送到 `main` 分支即可触发自动部署。`--service-account`、`--allow-unauthenticated`、环境变量等会沿用上次部署的配置。

## 故障排查

| 症状 | 原因 | 解决方法 |
| --- | --- | --- |
| `/api/cases` 返回 503 "Run gcloud auth..." | 运行时 SA 无 bucket 读取权限 | 重新执行初始设置步骤 2 |
| 构建失败 "next: not found" | `next` 仅在 devDependencies 中 | 移至 `dependencies` |
| `npm ci` 构建失败 | `package-lock.json` 未同步 | 本地执行 `npm install` 并提交 lockfile |
| 冷启动延迟 > 5s | min-instances=0，首次请求需启动容器 | 设置 `--min-instances=1`（约 $10/月闲置费用） |
| 详情端点 502 / 超时 | 默认 5 分钟超时通常足够，检查数据大小 | 按需增加 `--timeout=600` |
| Cloud Run URL 返回 403 | `--allow-unauthenticated` 未设置 | 重新部署时加上该参数 |

## 清理

如需完全移除：

```bash
gcloud run services delete sgl-jax-dashboard \
  --region=us-central1 --project=tpu-service-473302 --quiet

gcloud iam service-accounts delete \
  sgl-jax-dashboard-runtime@tpu-service-473302.iam.gserviceaccount.com \
  --project=tpu-service-473302 --quiet
```

SA 删除后 bucket IAM 绑定自动失效，bucket 本身保留。

## 未来：锁定访问

如需从公开切换为邮件白名单访问：

1. 重新部署时使用 `--no-allow-unauthenticated`
2. 授予 Google Group 或特定用户 Cloud Run 服务上的 `roles/run.invoker`
3. 配置 IAP（Identity-Aware Proxy），使浏览器请求重定向至 Google 登录页

需要 OAuth 客户端 + IAP 品牌配置，届时另写文档。
