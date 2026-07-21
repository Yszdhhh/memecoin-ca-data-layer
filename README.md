# Memecoin CA Data Layer

面向 Solana / BSC / Robinhood Chain 的 CA 分析数据底层。当前版本包含：

- PostgreSQL 核心模型与 Redis 读缓存
- 可替换的链数据适配器接口
- 真实 Top Holder 清洗、简单 funding 集群、Dev 累计卖出、钱包质量分类
- `getQuickAnalysis`、`getDeepAnalysis`、`refreshTokenData` 编排服务
- 规则单元测试

详细设计见 [docs/DESIGN.md](docs/DESIGN.md)。

## Multi-agent Harness

所有 Agent 从 `AGENTS.md` 进入，只执行调度消息点名的
`harness/tasks/<task_id>.json`。当前阶段只允许 Solana；BSC 和 Robinhood
由可执行 stage lock 阻止提前实现。

```bash
npm run harness:doctor
npm run harness:status
npm run check
```

当前任务波次见 `harness/CURRENT_WAVE.md`，运行产物使用带 Git 基线、输入/输出
SHA-256、规则版本、source watermark 和验收日志的 manifest。

## 本地验证

```bash
npm install
npm run typecheck
npm test
```

数据库初始化：按顺序执行 `db/migrations` 下的 SQL。接入生产前，需要实现
`ChainDataAdapter`（第一优先是 Helius + Solana RPC）与 `MarketDataProvider`
的真实数据源适配。
