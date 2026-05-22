# sgl-jax-dashboard

sglang-jax 多主机 TPU CI 测试结果的可观测性面板。从 `gs://observability-storage-sglang` 读取推理框架写入的原始 JSON 数据，展示最近的测试用例及趋势变化。

## 环境要求

- Node 18.18+（开发使用 Node 25）
- `gcloud` CLI，需认证为对 bucket 拥有 `roles/storage.objectViewer` 权限的账号

## 快速开始

```bash
gcloud auth application-default login   # 一次性设置 ADC
npm install
make dev
```

## 配置

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `GCS_BUCKET` | `observability-storage-sglang` | GCS bucket 名称 |

复制 `.env.example` → `.env.local` 覆盖默认值。

## 架构

### 数据流

```
推理框架 → GCS (原始 JSON) → Next.js API Routes → 前端组件
```

GCS bucket 目录结构：

```
gs://observability-storage-sglang/
  <YYYY-MM-DD>/
    <workload>/              # 例: gke-run-test-caces-25906727670
      <case-name>.json       # 每个测试用例一个 JSON 文件
```

### API 路由

| 路由 | 说明 |
| --- | --- |
| `GET /api/cases?days=N` | 返回最近 N 天的用例摘要列表（默认 7 天，最大 90 天） |
| `GET /api/case?path=<path>` | 返回单个用例的完整详情（含 samples、server_info） |
| `GET /api/timeseries?case=&profile=&target=&metric=&days=N` | 返回指定用例的指标时间序列（默认 30 天，最大 180 天） |

### 页面

| 页面 | 说明 |
| --- | --- |
| `/` | Dashboard — 性能和精度用例的汇总表格，支持时间窗口筛选和时间序列图表 |
| `/case/<date>/<workload>/<file>` | 详情页 — 完整的延迟统计、吞吐量、Token 统计、运行配置、Samples、Server Info |

### 用例类型

- **Perf（性能）** — 延迟（TTFT / ITL / TPOT / E2E）、吞吐量、Token 统计等
- **Accuracy（精度）** — 数据集、模型 ID、得分

## 项目结构

```
app/
  api/
    cases/route.ts              # 用例列表 API
    case/route.ts               # 用例详情 API
    timeseries/route.ts         # 时间序列 API
  case/[...path]/page.tsx       # 用例详情页（服务端组件）
  page.tsx                      # Dashboard 入口
  layout.tsx
  globals.css
components/
  ui/                           # 可复用原子组件
    DeltaBadge.tsx              # 变化百分比标识
    ScoreBar.tsx                # 精度得分进度条
    Sparkline.tsx               # 内联迷你图
  dashboard/                    # Dashboard 页面组件
    Dashboard.tsx               # 主面板：表格 + 图表
    CasesTable.tsx              # 性能/精度分类表格
    TimeSeriesChart.tsx         # Chart.js 时间序列图表
  case/                         # 详情页组件
    Cards.tsx                   # 详情页卡片（延迟、吞吐、Token 等）
    CaseTrend.tsx               # 详情页趋势图
  ThemeToggle.tsx               # 主题切换（布局级）
lib/
  types.ts                      # 类型定义与类型守卫
  parse.ts                      # GCS 路径 + JSON 解析
  gcs.ts                        # GCS 客户端适配器（可注入）
  compare.ts                    # 指标对比与 delta 计算
  timeseries.ts                 # 构建图表数据
  metric-labels.ts              # 指标显示标签
  api/
    cases-handler.ts            # /api/cases 业务逻辑
    case-handler.ts             # /api/case 业务逻辑
    timeseries-handler.ts       # /api/timeseries 业务逻辑
.github/workflows/
  deploy.yml                    # Push to main → 自动部署生产
  preview.yml                   # PR → 部署预览环境
  cleanup.yml                   # PR 关闭 → 清理预览
docs/
  deployment.md                 # Cloud Run 部署指南
tests/                          # vitest + RTL 测试
Makefile                        # 开发、测试命令
```

测试通过 `GcsClient` 接口 stub `@google-cloud/storage`，无需网络访问或 ADC 凭证。

## 部署

通过 GitHub Actions 自动部署至 Cloud Run：push to main 部署生产，PR 自动创建预览环境。详见 [deployment.md](./docs/deployment.md)。

生产地址：https://sgl-jax-dashboard-785128357837.us-central1.run.app/
