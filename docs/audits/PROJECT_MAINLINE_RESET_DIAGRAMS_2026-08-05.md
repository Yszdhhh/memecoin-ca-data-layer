# PROJECT MAINLINE RESET DIAGRAMS 2026-08-05

审查基线：origin/main @ fce42eeb560c85e4924399bdf08419f9ea7ba642
用途：把当前断点和建议的 SOL-only 主线画成最小可读的产品视图。图中所有 borrowed 字段都保持 unverified；Harness 是风险 sidecar，不是用户价值链的替代物。

## 当前链路

~~~mermaid
flowchart LR
  A["用户粘贴 SOL CA / 手动 batch"] --> B["narrow Helius live read"]
  B --> B1["mint + metadata + token accounts"]
  B --> B2["bounded summary + watermark"]
  B1 --> C["holder cleaning pilot"]
  C --> D["operator API / Console"]
  D --> E["fixture-first card"]
  F["fixture borrowed market/security/holders"] --> E
  G["candidateWallets optional"] --> H["in-memory library lookup"]
  H --> E
  E --> I["in-memory deep-dive queue"]
  I --> J["AnalysisService only after explicit drain"]
  J --> K["no formal CA-to-library product write"]
  L["private SOL 1433 / GMGN 32"] -.-> M["external CHAINFM_OUT_DIR"]
  N["private BSC 1034 / first 30"] -.-> O["stage blocked"]
  P["Harness reports + ignored runs"] -.-> Q["lifecycle evidence gaps"]

  classDef gap fill:#ffe4e4,stroke:#a33;
  classDef bounded fill:#e8f1ff,stroke:#467;
  classDef private fill:#fff4d6,stroke:#a77b00;
  class B,B1,B2,C bounded;
  class K,O,Q gap;
  class M,N,L,P private;
~~~

当前图的中心问题不是没有模块，而是没有一条从用户输入穿过同一套 first-hand facts、cleaning、library、judgment 并回到可复现结果的主路径：

- live CA first 在 Helius 上只做 mint、metadata、token-account 三项 bounded read；
- hotpath 市场、安全、holder 和 library hit 在主应用代码中仍是 fixture/borrowed 或依赖调用方额外传入的 candidateWallets；
- AnalysisService 有更完整的判断能力，但 live Helius source 对 tags/facts/audited Solana facts fail closed；
- 结果没有形成面向用户的 durable CA card、地址库沉淀和现实成本 replay；
- 私有 1,433/32 和 1,034/30 产物与正式 Git product path、stage lock、独立 audit evidence 之间仍是断开的。

## 目标主线

~~~mermaid
flowchart LR
  A["用户粘贴公开 SOL CA"] --> G["输入门：Base58 + Owner live gate"]
  G --> H["Helius-only first-hand facts"]
  H --> H1["mint / metadata / full token accounts"]
  H --> H2["Pump creator evidence"]
  H --> H3["funding / normalized swaps / Dev history"]
  H --> C["complete-or-partial holder cleaning"]
  C --> L["SOL address library"]
  L --> J["CA judgment"]
  H --> J
  J --> S["CA first-screen card"]
  T["optional borrowed market/security context"] --> S
  T --> U["unverified + source + observed_at"]
  J --> R["offline replay dataset"]
  R --> R1["observed_at → simulated_order_at"]
  R1 --> R2["slippage / liquidity / fee / tax / non-fill"]
  R2 --> R3["wallet performance vs copyable performance"]
  S --> V["manual deep dive / scrubbed evidence"]
  R3 --> V
  V --> W["manifest + watermark + output hash"]

  X["Fast"] -.-> V
  Y["Standard"] -.-> V
  Z["Strict"] -.-> V
  X --> X1["read-only audit / docs / fixture research"]
  Y --> Y1["product code / offline adapter / replay"]
  Z --> Z1["live credential / stage / sensitive write"]

  classDef fact fill:#dff3e4,stroke:#287a3d;
  classDef judgment fill:#e8f1ff,stroke:#467;
  classDef replay fill:#fff4d6,stroke:#a77b00;
  classDef harness fill:#f0e7ff,stroke:#7250a4;
  class H,H1,H2,H3,C fact;
  class J,L,S,T,U judgment;
  class R,R1,R2,R3 replay;
  class X,Y,Z,X1,Y1,Z1 harness;
~~~

目标图的收敛顺序：

1. Helius facts 先可重复且明确 partial，不能用 borrowed top-N 补 authority。
2. 同一份 complete holder/creator/funding/trade evidence 同时服务 CA card、地址库和判断层。
3. borrowed market/security 只作为可选上下文，字段保留 origin、verificationStatus、observed_at 和 warnings。
4. replay 先做离线、无未来数据、成本后、fill/no-fill；Live Shadow Observation 仍是后续 PARK 项。
5. 用户看到的是 card、library hit、judgment、replay result 和 evidence link，而不是 Harness task 图。

## Lean Harness 三档

~~~mermaid
flowchart TB
  R["工作项风险"] --> F["Fast"]
  R --> S["Standard"]
  R --> T["Strict"]
  F --> F1["只读审查 / 文档 / 脱敏汇总"]
  F --> F2["required reading + privacy/diff + schema check"]
  S --> S1["代码 / fixture adapter / offline replay"]
  S --> S2["write set + typecheck/test/build/security + relevant suites"]
  S --> S3["source/hash/replay + peer review"]
  T --> T1["live credential / stage flip / sensitive write"]
  T --> T2["Owner gate + budget + secret scan + scrubbed manifest"]
  T --> T3["independent auditor + lifecycle + rollback/retention"]
~~~

## 四周主线

~~~mermaid
timeline
  title SOL-only mainline reset — four weeks
  第1周 : Helius audited facts minimum closure
         : CA card, partial/watermark, fixture + bounded live verification
  第2周 : CA-to-address-library wiring
         : SOL 1433 to 32 Chinese import/refresh pack
  第3周 : shadow contracts, deterministic replay, SOL adapter
         : delay, slippage, liquidity, fees, taxes, non-fill
  第4周 : 5-10 manual sample chain verification
         : replay/library cross-check, scrubbed evidence, historical audit archive
~~~

四周内保持 PARK：BSC/Robinhood、全量 1,433 链上确认、自动发现/cron、宏观 Dune、生产 DB、Live Shadow Trading、signing/broadcast/copy-trade。
