# PROJECT MAINLINE RESET AUDIT 2026-08-05

> 项目：memecoin-ca-data-layer
> 任务：PROJECT-MAINLINE-RESET-AUDIT-001
> 审查身份：codex-project-mainline-auditor-001
> 审查基线：origin/main @ fce42eeb560c85e4924399bdf08419f9ea7ba642
> 审查分支：audit/project-mainline-reset-2026-08
> 结论性质：Owner 直接授权的只读产品主线审查；本次只新增本报告、Inventory JSON、Diagrams，不修改产品代码和 Harness 注册内容。

## 执行摘要

仓库当前是一个“规则和离线骨架已经很厚、用户可直接复现的主链仍很窄”的研究/运营数据层。最值得继续投入的主线是：

SOL 32 + BSC 30 观察钱包导入与人工抽查 → 10–15 个重点地址链上事实复核 → 离线可复制性 replay v0.1；同时并行推进最小 CA 判断卡 → 用观察/replay 结果增量更新地址库和备注。

当前主线并非 SOL 全量 E2E，也不是可生产的多供应商热路径。代码、测试与文档明确表明：

- Solana 的 mint、metadata、完整 token-account 读取、规则测试和 Pump 版本化解码已有可复用能力；但是 live Helius 数据源的 address tags、wallet facts、holder snapshot、Pump creator evidence、Dev history 仍未闭合到完整 AnalysisService 路径。
- CA-first live 入口只返回三项有无/数量/完整性摘要，不调用 AnalysisService、地址库、持久化、队列或推断层；Operator Console 的默认数据仍是 fixture。
- hot-path 卡片的市场、安全、holder 是 fixture-backed borrowed/unverified；library lookup 只接受调用方另传的 candidateWallets，粘贴 CA 本身不能产生真正的地址库命中。
- SOL 1,433 个地址已完成私有清洗，SOL 32 候选导入 pack 和 BSC 1,034 个有效地址的首批 30 条 GMGN 备注也已存在于外部私有输出；下一步是立即使用、人工抽查和增量刷新，而不是重新生成这些产物。它们仍不会因此自动获得链上确认或生产主链地位。
- FIFO/weighted-average 的 first-hand leaderboard 规则存在，治理 Harness 也有一个通用 replay suite；但真正的 wallet shadow replay engine、现实执行成本模型和链上适配器尚未落入 src。不能把治理对象的“deterministic replay”当成交易回放已经可用。
- BSC 生产 adapter、自动刷新、跨链 CA 主链、Robinhood、自动发现、cron、实时增长循环、宏观 Dune、生产 PostgreSQL/Redis、Live Shadow Trading 仍然 PARK；BSC 私有离线、人工、只读观察不应被生产阶段配置误伤。

### 总体判定

建议把接下来 7–10 天收敛为 SOL32 + BSC30 观察钱包和最小 CA 卡并行的 MVP。P0 不是继续生成已有清洗/导入产物，而是把它们用起来：先人工抽查，再做 10–15 个重点地址事实复核和离线 replay，最后把结果回流到地址库/备注增量刷新。

### Owner Override 记录

本审查接受 Owner 直接授权，作为现有“只执行精确 task spec、只写声明 write set”的例外。例外范围仅限本次三份审查产物和只读检查；没有修改 task spec、ledger、dispatch、manifest、auditor 记录、自动交易、产品代码，也没有删除文件、合并 PR、改写历史或接触交易签名材料。

## 0. 范围、方法与安全边界

已按仓库入口完整读取以下 required-reading chain：

1. PROJECT_REQUIRED_READING.md
2. AGENTS.md
3. PROJECT_CONSTITUTION.md
4. PROJECT_ARCHITECTURE.md
5. PROJECT_OPERATING_PLAYBOOK.md
6. KNOWN_LIMITATIONS.md
7. OWNER_DECISIONS_NEEDED.md
8. harness/config/project.json

同时遵守 karpathy-principles：先读后写、保持边界清楚、避免用新抽象掩盖主线缺口；本次没有实现修复。

盘点使用 Git tracked files 作为正式仓库基线，空行不计入 LOC；代码 LOC 使用 TS/TSX/JS/MJS/CJS/SQL/脚本及配置代码类扩展的非空行。JSON、manifest、evidence 单独计数。npm build 产生的忽略构建输出不混入正式仓库比率。私有数据只读取了数量、覆盖率、状态和哈希一致性等聚合信息，使用 CHAINFM_OUT_DIR 作为外部私有输出别名；本报告不保存本地绝对路径、地址、完整备注、交易哈希、原始 provider 响应、API key 或 cookie。

共享 checkout 的原始脏文件为 README.md、docs/LOCAL_WORKSPACE_PATHS.md，均未修改、未 stash、未 reset、未 clean、未 restore。审查在独立 branch/worktree 上从上述 origin/main SHA 开始，审查工作树初始干净；仓库已有 24 条 worktree 记录，本次没有 prune 或清理。

## 1. Phase 0 认证基线

下列命令已在审查开始时执行，结果只记录脱敏结论：

| 检查 | 结果 |
| --- | --- |
| gh auth status | PASS；当前 CLI 用户为 Yszdhhh，token 内容未读取或记录 |
| git fetch origin --prune | PASS；无共享工作树写入 |
| gh repo view Yszdhhh/memecoin-ca-data-layer | PASS；远端仓库存在；README 的“完整 PostgreSQL/Redis/适配器”描述高于当前 Known Limitations 的实际可运行面 |
| gh pr list --state all --limit 100 | PASS；共看到 20 个历史/当前 PR，当前 open PR 为 #20、#19、#9、#3、#2 |
| git status --short（共享 checkout） | 保留两处既有修改：README.md、docs/LOCAL_WORKSPACE_PATHS.md |
| git rev-parse origin/main | fce42eeb560c85e4924399bdf08419f9ea7ba642 |
| git worktree list | 24 条记录；保留既有 worktree；新审查 worktree 使用 audit/project-mainline-reset-2026-08 |

当前 open PR 状态：

| PR | 标题摘要 | 状态 |
| --- | --- | --- |
| #20 | authorize clean Harness Doctor redelivery | DRAFT |
| #19 | repair harness forbidden wallet artifact rule | DRAFT |
| #9 | SOL holder stability batches | OPEN，非 Draft |
| #3 | bounded daily Solana token analysis | OPEN，非 Draft |
| #2 | ten-CA Helius live smoke | OPEN，非 Draft |

这组状态本身说明当前阻塞点并不只是产品代码：Harness Doctor 规则修复和历史 evidence redelivery 仍有 Draft 工作，部分公开 PR 仍未形成“当前主线已合入”的证据闭环。

## 2. 全仓库盘点

### 2.1 目录规模

正式盘点共 1,095 个 tracked files。下面的 LOC 口径是每个目录递归统计；JSON/manifest/evidence 文件数量使用扩展名或文件名含 manifest/evidence 的联合规则，避免把 JSON 数量误读为可执行代码。

| 目录 | 文件数 | 代码非空 LOC | 测试文件 | 文档文件 | JSON/manifest/evidence | 字节 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| src | 107 | 21,442 | 0 | 0 | 0 | 955,399 |
| test | 87 | 13,031 | 87 | 0 | 18 | 599,571 |
| apps | 41 | 3,792 | 7 | 0 | 8 | 272,113 |
| scripts | 5 | 219 | 0 | 0 | 0 | 9,538 |
| docs | 107 | 1,581 | — | 101 | 1 | 1,195,835 |
| harness | 710 | 1,743 | 2 | 232 | 443 | 2,927,333 |
| artifacts | 8 | 0 | 0 | 5 | 3 | 13,409 |
| db | 10 | 555 | 0 | 0 | 0 | 26,471 |
| fixtures | 2 | 0 | 0 | 0 | 2 | 24,175 |

tracked extension 的主要构成为 .json 468、.md 339、.ts 205、.gitkeep 26、.sql 13；二进制为 6 个 console screenshot，锁文件为 2 个 package-lock.json。npm build 在验证过程中观察到 372 个可再生成的忽略构建文件（主要是 .js/.d.ts）；它们不纳入 tracked 正式比率，也没有被删除。

### 2.2 产品代码、测试、Harness 的比例

为避免把 app 测试算成产品实现，产品实现口径为 src + apps 中非测试文件 + scripts + db：

- 产品实现：156 个文件、25,165 代码非空 LOC。
- 测试：test 目录 87 个文件，加 apps 中 7 个测试文件；合计 94 个测试文件、约 13,874 代码非空 LOC，约为产品实现的 55.2%。
- Harness 代码：1,743 LOC，约为产品实现的 6.9%；但 Harness tracked 文件数 710，是产品实现文件数的约 4.6 倍。
- Harness 文档（.md/.txt）9,313 行，加 Harness JSON/JSONL 数据、task、manifest、evidence 37,048 行，合计约 46,361 行，约为产品实现 LOC 的 1.84 倍。

判断：测试投入不算薄，规则层的质量有基础；真正失衡的是证据/调度表面积已经大于产品实现，而用户主线仍缺一个闭合 live-first-screen。继续加审计文档的边际收益低于把 adapter、library wiring、replay 接起来。

### 2.3 目录职责对照

- src：产品领域、应用层、适配器和 CLI 的主要实现面，规则测试显示 raw integer、owner aggregation、借用数据和 partial semantics 有明确边界。
- test：规则、fixture adapter、provider shape、持久化 round-trip、console data source 和 Harness suite 测试；没有完整实时全链路回放测试。
- apps：Operator Console 研究/运维 shell；默认 fixture，live 只接 CA holder task 的窄 API。
- docs：设计、研究、handoff、audit 和 runbook 很丰富；README 与 Known Limitations / CURRENT_WAVE 存在产品成熟度语气不一致。
- harness：308 个 task spec、251 条 ledger canonical entries、90 个 dispatch、244 个 report 目录/文件级条目和大量 evidence；运行目录 intentionally ignored，导致历史“已完成”很难由 lifecycle 认可。
- db：迁移和 Postgres repository 已存在，但没有 disposable database CI；生产 Console 路径被当前 wave PARK。
- artifacts/fixtures：少量 Git-safe 产物和 pinned fixture；私有真实输出不应移动到这里。

文档路径有一个可重复的可用性问题：任务入口要求中的 CURRENT_WAVE.md、DISPATCH_PLAN.md、DISPATCH_TEMPLATE.md 不在根目录，而实际文件位于 harness/ 下。README 与 AGENTS 能让熟悉仓库的人找到它们，但自动化入口或新 agent 直接按根路径读取会失败，应在后续文档整理中统一。

## 3. 用户价值链逐段审查

### 3.1 主链状态表

| 链路段 | 当前可运行形态 | 数据是真实、fixture、私有还是正式主链 | 信任级别 | 主要缺口与 Harness 阻塞 |
| --- | --- | --- | --- | --- |
| CA / wallet 输入 | SOL manual CA-first；单个和 1–10 批量入口有严格地址校验；wallet 侧已有私有 1,433 输入清洗结果，另有 SOL32＋BSC30 观察钱包 | CA-first live 是受限 Helius read-only；Console 默认 fixture；SOL32 与 BSC30 在外部私有产物中可供人工导入/抽查 | Helius 链上读取可作 A 类输入，但当前结果只是 bounded summary；观察钱包仍按 borrowed/unverified 与 chain_checked 分层 | 无 discovery、无自动 daily、无完整 CA card；live full fact 仍受 Helius adapter 缺口和 live task evidence gate 阻塞 |
| 第三方事实数据 | free-provider ports + borrowed market/security/holder interfaces；实现主要是 fixture provider；GMGN 有 parser/transport diagnostics | fixture/离线为正式 Git 主线；GMGN 运行产物和 32 候选 pack 在私有目录；没有正式 live multi-provider adapter | 一律 borrowed/unverified，不能覆盖链上事实 | Owner 已把当前 runtime 收窄为 Helius-only；因此旧 dispatch 中“全免费多供应商热路径”应改为可选 Tier-B，而不是继续扩张 |
| 链上校验 | LiveHeliusDataSource 可读 mint、metadata、完整 token accounts、部分 transaction history；Pinned Pump decoder 支持 create_v2/buy/sell/migrate fixture | live Helius 是受限公共 CA smoke；Pump decoder 和 adapter fixture 是正式 Git；full Pump/PumpSwap live E2E 未闭合 | mint/owner account 是 first-hand 输入；Pump creator/Dev/holder audited facts 在 live 数据源仍不可用 | live data source 的 getAddressTags/getWalletFacts 直接 fail closed；可选 audited holder/pump/dev 方法未实现，AnalysisService 因此只能 indeterminate |
| 地址清洗 / labels | Base58 normalize、dedupe、owner aggregation、exclusion reason/confidence/evidence/ruleVersion；candidate screening、master table、chainfm cleaner 已有 | 规则和 fixture 在 Git；SOL 1,433 master/candidate 输出私有；label 默认 unverified | 借用 label 不升级为 verified；first-hand confirmation 分开 | CA→address library 没有从粘贴 CA 的用户路径闭合；in-memory library 主要用于 offline acceptance，Postgres 为 later |
| 市场 / 流动性上下文 | append-only market_observations selection；hot-path 可以展示 price/liquidity/FDV 的 fixture quote | 仅离线 append-only / fixture；没有 live Dexscreener/Birdeye/Gecko adapter | B 类 borrowed/unverified；只用于上下文和阈值辅助 | live card 没有可依赖的市场来源；宏观 Dune 有研究/离线设计但不应挡住 SOL CA-first |
| CA judgment | AnalysisService 在 fixture/接口上组织 market、holders、trades、transfers、funding、tags、wallet facts、holder concentration、creator/Dev/large-order 等 | 规则和 fixture 可复现；完整 live output 还不是正式主链 | first-hand 与 borrowed 分层明确；partial 会 warnings/completeness | Helius live 先在 tags/facts 处失败；没有从 live CA first 入口进入 AnalysisService 的正式全链路 |
| GMGN notes | parser/transport/normalization、candidate screening 和私有导入产物存在；不会自动写回 GMGN | SOL32 import pack、BSC 1,034 中首批 30 条 GMGN 备注均已存在于外部私有产物，不在 Git；下一步是导入、人工观察、抽查和增量刷新 | provider fields borrowed/unverified；不能称为链上已确认智能钱 | 仍需把人工抽查/chain_checked/diff 状态作为旁路结果维护；禁止把 notes 反写 GMGN、禁止把平台 label 变 verified |
| 历史 buy/sell 与 leaderboard | first-hand FIFO/weighted-average realized PnL 规则、borrow-then-confirm leaderboard 和 fixture replay suite 已有 | 规则/fixture 正式；部分 wallet profile/holdings history 只在私有或诊断产物；没有完整生产回放 | confirmed 只来自 first_hand swap evidence 且 completeness=1 | 没有交易 shadow replay engine；当前 generic replay 不是交易执行回测，无法回答“观察延迟后用户是否可成交” |
| 可复现性 | ruleVersion、input/output hash、source watermark、scrubbed manifests、四个 Harness dimensions、461 个测试 | Git fixture 和 scrubbed evidence 正式；Harness runs ignored，历史 runs 缺失 | 代码/fixture 可复现；历史 DONE 的 audit closure 不一定可 lifecycle 验证 | lifecycle plan 报告 107 个 audit-evidence gaps；“报告写了 PASS”不等于“有独立有效 auditor run” |

### 3.2 私有数据聚合核对

只记录聚合，不把真实地址或原始 GMGN/链响应写入 Git：

- SOL 侧：唯一输入地址计数 1,433；候选 union 32；中文导入 pack 32；私有输出同时有 master、质量报告、replay manifest 和候选差异统计。该产物已可使用，下一步是人工抽查、选样本复核和增量刷新，不是重新生成。
- BSC 侧：唯一有效 EVM 地址计数 1,034；私有 source inventory 5,170 行引用、5 个来源、地址格式通过率 100%；紧凑导入前 30；私有候选 review 32；该私有离线/只读观察产物 KEEP / USE_NOW；但 PnL/cost basis 覆盖率不能因此被解释为链上 verified，生产 adapter、自动刷新和跨链 CA 主链仍 PARK。
- 私有输出总量约 3,967 个文件、约 81 MB；BSC 约 3,442 个、SOL 约 514 个，其余为聚合/清单。它们位于外部 CHAINFM_OUT_DIR，未纳入 Git。
- 私有文件不等于生产 GREEN：后续只对选定地址做有界事实复核，把观察/replay 结果带着 source watermark、规则版本和 trust 状态增量回流；不因已有产物重新启动全量重抓、GMGN signed/cumulative、生产 BSC chain verification。

### 3.3 关键问题的直接回答

#### SOL 1,433 → 32、GMGN 中文导入

这条数据准备链已经有可复用的 clean-rank、candidate screening、hash guard 和私有 32 条导入形状；SOL32 导入 pack 已是现有私有产物，不应再描述成待生成任务。下一步是立即导入、人工抽查、对选定地址做事实复核，并以差异/chain_checked 状态做增量刷新；不做 GMGN 页面/API 写回，不把候选名称改成 confirmed。

#### BSC 1,034 → 前 30

BSC 必须拆成两层：私有 1,034 地址、首批 30 条 GMGN 备注和人工观察是 KEEP / USE_NOW，可离线、私有、只读地立即导入和抽查；BSC 生产 adapter、自动刷新和跨链 CA 主链是 PARK。BSC/SOL stage lock 应记录为 Owner 可覆盖的风险配置：离线、私有、只读分析不受阻断，生产写入、凭据和真实交易才进入 Strict；本次不修改 Harness 配置。

#### 外部链验证

从 SOL32＋BSC30 观察钱包中选 10–15 个重点地址做有限、手动、只读的链上事实复核；按实际链和 Owner 授权的只读来源记录 mint/account/transaction shape、creator precedence、funding edge 等有证据字段。当前 full AnalysisService live path 仍有 tags/facts/audited fact 缺口；1,433 和 1,034 的全量“已链上确认”均不成立，也不需要先完成 BSC 生产 adapter。

#### 热路径、流动性 / 宏观、holder / dev / funding / cluster

hot-path 代码已经有并行扇出、2 秒虚拟 P95 budget、degrade warnings 和 async deep-dive enqueue；但 latency 仍是 caller-declared virtual latency，不能当真实 provider wall time。holder/dev/funding/cluster 规则骨架和测试较好，holder 只有在 complete owner snapshot 与 pinned creator 前提下才能出可信 concentration/dev；market/liquidity 是 append-only offline enrichment；宏观 Dune 不应成为 CA-first 的前置依赖。

#### trade history、积分/表现、delay/slippage/fees/taxes/non-fill

当前有 wallet stats/holdings diagnostics、first-hand PnL 规则和少量历史 evidence，但没有一套正式的“观察到交易 → 延迟后下单 → as-of 价格 → 流动性约束 → fill/no-fill → 成本后结果”引擎。缺失字段不能当 0，same-mint transfer 不能当 swap，未来价格不能回填。第一步应是简单的离线 replay contract/engine；完整 Live Shadow Trading 不应先于它，也不应成为简单 replay 的前置门槛。Live observation 仍要等 replay、适配器、数据安全审计和 Owner 网络授权。

## 4. 产品与工程面分类

分类含义：KEEP 保留既有硬边界或稳定规则；SIMPLIFY 减少表面积；MERGE 合并重复实现/证据链；PARK 保留但不进当前主线；ARCHIVE 保留为历史研究；DELETE_CANDIDATE 只表示可再生成/可清理候选，本次不执行删除；MAINLINE_NOW 表示 7–10 天并行 MVP 应直接产出用户结果；USE_NOW 是叠加在既有 KEEP 之上的使用状态，不是新的主分类。

### 4.1 产品面

| 面 | 分类 | 审查意见 |
| --- | --- | --- |
| CA 输入、严格地址校验、手动入口 | KEEP | 这是低成本的主入口和安全边界，继续保留 fail-closed |
| Helius mint/metadata/token-account live read | MAINLINE_NOW | 作为 SOL first-hand 起点，但必须把 watermarks/partial 直接带到卡片 |
| owner aggregation、余额清洗、exclusion evidence | KEEP | 这是项目差异化的事实层，不能被 borrowed top-N 替代 |
| Pump creator precedence、版本化 decoder、fixture | KEEP | create.creator precedence 和 pinned fixtures 是高信任基础 |
| Dev history | SIMPLIFY | 只基于完整 creation-to-now normalized trades；不完整就 null/warning，不扩张假设 |
| funding edge、service-funder suppression、cluster rules | KEEP | 保留 evidence/confidence/ruleVersion 和可逆快照 |
| alpha、bot/sniper、independent-smart-money detector | KEEP | 只做 judgment layer，不把 label 当 chain fact |
| address library exact lookup | MAINLINE_NOW | 从 CA first-screen 真正传入 holder candidates，并接收观察/replay 结果的增量回流 |
| sedimentAnalysis / wallet-token-edge wiring | MERGE | 把 in-memory acceptance、Postgres adapter 和 AnalysisService after-analysis hook 统一在一个 contract |
| append-only market observation | SIMPLIFY | 先保留离线 observation/context；不再把多供应商 live 设计当作当前事实 |
| CA hotpath card | MAINLINE_NOW | 接 Helius holder facts、library hit、可选 unverified context 和明确 completeness |
| AnalysisService full audited Solana path | MAINLINE_NOW | 这是从 smoke 到产品的关键连接，不另造第二套 CA 判断器 |
| GMGN parser / transport diagnostics | MERGE | parser contract 保留；重复的 transport repair/audit chain 归并为少量可复现 schema fixtures |
| SOL 1,433 existing private cleaning/master + SOL32 existing GMGN import | KEEP / USE_NOW | 已有私有产物；下一步是使用、人工抽查、差异复核和增量刷新，不再把清洗/生成 pack 写成未完成工作 |
| BSC private 1,034 addresses + first-30 GMGN notes + manual observation | KEEP / USE_NOW | 现有私有、离线、只读观察产物立即可用；不升级为链上 verified，不写回 GMGN |
| BSC production adapter + automatic refresh + cross-chain CA mainline | PARK | 保留设计/代码候选；生产写入、凭据、真实交易或跨链生产接线进入 Strict，当前不进 MVP |
| selected 10–15-address chain fact verification | MAINLINE_NOW | 从 SOL32＋BSC30 观察钱包中选样本做只读事实核对，按来源保留 chain_checked/unknown/partial 状态 |
| historical buy/sell leaderboard | MAINLINE_NOW | 复用 first-hand FIFO/weighted 规则，分开 borrowed lead 与 confirmed result |
| delay/slippage/fees/taxes/liquidity/non-fill model | MAINLINE_NOW | 放进离线 replay v0.1；结果必须区分 wallet performance 与 user-replicable performance |
| Live Shadow Trading / resident observation | PARK | 不能先于 replay、适配器、审计和 Owner 网络授权 |
| macro / Dune / global liquidity | PARK | 研究保留，不挡住 CA-first 和地址库 |
| daily top-token auto mining、cron、auto sedimentation | PARK | 手动 offline loop 可作为 fixture；自动触发违反当前 Owner boundary |
| Operator Console | SIMPLIFY | 保留研究 shell、CA holder task 和 trust copy；不要把 fixture UI 叫 production |
| production PostgreSQL/Redis Console path | PARK | 迁移/repository 可保留，部署和 backfill 等 Owner 决策明确后再接 |
| Telegram/social ingestion | PARK | Owner 已明确暂不接入 |
| signing、broadcast、real trade、copy-trade CTA | PARK | Constitution 明确禁止；研究文档中的竞品模式不进入产品实现 |
| Alpha Terminal / competitor / broad prototype documents | ARCHIVE | 作为设计参考和术语库，不作为 implementation authority |
| tracked console screenshots | ARCHIVE | 作为历史 UI evidence 留存，不能替代可运行 data source |

### 4.2 治理与工程面

| 面 | 分类 | 审查意见 |
| --- | --- | --- |
| required-reading chain、Constitution、no-trade/no-secret | KEEP | 保留安全、事实语义和禁止真实交易的硬边界；stage lock 单独按风险配置处理 |
| BSC/SOL stage lock | SIMPLIFY | 改为 Owner 可覆盖的风险配置；离线、私有、只读分析不受阻断，生产写入、凭据和真实交易才进入 Strict |
| task schema、hash、write-set、forbidden action 校验 | KEEP | 继续保护安全和可追溯性 |
| typecheck/test/build/security scan/diff check | KEEP | 代码任务的最小质量门 |
| 按 Fast/Standard/Strict 分层的 review 与 evidence | SIMPLIFY | 不再要求所有 T2 语义工作独立 Auditor；只有 Strict 才要求独立审计、Owner gate 和回滚方案 |
| manifest、watermark、source hash | SIMPLIFY | 对 provider/data/replay 任务保留；纯文档和本次 Owner audit 不应强制虚构 run |
| 全部工作串行 run | SIMPLIFY | 只锁定同一共享 run/overlap；不把所有离线研究串成一个队列 |
| 每项工作必须精确 dispatch、偏离即 PARK | SIMPLIFY | 对产品代码任务保留；Owner 审查、只读汇总、私有研究应走轻量路径 |
| task spec 与 ledger 的 canonical sync | MERGE | 统一生成/校验入口，消除 57 个 unledgered specs 和非标准状态 |
| 重复 GMGN audit/repair/evidence chain | MERGE | 按 parser、transport、live gate 三个主题聚合，减少修复循环 |
| 没有有效 run manifest 的历史 DONE reports | ARCHIVE | 可读作历史记录，但不再作为 lifecycle audit closure |
| 根路径与 harness/路径不一致 | SIMPLIFY | 统一入口或给一个 canonical redirect |
| harness:doctor 对无关文档任务的全仓强阻塞 | SIMPLIFY | 仍扫描 secrets/wallet artifacts；把与 write set 无关的既有 baseline 分层为 warning |
| npm build 生成的忽略 .js/.d.ts | DELETE_CANDIDATE | 可再生成；本次没有删除，正式统计已排除 |

分类计数：MAINLINE_NOW 7、KEEP 10、SIMPLIFY 10、MERGE 4、PARK 7、ARCHIVE 3、DELETE_CANDIDATE 1；USE_NOW overlay 2（SOL32 与 BSC30 私有产物）。计数覆盖上面 42 个产品/治理面；没有任何删除动作。

## 5. Harness 审查：保留什么、减轻什么

### 5.1 A 类：必须保留的硬边界

1. 禁止 secret、wallet artifact、raw provider payload、交易签名、broadcast 和 real trade；security scan 必须 fail closed。
2. BSC/SOL stage lock 是 Owner 可覆盖的风险配置：离线、私有、只读分析不受阻断；生产写入、凭据和真实交易才进入 Strict，并保留 Owner live gate。
3. raw integer、transfers 不等于 sales、owner aggregation、borrowed/unverified、partial/completeness、creator precedence 等产品事实规则。
4. task schema/hash、write-set、forbidden actions、tracked input 检查；防止“报告说做了但代码没进 Git”。
5. 对相关代码任务保留 typecheck/test/build/diff-check；数据/回放任务按需要加 source watermark、double-run hash、record counts。
6. review 深度按 Fast/Standard/Strict 风险分层；不再要求所有 T2 语义工作必须独立 Auditor。FAIL 形成有界 finding 和 review decision，不自动创建 repair 链。

### 5.2 B 类：保留但按风险轻量化

- 四个 Harness dimensions：latency、replay、source-degradation、label-decision 仍有价值；只在相关产品路径需要时使用，不再为每类只读工作增加 governance cases。
- Fast：只需要简短范围说明和相关 privacy/diff/schema 自检；不需要 Task Spec、ledger、manifest、independent auditor 或全仓 doctor。
- Standard：只需要简短任务说明、相关测试、安全扫描和一次普通 review；不强制完整 manifest、独立审计或全仓生命周期闭环。
- Strict：涉及生产写入、凭据、真实交易、阶段切换或不可逆 schema 时，才需要 Task Spec、manifest、独立审计、Owner gate 和回滚方案。

### 5.3 C 类：当前造成延迟或重复的 over-constraint

- “所有 agent 只执行 exact task spec”无法覆盖 Owner 直接授权的全仓审查；Owner 直接授权的只读审查应走 Fast 或 Standard 的轻量说明。
- 对纯文档、轻量私有聚合、研究型 replay 设计也强制完整 task/manifest/independent-run，会把证据工作变成主线瓶颈；独立 Auditor 只在 Strict 中成为必需。
- shared worktree 全树串行适合会改代码的 Harness run，不应约束彼此不重叠的只读分析。
- lifecycle 目前把 107 个 DONE 关联项判为 evidence gap，因为 ignored run 目录没有可验证 finished manifest；这更像历史证据迁移缺口，不等同于 107 个产品实现全部错误。
- harness:doctor 当前因三项既有 wallet*.json tracked 内容失败；对真正修改产品代码的任务应阻塞，对只写本审查文档不应要求“先修完别人的 baseline”。
- dispatch 文档声明的多供应商 hot-path 与当前 Owner 决定的 Helius-only runtime 不一致，应以 Owner 决定覆盖旧 blueprint；BSC 私有只读观察不应被生产 stage 配置阻断。

### 5.4 Lean Harness 建议

| 模式 | 适用 | 必做 | 不必做 |
| --- | --- | --- | --- |
| Fast | 只读审查、文档、脱敏汇总、fixture 研究 | 简短范围说明、相关 privacy/diff/schema 自检、明确不改产品/Harness | Task Spec、ledger、manifest、independent auditor、全仓 doctor |
| Standard | 产品代码、规则、fixture adapter、CA card、offline replay | 简短任务说明、相关测试、安全扫描、一次普通 review | Task Spec/manifest/independent auditor/全仓 lifecycle，除非风险实际升级 |
| Strict | 生产写入、凭据、真实交易、阶段切换、不可逆 schema | Task Spec、manifest、独立审计、Owner gate、secret scan、预算/timeout、回滚方案与保留策略 | 无明确授权的自动化、交易和跨链扩张 |

Lean Harness 的原则是“风险驱动，不是证据样式驱动”。生产写入、凭据和真实交易仍然严格；低风险离线、私有、只读分析不应被 Strict 流程阻塞，也不应因为 T2 标签自动生成独立审计或 repair 链。

### 5.5 Harness 处理建议

- 立即冻结新增 tasks、reports、dispatches 和 ledger；本次只继续修改现有三份审查文件。
- 旧目录先只读归档，不立即批量删除；从 required reading 和 lifecycle gate 移除历史 evidence 的强制依赖。
- 后续做一次性归档和索引迁移，不逐文件开启 repair 任务；归档动作完成前保留可追溯的只读入口。

### 5.6 PR 处理建议

以下是主线治理建议，本次只记录在 PR #21 的审查文件中，不代为修改、关闭或合并其他 PR：

- #19：关闭，不合并。
- #20：待 #21 合并后关闭为 superseded，不合并。
- #2：关闭为历史 smoke evidence。
- #3：关闭为 superseded stacked PR。
- #9：标记 SALVAGE_ONLY，不直接合并；复用代码后关闭。

## 6. Task / Ledger / 依赖健康度

### 6.1 任务数量和状态

| 指标 | 数量/结果 |
| --- | ---: |
| harness/tasks/*.json | 308 |
| ledger entries | 251 |
| specs 未进入 ledger | 57 |
| ledger/spec status mismatch | 0（对 251 条 canonical entry） |
| spec DONE | 235 |
| spec READY | 32 |
| spec BLOCKED_DEPENDENCY | 13 |
| spec BLOCKED_STAGE | 12 |
| spec PARK | 12 |
| spec IN_PROGRESS | 1 |
| 非标准 spec status | 3（GREEN、implementation_complete_pending_independent_audit、READY_FOR_INDEPENDENT_AUDIT） |

Ledger canonical status 为 DONE 210、READY 3、BLOCKED_DEPENDENCY 13、BLOCKED_STAGE 12、PARK 12、IN_PROGRESS 1、RED 0。当前 status 视角下有 25 个 blocked、12 个 PARK、1 个 IN_PROGRESS、3 个 READY；harness:status 的 3 个 READY 为 GMGN 1,433 audit、HUD repair、Harness Doctor forbidden-path repair。

task filename keyword 统计（可重叠）：AUDIT 125、REAUDIT 2、REPAIR 97、HARNESS 37、EVIDENCE 16、MANIFEST 1、GOVERNANCE 0。实现类（不含 AUDIT/REAUDIT/REPAIR）127；任何 audit/repair 相关 181，约为全部 specs 的 58.8%；实现：audit/repair 约 127:181，即 0.70 个实现任务对应 1 个相关审计/修复任务。

分层：T1 30、T2 195、T3 81；角色：auditor 117、coordinator 36、implementer 142、researcher 11，另有少量空值/特殊角色。依赖数分布为 0 依赖 14、1 个 159、2 个 46、3 个 16、4 个 9、5 个 6、7 个 1，依赖图本身没有发现未知 dependency/cycle。

### 6.2 按产品功能的 Task / Audit / Repair

以下是按 task filename 的固定优先级规则单归类的产品面 proxy：BSC/Robinhood → Shadow/replay → SOL wallet/GMGN → Market/macro → Growth/leaderboard → SOL CA/holder/Pump。Audit 与 Repair 可重叠，不能相加当成总任务数。

| 产品功能 proxy | Task | Audit/reaudit | Repair | 纯实现 | 备注 |
| --- | ---: | ---: | ---: | ---: | --- |
| SOL wallet / GMGN | 122 | 62 | 53 | 33 | transport/schema/1433 反复最多 |
| SOL CA / holder / Pump | 60 | 20 | 23 | 24 | 规则骨架较实，live 接线仍缺 |
| Market / macro | 45 | 10 | 6 | 31 | 研究面大于当前 CA 主线 |
| BSC / Robinhood stage | 13 | 6 | 0 | 7 | stage-blocked |
| Shadow / replay | 10 | 4 | 1 | 5 | 合同/引擎仍未落到 src |
| Growth / leaderboard | 8 | 3 | 2 | 4 | offline loop 有，自动触发关闭 |
| 六类产品功能平均 | 43.0 | 17.5 | 14.2 | 17.3 | filename proxy，不替代产品调用图 |

这一表最重要的信号不是“审计多不好”，而是 GMGN 运输/字段修复投入显著高于真正 CA→判断→回放链路；之后应优先收敛可复用 parser contract 和 32 条用户产物，而不是继续开新的诊断分支。

### 6.3 Lifecycle 诊断

以下仅引用原始审查基线的 lifecycle plan 脱敏摘要；本次 Owner 对齐没有重新运行 lifecycle，也没有创建新的 evidence、task 或 manifest：

- runnable 3 个；
- not runnable 38 个；
- sync errors 0；
- audit-evidence gaps 107；
- readiness suggestion 1 个。

原始阻塞的主要来源是：BSC/Robinhood stage、Shadow contracts/engine/adapter dependency chain、GMGN signed/full rerun 的 PARK/READY 状态，以及大量已标 DONE 但没有被当前 ignored-run 机制认可的有效独立 auditor manifest。这个结果应推动“证据迁移/历史归档”和 Lean Harness，而不是直接重做 107 个产品功能；按新的风险配置，离线/私有/只读分析不应被该历史诊断阻断。

## 7. Git 历史信号

仓库总提交数为 412。对最近 100/50 个提交按触碰路径和 subject 做启发式单桶分类；merge/pathless commit 归入 other，分类用于方向判断，不是审计结论。

| 最近窗口 | audit/evidence | data processing | tests | product function | governance docs | harness/governance | other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 12 | 11 | 14 | 1 | 4 | 40 | 18 |
| 50 | 11 | 3 | 6 | 0 | 2 | 18 | 10 |

最近 100 的附加比例信号：

- 触碰 harness 的提交约 70%；
- governance-only（没有产品 src/apps/db/test 触点）约 54%；
- 触碰用户产品路径（src/apps/db/fixtures/test）的约 26%；
- process-fix signal（doctor/task/ledger/manifest/audit/repair/dispatch/governance/evidence 等 subject 或路径）约 79%。

结论：近期仓库主要在修复协作、证据和边界流程，产品功能推进很少。治理并非无价值，但当 process-fix 接近八成、而用户路径触点约四分之一时，下一阶段必须把审计产物绑定到真实 CA card、address library、replay 输出，而不是继续单独增长 Harness 表面积。

## 8. 主线优先级（Owner 直接授权的 7–10 天并行 MVP）

以下是主线工作流排序，不创建新的 Task Spec、ledger、dispatch、manifest 或独立审计 Agent；实施时按 Fast/Standard/Strict 风险档位取所需检查。

### 1. SOL32＋BSC30 立即导入 GMGN 并人工抽查

- 用户结果：直接使用已有的 SOL32 import pack 和 BSC 1,034 地址中首批 30 条 GMGN 备注，形成可读的观察钱包清单、人工抽查记录和未核验项列表。
- 输入：外部私有产物、现有 parser/normalizer、已有地址清洗/候选筛选结果；不把真实地址、原始备注或 provider payload 写入 Git。
- 最小动作：导入、抽查、标记 chain_checked/unknown/partial、记录差异；不重新生成 SOL1,433 清洗结果或 SOL32 pack，不把 BSC 私有观察误写为生产 adapter，也不自动写回 GMGN。
- 验收：SOL32＋BSC30 都可被人工打开和复核；抽查结论带 as_of、source/trust 标签；未核验字段保持 unknown/unverified；结果可以作为后续 10–15 地址选择和 replay 输入。
- 风险档位：本步骤是私有、离线、只读观察，Fast 或 Standard 足够；只有触及生产凭据、生产写入或真实交易时才升级 Strict。

### 2. 选 10–15 个重点地址做链上事实复核

- 用户结果：从 SOL32＋BSC30 观察钱包中选出 10–15 个重点地址，对 creator/funding/transaction shape/账户事实等可核对字段形成带来源和完整性状态的复核结果。
- 最小动作：按链使用 Owner 允许的只读来源，控制预算和范围；只更新选定记录，不做全量重抓，不做跨链身份合并，不把 borrowed label 升级为 verified。
- 验收：每个样本有 first-hand/borrowed/unknown、as_of、partial/completeness 和可解释差异；复核结果可被 replay 和最小 CA 卡消费。
- 风险档位：离线或私有只读分析不受 stage lock 阻断；涉及生产凭据或生产写入才进入 Strict。

### 3. 直接做离线可复制性 replay v0.1

- 用户结果：对选定 wallet/token 区分 wallet 实际表现与观察延迟下用户可能复制的表现，明确 fill/no-fill、delay、slippage、liquidity、fees、tax、non-fill 和 unknown。
- 最小动作：复用现有 shadow contract、FIFO/weighted-average 规则、fixture 和 observation schema；使用 source_trade_at、observed_at、simulated_order_at 三个时间并禁止 look-ahead；先做离线可复制路径，不做 Live Shadow。
- 不做：不连接 trading wallet、不签名、不 broadcast、不真实交易、不把未来高点当成交价、不以 BSC 生产 adapter 作为前置。
- 验收：相同输入输出稳定；成本后结果守恒；延迟/流动性影响 fill；缺少 fee/tax 不当作 0；每个 no-fill 有解释。
- 风险档位：实现或规则变更用 Standard（简短说明、相关测试、安全扫描、一次普通 review）；只有生产接线才 Strict。

### 4. 并行完成最小 CA 判断卡

- 用户结果：从 CA first 输入得到 mint/metadata/holder owner aggregation、watermark、completeness、warnings、address-library 命中和明确的 CA judgment；borrowed 字段始终标 unverified。
- 最小动作：复用 Helius live boundary、现有 holder cleaning、Pump decoder、AnalysisService、AddressLibrary contract 和 fixture；保持 bounded summary、partial fail-closed，不扩张新 provider/discovery/cron。
- 验收：fixture 与有界授权输入均能稳定输出；CA card 不把 borrowed label 当 chain fact；重复分析不产生重复 observation；敏感原始 payload 不落 Git。
- 风险档位：代码/fixture 变更用 Standard；生产凭据、不可逆 schema 或生产写入才升级 Strict。

### 5. 用观察和 replay 结果增量更新地址库和备注

- 用户结果：把人工抽查、重点地址复核和 replay 的可追溯结果回流到地址库与 GMGN 备注的私有工作流，保留新增/更新/无变化、chain_checked、unknown 和数据不足状态。
- 最小动作：只更新 changed/selected records；使用输入/输出计数、hash guard、ruleVersion 和 source watermark；不自动沉淀全部发现，不全量覆盖既有私有产物，不写回 GMGN。
- 验收：delta count 可解释；同输入 replay 稳定；未核验项不被升级；私有输出仍不 tracked；观察钱包 → 重点复核 → replay → note update 闭环可重复。
- 风险档位：离线/私有/只读增量用 Fast 或 Standard；生产 backfill、凭据或真实交易才 Strict。

### PARK / 后置范围

- BSC 生产 adapter、自动刷新、跨链 CA 生产主链、Robinhood、Live Shadow Trading、signing/broadcast/copy-trade CTA：PARK。
- 宏观 Dune、global liquidity、market dashboard、自动 top-token discovery、cron、automatic sedimentation、生产 PostgreSQL/Redis Console path：保留研究或代码候选，不挤占 MVP。
- 竞品 UI、Alpha Terminal、Telegram/social：ARCHIVE/DESIGN-FOR-LATER，不作为 implementation authority。

## 9. 当前与目标主线

两张 Mermaid 图和 7–10 天节奏见同目录的 PROJECT_MAINLINE_RESET_DIAGRAMS_2026-08-05.md。当前系统的关键断点是“观察钱包、重点事实复核、replay 和备注更新没有形成闭环；live CA first 仍只返回 bounded summary；library 没有由 CA 真正驱动；深度分析和 replay 没有形成可持久化/可验证用户结果”。目标系统把 SOL32＋BSC30 观察、selected verification、离线 replay、最小 CA card 和增量 note/library update 并行推进，Harness 作为按风险挂载的 sidecar，而不是产品流程本身。

7–10 天并行 MVP：

| 时间 | 主线交付 | 明确不做 |
| --- | --- | --- |
| Day 1 | SOL32＋BSC30 导入和人工抽查 | 不重新生成已有私有产物，不写回 GMGN |
| Day 2–4 | 重点地址离线 replay v0.1 | 不做 Live Shadow、签名、broadcast 或真实交易 |
| Day 2–5 | 10–15 个重点地址链上事实复核 | 不做全量重抓、跨链身份合并或 BSC 生产 adapter |
| Day 3–7 | 最小 CA 判断卡并行闭环 | 不接新 provider、discovery、cron 或生产 backfill |
| Day 6–10 | 观察/replay 结果回流和地址库/备注增量刷新 | 不把 borrowed/unknown 升级为 verified，不启动旧的串行长周期计划 |

## 10. 验证结果与残余风险

以下全仓测试、构建、security scan、doctor 和 lifecycle 数字是上一提交的审查基线；本次 Owner 对齐不重新运行全仓测试，不运行 Harness lifecycle，也不创建新的 evidence：

| 命令 | 结果 |
| --- | --- |
| npm ci | PASS |
| npm run typecheck | PASS |
| npm test | PASS；461 tests，460 pass、0 fail、1 skipped；skip 为需明确启用的手动 Helius live smoke |
| npm run build | PASS |
| npm run security:scan | PASS；316 条 policy match，classified leaks 0 |
| git diff --check | PASS |
| npx tsx harness/cli.ts doctor | FAIL，且为基线问题；3 个 forbidden wallet*.json tracked matches，未由本审查新增 |
| npm run harness:status | PASS；active solana-pumpfun-e2e，blocked bsc/robinhood，3 READY |
| npx tsx harness/cli.ts lifecycle plan | diagnostic；runnable 3、not runnable 38、sync errors 0、107 audit-evidence gaps、1 readiness suggestion |

本次修订只做以下窄范围验证：三个审查文件的 JSON 解析、Mermaid 基本语法检查、`git diff --check` 和 privacy scan；不把上一提交的全仓基线误报成本次重跑结果。

Doctor 的三个 baseline match 是 wallet artifact rule 的现有问题，和当前 Draft PR #19/#20 对应；本次没有借审查权限修改它们。其风险是如果把 doctor 单一 FAIL 作为所有任务的硬门，会阻断无关的文档/聚合审查；其安全价值是不能让新的 wallet artifact 进入 Git，这条边界必须保留。

### 10.1 本报告的隐私扫描要求

报告、Inventory JSON、Diagrams 三个新文件必须满足：

- local absolute paths：0；
- full Solana addresses：0；
- full EVM addresses：0；
- transaction hashes：0；
- API key/cookie/credential：0。

私有真实数据只以数量、覆盖率、状态和可复现性级别呈现。若未来要把私有运行结果作为 evidence，必须重新生成 scrubbed manifest，不得把外部原始目录复制到 Git。

## 11. 最终交付边界

本次审查只应提交以下三个文件：

1. docs/audits/PROJECT_MAINLINE_RESET_AUDIT_2026-08-05.md
2. docs/audits/PROJECT_MAINLINE_RESET_INVENTORY_2026-08-05.json
3. docs/audits/PROJECT_MAINLINE_RESET_DIAGRAMS_2026-08-05.md

交付 commit message：docs: align mainline reset with owner priorities
Draft PR title：docs: audit project mainline and reset priorities

starting HEAD：e365d52ccdec8bcba1f1b5fa22cd3e25103142e2

不创建 Task Spec、ledger、manifest 或独立审计 Agent；不修改产品代码或 Harness；不创建 Ready PR，不 merge，不 squash/rebase，不 force-push，不修改共享 checkout，不修改、关闭或合并其他 PR。
