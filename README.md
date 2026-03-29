# 🚀 SubHub — 免费节点聚合 & 订阅转换

**在线体验：[sub.156354.xyz](https://sub.156354.xyz)**

SubHub 是一个纯 Serverless 的免费代理节点聚合与订阅格式转换平台，基于 Cloudflare Pages + Workers + KV 构建，零服务器成本。

## 功能特性

**节点聚合**：自动从多个开源节点源采集、去重、测活，目前聚合 4700+ 节点，覆盖 16 个国家/地区。每 30 分钟自动更新。

**订阅转换**：将任意订阅链接转换为 Clash、V2Ray、Sing-Box、Surge、Shadowrocket、Quantumult X 等客户端格式，无需第三方后端，转换逻辑完全在 Cloudflare 边缘运行。

**一键订阅**：提供开箱即用的订阅链接，支持按国家、协议筛选，复制链接直接导入客户端即可使用。

## 技术架构

```
┌─────────────────────────────────────────────┐
│              Cloudflare Pages               │
│  ┌──────────┐  ┌──────────────────────────┐ │
│  │ 静态前端  │  │   Pages Functions (API)  │ │
│  │ index.html│  │  /api/nodes   节点列表   │ │
│  │           │  │  /api/sub     订阅输出   │ │
│  │           │  │  /api/convert 格式转换   │ │
│  │           │  │  /api/collect 节点采集   │ │
│  │           │  │  /api/stats   统计信息   │ │
│  └──────────┘  └──────────┬───────────────┘ │
│                           │                 │
│                    ┌──────▼──────┐          │
│                    │ Cloudflare KV│          │
│                    │  节点存储    │          │
│                    └─────────────┘          │
└─────────────────────────────────────────────┘
         ▲ 每 30 分钟触发
┌────────┴────────┐
│  Cron Worker    │
│  subhub-cron    │
└─────────────────┘
```

**纯 Serverless**：前端 + API + 存储全部运行在 Cloudflare 免费套餐上，无需任何服务器。

## 节点来源

聚合多个知名开源节点仓库，自动去重和协议解析：

- [mahdibland/V2RayAggregator](https://github.com/mahdibland/V2RayAggregator)
- [mfuu/v2ray](https://github.com/mfuu/v2ray)
- [peasoft/NoMoreWalls](https://github.com/nicetry-nope/NoMoreWalls)
- 更多源持续接入中...

支持协议：SS、SSR、VMess、VLess、Trojan、Hysteria2

## 快速使用

**方式一：直接订阅**

访问 [sub.156354.xyz](https://sub.156354.xyz)，在首页选择客户端类型，一键复制订阅链接，导入客户端即可。

**方式二：API 调用**

```bash
# 获取 Clash 订阅（全部节点）
curl https://sub.156354.xyz/api/sub?format=clash

# 获取 V2Ray 订阅（仅日本节点）
curl https://sub.156354.xyz/api/sub?format=v2ray&country=JP

# 转换已有订阅为 Sing-Box 格式
curl "https://sub.156354.xyz/api/convert?url=YOUR_SUB_URL&target=singbox"
```

## 自部署

SubHub 完全开源，你可以一键 Fork 部署到自己的 Cloudflare 账号：

```bash
# 1. 克隆仓库
git clone https://github.com/kengerlwl/subhub.git
cd subhub

# 2. 安装依赖
npm install

# 3. 创建 KV 命名空间
npx wrangler kv namespace create SUBHUB_KV

# 4. 修改 wrangler.toml 中的 KV ID

# 5. 部署到 Cloudflare Pages
npx wrangler pages deploy .

# 6. 部署 Cron Worker（自动采集）
cd worker-cron
npx wrangler deploy
```

## 截图

暗色主题界面，三个核心页面：首页（一键订阅）、节点列表（筛选浏览）、订阅转换（格式互转）。

## License

MIT
