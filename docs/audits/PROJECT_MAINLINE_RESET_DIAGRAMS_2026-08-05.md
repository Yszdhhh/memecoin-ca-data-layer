# PROJECT MAINLINE RESET DIAGRAMS 2026-08-05

用途：把 Owner 直接授权后的 7–10 天并行 MVP 画成最小可读的产品视图。主线从已有的 SOL32＋BSC30 观察钱包和人工抽查开始；私有、离线、只读观察与生产 adapter 分开。所有 borrowed 字段仍保持 unverified，Harness 作为风险 sidecar，不是用户价值链的替代物。

## 主线与观察闭环

```mermaid
flowchart LR
    W["SOL32＋BSC30 观察钱包"] --> O["导入＋人工抽查"]
    O --> V["选 10–15 个重点地址\n只读链上事实复核"]
    V --> R["离线可复制性 replay v0.1"]
    R --> N["地址库/备注增量更新\n新增・更新・无变化・unknown"]
    N --> W

    C["CA 输入"] --> F["Helius bounded facts\nholder cleaning / creator precedence"]
    F --> K["最小 CA 判断卡\ncompleteness / warnings / trust"]
    K --> L["AddressLibrary 命中\n只写可追溯 observation"]
    L -.-> N

    B["BSC 私有 1,034 地址\n首批 30 条 GMGN 备注"] -.-> O
    P["BSC 生产 adapter\n自动刷新 / 跨链 CA 主链"] -.-> PARK["PARK\n不进入当前 MVP"]

    classDef now fill:#e7f5ed,stroke:#2f855a,color:#173b2a;
    classDef fact fill:#e8f0ff,stroke:#3b6db3,color:#172b4d;
    classDef park fill:#f3f3f3,stroke:#777,color:#333;
    class W,O,V,R,N now;
    class C,F,K,L,B fact;
    class P,PARK park;
```

这条闭环的顺序是：观察钱包 → 选定复核 → replay → note/library 更新 → 下一轮观察。BSC 私有观察作为 KEEP / USE_NOW 进入同一观察入口；BSC 生产 adapter、自动刷新和跨链 CA 主链不因私有产物而解除 PARK。

## CA 卡与钱包闭环并行

```mermaid
flowchart TB
    subgraph WalletLoop["钱包观察闭环"]
        W1["SOL32＋BSC30 观察钱包"] --> W2["人工抽查"]
        W2 --> W3["10–15 个重点地址"]
        W3 --> W4["事实复核"]
        W4 --> W5["replay v0.1"]
        W5 --> W6["备注与地址库增量更新"]
        W6 --> W1
    end

    subgraph CALoop["CA card 闭环（并行）"]
        C1["CA first input"] --> C2["Helius bounded facts"]
        C2 --> C3["holder cleaning + library lookup"]
        C3 --> C4["最小 CA 判断卡"]
        C4 --> C5["warnings / completeness / trust"]
    end

    C5 -. "可追溯 observation" .-> W6
    W4 -. "selected evidence" .-> C4
    M["PARK：生产写入、凭据、真实交易\n以及 BSC 生产 adapter"] -.-> S["Owner gate / Strict"]

    classDef wallet fill:#e7f5ed,stroke:#2f855a;
    classDef ca fill:#e8f0ff,stroke:#3b6db3;
    classDef side fill:#f0e7ff,stroke:#7250a4;
    class W1,W2,W3,W4,W5,W6 wallet;
    class C1,C2,C3,C4,C5 ca;
    class M,S side;
```

CA card 和钱包观察不是串行门槛：前者提供可解释的 CA 判断与地址库命中，后者提供选样本、事实复核和 replay 反馈；两者通过 scrubbed structured observation 互相补充。

## Lean Harness sidecar

```mermaid
flowchart LR
    Product["产品主线\n观察钱包 / CA card / replay"] -. "按风险挂载" .-> Risk["Owner 可覆盖的风险配置"]
    Risk --> Fast["Fast\n简短范围说明\n相关 privacy / diff / schema 自检"]
    Risk --> Standard["Standard\n简短任务说明\n相关测试＋安全扫描＋一次普通 review"]
    Risk --> Strict["Strict\nTask Spec＋manifest\n独立审计＋Owner gate＋回滚方案"]

    Fast -. "不需要" .-> FNo["Task Spec / ledger / manifest\nindependent auditor / 全仓 doctor"]
    Standard -. "不强制" .-> SNo["完整 manifest / 独立审计\n全仓 lifecycle"]
    Strict --> Prod["生产写入 / 凭据 / 真实交易\n阶段切换或不可逆 schema"]

    Lock["BSC/SOL stage lock"] --> Override["Owner 可覆盖"]
    Lock --> ReadOnly["离线・私有・只读\n不受阻断"]
    Lock --> StrictOnly["生产写入・凭据・真实交易\n进入 Strict"]
    Override --> ReadOnly
    Override --> StrictOnly

    classDef product fill:#e7f5ed,stroke:#2f855a;
    classDef mode fill:#e8f0ff,stroke:#3b6db3;
    classDef strict fill:#fff0e6,stroke:#c05621;
    classDef side fill:#f0e7ff,stroke:#7250a4;
    class Product product;
    class Fast,Standard mode;
    class Strict,Prod,StrictOnly strict;
    class Risk,FNo,SNo,Lock,Override,ReadOnly side;
```

Lean Harness 只把不可逆和高风险动作放进 Strict。T2 标签不再自动推出独立 Auditor；FAIL 形成有界 finding/review decision，不自动创建 repair 链。旧 reports、dispatches、ledger 和 evidence 先只读归档，归档前不逐文件开启 repair。

## 7–10 天并行 MVP 时间线

```mermaid
flowchart LR
    D1["Day 1\nSOL32＋BSC30 导入＋人工抽查"]
    D24["Day 2–4\n重点地址 replay v0.1"]
    D25["Day 2–5\n10–15 地址链上事实复核"]
    D37["Day 3–7\n最小 CA 判断卡"]
    D610["Day 6–10\n结果回流＋增量刷新"]

    D1 --> D24
    D1 --> D25
    D24 --> D610
    D25 --> D37
    D37 --> D610
    D610 -. "下一轮观察" .-> D1

    classDef now fill:#e7f5ed,stroke:#2f855a,color:#173b2a;
    class D1,D24,D25,D37,D610 now;
```

明确后置：BSC 生产 adapter、自动刷新、跨链 CA 生产主链、Robinhood、Live Shadow Trading、signing/broadcast/copy-trade CTA、宏观 Dune、自动 discovery/cron、生产 PostgreSQL/Redis 和竞品/社交接入。该时间线是 7–10 天并行 MVP。
