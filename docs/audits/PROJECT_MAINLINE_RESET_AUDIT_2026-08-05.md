# PROJECT MAINLINE RESET AUDIT 2026-08-05

> 项目：memecoin-ca-data-layer
> 任务：PROJECT-MAINLINE-RESET-AUDIT-001
> 审查身份：codex-project-mainline-auditor-001
> 审查基线：origin/main @ fce42eeb560c85e4924399bdf08419f9ea7ba642
> 审查分支：audit/project-mainline-reset-2026-08
> 结论性质：Owner 直接授权的只读产品主线审查；本次只新增本报告、Inventory JSON、Diagrams，不修改产品代码和 Harness 注册内容。

## 执行摘要

仓库当前是一个“规则和离线骨架已经很厚、用户可直接复现的主链仍很窄”的研究/运营数据层。最值得继续投入的主线是：

CA 输入与校验 → Helius 只读链上事实 → 完整 holder owner 聚合与地址清洗 → 地址库命中/沉淀 → CA first-screen 卡片 → 32 个 SOL 候选的 GMGN 备注导入 → 有延迟、滑点、费用、税和不可成交语义的离线历史回放。

当前主线并非 SOL 全量 E2E，也不是可生产的多供应商热路径。代码、测试与文档明确表明：

- Solana 的 mint、metadata、完整 token-account 读取、规则测试和 Pump 版本化解码已有可复用能力；但是 live Helius 数据源的 address tags、wallet facts、holder snapshot、Pump creator evidence、Dev history 仍未闭合到完整 AnalysisService 路径。
- CA-first live 入口只返回三项有无/数量/完整性摘要，不调用 AnalysisService、地址库、持久化、队列或推断层；Operator Console 的默认数据仍是 fixture。
- hot-path 卡片的市场、安全、holder 是 fixture-backed borrowed/unverified；library lookup 只接受调用方另传的 candidateWallets，粘贴 CA 本身不能产生真正的地址库命中。
- SOL 1,433 个地址和 32 个候选、BSC 1,034 个有效地址和前 30 导入在私有输出中有数量级产物，但没有成为 Git 中的真实地址/原始备注，也没有因此自动获得链上确认或生产主链地位。
- FIFO/weighted-average 的 first-hand leaderboard 规则存在，治理 Harness 也有一个通用 replay suite；但真正的 wallet shadow replay engine、现实执行成本模型和链上适配器尚未落入 src。不能把治理对象的“deterministic replay”当成交易回放已经可用。
- BSC、Robinhood、自动发现、cron、实时增长循环、宏观 Dune、生产 PostgreSQL/Redis、Live Shadow Trading 均被现有阶段锁或 Owner 决策挡住。BSC 私有导入不是解除阶段锁的理由。

### 总体判定

建议把接下来四周收敛为一个 SOL-only、手动触发、Helius-only、证据可复现的产品主线。P0 不是继续增加更多研究面，而是把已有能力接成一条用户能走完、失败会明确降级、再次运行能复现的 CA→判断链。

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
| CA / wallet 输入 | SOL manual CA-first；单个和 1–10 批量入口有严格地址校验；wallet 侧有私有 1,433 输入清洗代码 | CA-first live 是受限 Helius read-only；Console 默认 fixture；1,433 输入在外部私有目录 | Helius 链上读取可作 A 类输入，但当前结果只是 bounded summary | 无 discovery、无自动 daily、无完整 CA card；live full fact 还受 Helius adapter 缺口和 live task evidence gate 阻塞 |
| 第三方事实数据 | free-provider ports + borrowed market/security/holder interfaces；实现主要是 fixture provider；GMGN 有 parser/transport diagnostics | fixture/离线为正式 Git 主线；GMGN 运行产物和 32 候选 pack 在私有目录；没有正式 live multi-provider adapter | 一律 borrowed/unverified，不能覆盖链上事实 | Owner 已把当前 runtime 收窄为 Helius-only；因此旧 dispatch 中“全免费多供应商热路径”应改为可选 Tier-B，而不是继续扩张 |
| 链上校验 | LiveHeliusDataSource 可读 mint、metadata、完整 token accounts、部分 transaction history；Pinned Pump decoder 支持 create_v2/buy/sell/migrate fixture | live Helius 是受限公共 CA smoke；Pump decoder 和 adapter fixture 是正式 Git；full Pump/PumpSwap live E2E 未闭合 | mint/owner account 是 first-hand 输入；Pump creator/Dev/holder audited facts 在 live 数据源仍不可用 | live data source 的 getAddressTags/getWalletFacts 直接 fail closed；可选 audited holder/pump/dev 方法未实现，AnalysisService 因此只能 indeterminate |
| 地址清洗 / labels | Base58 normalize、dedupe、owner aggregation、exclusion reason/confidence/evidence/ruleVersion；candidate screening、master table、chainfm cleaner 已有 | 规则和 fixture 在 Git；SOL 1,433 master/candidate 输出私有；label 默认 unverified | 借用 label 不升级为 verified；first-hand confirmation 分开 | CA→address library 没有从粘贴 CA 的用户路径闭合；in-memory library 主要用于 offline acceptance，Postgres 为 later |
| 市场 / 流动性上下文 | append-only market_observations selection；hot-path 可以展示 price/liquidity/FDV 的 fixture quote | 仅离线 append-only / fixture；没有 live Dexscreener/Birdeye/Gecko adapter | B 类 borrowed/unverified；只用于上下文和阈值辅助 | live card 没有可依赖的市场来源；宏观 Dune 有研究/离线设计但不应挡住 SOL CA-first |
| CA judgment | AnalysisService 在 fixture/接口上组织 market、holders、trades、transfers、funding、tags、wallet facts、holder concentration、creator/Dev/large-order 等 | 规则和 fixture 可复现；完整 live output 还不是正式主链 | first-hand 与 borrowed 分层明确；partial 会 warnings/completeness | Helius live 先在 tags/facts 处失败；没有从 live CA first 入口进入 AnalysisService 的正式全链路 |
| GMGN notes | parser/transport/normalization、candidate screening 和私有导入产物存在；不会自动写回 GMGN | SOL 1,433 → 32 候选/32 import rows；BSC 1,034 → first 30 import rows；均为外部私有产物，不在 Git | provider fields borrowed/unverified；不能称为链上已确认智能钱 | 缺一个 32 条中文简洁导入、更新、变更、chain-check 状态都明确的收口命令；禁止把 notes 反写 GMGN、禁止把平台 label 变 verified |
| 历史 buy/sell 与 leaderboard | first-hand FIFO/weighted-average realized PnL 规则、borrow-then-confirm leaderboard 和 fixture replay suite 已有 | 规则/fixture 正式；部分 wallet profile/holdings history 只在私有或诊断产物；没有完整生产回放 | confirmed 只来自 first_hand swap evidence 且 completeness=1 | 没有交易 shadow replay engine；当前 generic replay 不是交易执行回测，无法回答“观察延迟后用户是否可成交” |
| 可复现性 | ruleVersion、input/output hash、source watermark、scrubbed manifests、四个 Harness dimensions、461 个测试 | Git fixture 和 scrubbed evidence 正式；Harness runs ignored，历史 runs 缺失 | 代码/fixture 可复现；历史 DONE 的 audit closure 不一定可 lifecycle 验证 | lifecycle plan 报告 107 个 audit-evidence gaps；“报告写了 PASS”不等于“有独立有效 auditor run” |

### 3.2 私有数据聚合核对

只记录聚合，不把真实地址或原始 GMGN/链响应写入 Git：

- SOL 侧：唯一输入地址计数 1,433；候选 union 32；中文导入 pack 32；私有输出同时有 master、质量报告、replay manifest 和候选差异统计。
- BSC 侧：唯一有效 EVM 地址计数 1,034；私有 source inventory 5,170 行引用、5 个来源、地址格式通过率 100%；紧凑导入前 30；私有候选 review 32；但 PnL/cost basis 覆盖率不能因此被解释为链上 verified。
- 私有输出总量约 3,967 个文件、约 81 MB；BSC 约 3,442 个、SOL 约 514 个，其余为聚合/清单。它们位于外部 CHAINFM_OUT_DIR，未纳入 Git。
- SOL 1,433 全量重抓、累计 PnL、GMGN signed/cumulative、BSC chain verification 都不应因“已有私有文件”直接改成生产 GREEN；必须经过当前阶段、独立审计和 source watermark/规则版本绑定。

### 3.3 关键问题的直接回答

#### SOL 1,433 → 32、GMGN 中文导入

这条数据准备链已经有可复用的 clean-rank、candidate screening、hash guard 和私有 32 条导入形状，但“有产物”与“用户可用”之间还差三件事：稳定的 32 条 schema、增量刷新/变更输出、明确的链上确认列。建议 P0 只收口为“私有、手动、可重复、借用字段带 unverified 的中文导入 pack”，不做 GMGN 页面/API 写回，不把候选名称改成 confirmed。

#### BSC 1,034 → 前 30

数据层面已有 inventory、质量覆盖和 first-30 import 的私有聚合；产品层面仍是 BLOCKED_STAGE。当前 Constitution/Owner decision 明确要求 Solana E2E GREEN 后才可重新讨论 BSC，故本次不建议创建“BSC 已完成”主线，也不建议为导入产物绕过 stage lock。

#### 外部链验证

SOL 侧可做有限、手动、Helius-only 的 selected verification；可以确认 mint/account/transaction shape、creator precedence、funding edge 等有证据的字段，但当前 full AnalysisService live path 会撞到 tags/facts/audited fact 缺口。1,433 和 1,034 的全量“已链上确认”均不成立。

#### 热路径、流动性 / 宏观、holder / dev / funding / cluster

hot-path 代码已经有并行扇出、2 秒虚拟 P95 budget、degrade warnings 和 async deep-dive enqueue；但 latency 仍是 caller-declared virtual latency，不能当真实 provider wall time。holder/dev/funding/cluster 规则骨架和测试较好，holder 只有在 complete owner snapshot 与 pinned creator 前提下才能出可信 concentration/dev；market/liquidity 是 append-only offline enrichment；宏观 Dune 不应成为 CA-first 的前置依赖。

#### trade history、积分/表现、delay/slippage/fees/taxes/non-fill

当前有 wallet stats/holdings diagnostics、first-hand PnL 规则和少量历史 evidence，但没有一套正式的“观察到交易 → 延迟后下单 → as-of 价格 → 流动性约束 → fill/no-fill → 成本后结果”引擎。缺失字段不能当 0，same-mint transfer 不能当 swap，未来价格不能回填。第一步应是简单的离线 replay contract/engine；完整 Live Shadow Trading 不应先于它，也不应成为简单 replay 的前置门槛。Live observation 仍要等 replay、适配器、数据安全审计和 Owner 网络授权。

## 4. 产品与工程面分类

分类含义：KEEP 保留既有硬边界或稳定规则；SIMPLIFY 减少表面积；MERGE 合并重复实现/证据链；PARK 保留但不进当前主线；ARCHIVE 保留为历史研究；DELETE_CANDIDATE 只表示可再生成/可清理候选，本次不执行删除；MAINLINE_NOW 表示四周内应直接产出用户结果。

### 4.1 产品面

| 面 | 分类 | 审查意见 |
| --- | --- | --- |
| CA 输入、严格地址校验、手动入口 | KEEP | 这是低成本的主入口和安全边界，继续保留 fail-closed |
| Helius mint/metadata/token-account live read | MAINLINE_NOW | 作为 SOL-only first-hand 起点，但必须把 watermarks/partial 直接带到卡片 |
| owner aggregation、余额清洗、exclusion evidence | KEEP | 这是项目差异化的事实层，不能被 borrowed top-N 替代 |
| Pump creator precedence、版本化 decoder、fixture | KEEP | create.creator precedence 和 pinned fixtures 是高信任基础 |
| Dev history | SIMPLIFY | 只基于完整 creation-to-now normalized trades；不完整就 null/warning，不扩张假设 |
| funding edge、service-funder suppression、cluster rules | KEEP | 保留 evidence/confidence/ruleVersion 和可逆快照 |
| alpha、bot/sniper、independent-smart-money detector | KEEP | 只做 judgment layer，不把 label 当 chain fact |
| address library exact lookup | MAINLINE_NOW | 从 CA first-screen 真正传入 holder candidates，先完成 SOL-only |
| sedimentAnalysis / wallet-token-edge wiring | MERGE | 把 in-memory acceptance、Postgres adapter 和 AnalysisService after-analysis hook 统一在一个 contract |
| append-only market observation | SIMPLIFY | 先保留离线 observation/context；不再把多供应商 live 设计当作当前事实 |
| CA hotpath card | MAINLINE_NOW | 接 Helius holder facts、library hit、可选 unverified context 和明确 completeness |
| AnalysisService full audited Solana path | MAINLINE_NOW | 这是从 smoke 到产品的关键连接，不另造第二套 CA 判断器 |
| GMGN parser / transport diagnostics | MERGE | parser contract 保留；重复的 transport repair/audit chain 归并为少量可复现 schema fixtures |
| SOL 1,433 profile/master refresh | MAINLINE_NOW | 只做私有、手动、增量和 hash-bound refresh，不宣称全量链上 verified |
| SOL 32 Chinese GMGN import pack | MAINLINE_NOW | 作为用户直接可复制/审阅的脱敏产物收口 |
| BSC 1,034 / first-30 import | PARK | 私有产物可留存，阶段锁未解除 |
| selected SOL external chain verification | MAINLINE_NOW | 先做 5–10 个手动样本/候选的事实核对，沉淀方法和可复现 manifest |
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
| required-reading chain、Constitution、stage lock、no-trade/no-secret | KEEP | 属于不可弱化的硬边界 |
| task schema、hash、write-set、forbidden action 校验 | KEEP | 继续保护安全和可追溯性 |
| typecheck/test/build/security scan/diff check | KEEP | 代码任务的最小质量门 |
| T2 独立 auditor 身份和 fail-closed evidence | KEEP | 高风险/数据语义任务必须保留 |
| manifest、watermark、source hash | SIMPLIFY | 对 provider/data/replay 任务保留；纯文档和本次 Owner audit 不应强制虚构 run |
| 全部工作串行 run | SIMPLIFY | 只锁定同一共享 run/overlap；不把所有离线研究串成一个队列 |
| 每项工作必须精确 dispatch、偏离即 PARK | SIMPLIFY | 对产品代码任务保留；Owner 审查、只读汇总、私有研究应走轻量路径 |
| task spec 与 ledger 的 canonical sync | MERGE | 统一生成/校验入口，消除 57 个 unledgered specs 和非标准状态 |
| 重复 GMGN audit/repair/evidence chain | MERGE | 按 parser、transport、live gate 三个主题聚合，减少修复循环 |
| 没有有效 run manifest 的历史 DONE reports | ARCHIVE | 可读作历史记录，但不再作为 lifecycle audit closure |
| 根路径与 harness/路径不一致 | SIMPLIFY | 统一入口或给一个 canonical redirect |
| harness:doctor 对无关文档任务的全仓强阻塞 | SIMPLIFY | 仍扫描 secrets/wallet artifacts；把与 write set 无关的既有 baseline 分层为 warning |
| npm build 生成的忽略 .js/.d.ts | DELETE_CANDIDATE | 可再生成；本次没有删除，正式统计已排除 |

分类计数：MAINLINE_NOW 9、KEEP 9、SIMPLIFY 8、MERGE 4、PARK 7、ARCHIVE 3、DELETE_CANDIDATE 1。计数覆盖上面 41 个产品/治理面；没有任何删除动作。

## 5. Harness 审查：保留什么、减轻什么

### 5.1 A 类：必须保留的硬边界

1. 禁止 secret、wallet artifact、raw provider payload、交易签名、broadcast 和 real trade；security scan 必须 fail closed。
2. BSC/Robinhood stage lock、SOL-only 当前 active chain、Owner live gate；不能因私有文件或文档研究越过。
3. raw integer、transfers 不等于 sales、owner aggregation、borrowed/unverified、partial/completeness、creator precedence 等产品事实规则。
4. task schema/hash、write-set、forbidden actions、tracked input 检查；防止“报告说做了但代码没进 Git”。
5. typecheck/test/build/diff-check；数据任务再加 source watermark、double-run hash、record counts。
6. T2 实现与最终 auditor 身份分离；一旦出现 FAIL，必须开明确 repair 链。

### 5.2 B 类：保留但按风险轻量化

- 四个 Harness dimensions：latency、replay、source-degradation、label-decision 仍有价值；扩充应绑定真实 product path，而不是增加更多纯 governance cases。
- Standard acceptance：代码、provider adapter、replay 和 data cleaning 任务保留 typecheck/test/build/security/diff；纯文档、聚合审查用 Fast。
- manifest/source hash：provider/data/replay 和私有输出继续保留，但路径使用外部 alias，Git 只保存 scrubbed aggregate。
- lifecycle readiness：保留自动发现依赖完成和审计证据缺口的能力，但不能把它当成所有工作都必须长期占用的协作锁。

### 5.3 C 类：当前造成延迟或重复的 over-constraint

- “所有 agent 只执行 exact task spec”无法覆盖 Owner 直接授权的全仓审查；本次例外证明需要一个受控 audit role。
- 对纯文档、轻量私有聚合、研究型 replay 设计也强制完整 task/manifest/independent-run，会把证据工作变成主线瓶颈。
- shared worktree 全树串行适合会改代码的 Harness run，不应约束彼此不重叠的只读分析。
- lifecycle 目前把 107 个 DONE 关联项判为 evidence gap，因为 ignored run 目录没有可验证 finished manifest；这更像历史证据迁移缺口，不等同于 107 个产品实现全部错误。
- harness:doctor 当前因三项既有 wallet*.json tracked 内容失败；对真正修改产品代码的任务应阻塞，对只写本审查文档不应要求“先修完别人的 baseline”。
- dispatch 文档声明的多供应商 hot-path 与当前 Owner 决定的 Helius-only runtime 不一致，应以 Owner 决定覆盖旧 blueprint。

### 5.4 Lean Harness 建议

| 模式 | 适用 | 必做 | 不必做 |
| --- | --- | --- | --- |
| Fast | 只读审查、文档、脱敏汇总、fixture 研究 | required-reading、diff/privacy scan、JSON/schema 自检、明确不改产品/ledger | run start/finish、独立 auditor、全仓 doctor、完整 manifest |
| Standard | 产品代码、规则、fixture adapter、CA card、offline replay | write-set、typecheck/test/build/security/diff、相关四维 suite、source/hash/replay 证据、一次同行审查 | 与目标无关的 live provider、全量历史 audit closure |
| Strict | live credential、真实 provider、敏感数据、阶段切换、不可逆 schema/生产写入 | Owner gate、secret scan、预算/timeout、tracked scrubbed manifest、独立 auditor、stage/ledger/lifecycle、回滚/保留策略 | 无明确授权的自动化、交易和跨链扩张 |

Lean Harness 的原则是“风险驱动，不是证据样式驱动”。现有 hard boundary 继续存在；需要减轻的是低风险工作被同一种 Strict 流程阻塞，以及历史 reports 与 ignored runs 之间的断裂。

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

直接运行 npx tsx harness/cli.ts lifecycle plan 的脱敏摘要：

- runnable 3 个；
- not runnable 38 个；
- sync errors 0；
- audit-evidence gaps 107；
- readiness suggestion 1 个。

阻塞的主要来源是：BSC/Robinhood stage、Shadow contracts/engine/adapter dependency chain、GMGN signed/full rerun 的 PARK/READY 状态，以及大量已标 DONE 但没有被当前 ignored-run 机制认可的有效独立 auditor manifest。这个结果应推动“证据迁移/历史归档”和 Lean Harness，而不是直接重做 107 个产品功能。

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

## 8. P0 / P1 / P2 优先级

### P0：把 SOL CA 主线做成可复现用户结果

1. **SOL-CA-FIRST-CARD-AND-FACTS-001**
   - 用户结果：粘贴一个公开 SOL CA，得到 mint/metadata/holder owner aggregation、watermark、completeness、可解释 warnings 和明确的 CA 判断卡；市场/安全等 borrowed 字段若存在必须标 unverified。
   - 输入：公开 CA、Helius process-only credential、现有 fixture pack、holder cleaning、Pump decoder、AnalysisService。
   - 最小实现：补齐 live Helius boundary 到 audited holder snapshot/Pump creator/Dev history 的最小闭环；从 CA first 进入 AnalysisService；保留 Helius-only、请求预算、partial fail-closed；不复制第二套规则引擎。
   - 不做：不接新 provider、不做 discovery/cron、不写交易、不把 top-100 borrowed concentration 当链上事实。
   - 短验收：一组 pinned fixture 与一组授权 public CA 各跑两次；source watermark、owner completeness、creator precedence、warnings 和 scrubbed hash 可复现；typecheck/test/build/security/diff 通过。
   - 独立审计：T2 read-only auditor，核对输入边界、partial 语义、provider budget、无 raw payload/secret 和卡片字段信任。
   - 依赖/复用：复用 LiveHeliusDataSource、HeliusSolanaAdapter、SolanaHolderSnapshotService、Pump decoder、AnalysisService、ca-holder API contracts。

2. **SOL-CA-ADDRESS-LIBRARY-WIRING-001**
   - 用户结果：CA card 的清洗 owner/候选地址可以命中地址库，并把有证据的 wallet/token edge 写成可追溯观察；再次分析同一 CA 不产生重复 observation。
   - 输入：任务 1 的 complete holder snapshot、funding edges、ruleVersion、source watermark、现有 AddressLibrary contract。
   - 最小实现：把 sedimentAnalysis 接到明确的 after-analysis seam；统一 in-memory fixture 与 Postgres adapter contract；为 CA→lookup 命中补测试。
   - 不做：不自动沉淀所有发现、不跨链合并、不把 borrowed GMGN label 变 verified、不开放生产 backfill。
   - 短验收：fixture double-run 输出相同；selected live/manual CA 只写 scrubbed structured observation；verified 只能由 first_hand evidence 进入；partial 不写伪完整结论。
   - 独立审计：核对重复 fingerprint、borrowed/first-hand promotion、owner aggregation 和可逆性。
   - 依赖/复用：InMemoryAddressLibrary、PostgresAddressLibrary、observation schema、holder cleaning tests、existing trust rules。

3. **SOL-GMGN-32-CHINESE-IMPORT-REFRESH-001**
   - 用户结果：把私有 SOL 1,433 输入稳定收敛成 32 条简洁中文 GMGN 导入/审阅 pack，并能重复刷新、显示新增/更新/无变化和链上核验状态。
   - 输入：外部 CHAINFM_OUT_DIR 中已授权的 normalized profile、source hash、candidate union、既有 parser output。
   - 最小实现：固定 32 条 schema；字段按 borrowed/unverified、chain_checked、unknown、as_of、ruleVersion 分栏；同输入输出 hash；变更 diff 只写聚合；不改原始 notes。
   - 不做：不把 notes 自动写回 GMGN、不提交地址/原始备注/provider payload、不宣称 1,433 全量 verified、不使用签名页面自动化。
   - 短验收：32 条 record count；两次相同输入 hash 相同；privacy scan 通过；缺失字段保持 null/unknown；README/报告可用外部 alias 复现。
   - 独立审计：零网络、只读私有输出和 committed parser；验证脱敏、计数、hash、状态语义。
   - 依赖/复用：clean-solana-address-directory、candidate-screening、master-table-builder、GMGN parser/normalizer、replay manifest。

### P1：建立可解释的可复制性，而非只展示 wallet PnL

4. **SOL-WALLET-REPLAY-V0-1-001**
   - 用户结果：对于选定 wallet/token，分开显示 wallet 实际表现与用户在观察延迟下可能复制的表现；明确 fill/no-fill、滑点、流动性约束、手续费、税和未知项。
   - 输入：pinned Solana swap/transfer fixtures、first-hand normalized swaps、append-only market observations、手动 observed_at/latency scenarios。
   - 最小实现：先落 shadow contracts + deterministic replay engine + SOL adapter；5m/30m/2h/24h window；source_trade_at、observed_at、simulated_order_at 三时间；no-lookahead；unfillable 不计盈利；复用 FIFO/weighted rule。
   - 不做：不连 trading wallet、不 broadcast、不做 resident monitor、不先做 BSC adapter、不把未来高点当成交价。
   - 短验收：相同输入两次输出 hash 相同；成本后结果守恒；延迟/流动性变化会影响 fill；tax/fee missing 不当 0；replay report 能解释每个 no-fill。
   - 独立审计：T2 auditor 检查时间因果、金额守恒、成本模型、unknown/null、source/verification 标签。
   - 依赖/复用：现有 shadow task contract 设计、token-profit-leaderboard、Harness replay suite、market observation schema；Live Shadow Observation 仍 PARK。

5. **SOL-1433-INCREMENTAL-REFRESH-AND-VERIFY-001**
   - 用户结果：对 1,433 地址做预算可控的增量更新，对 32 候选和少量手动样本做 first-hand chain verification，用户能看到“未检查/借用/已核验/数据不足”而不是一个总分。
   - 输入：私有 1,433 master/replay manifest、previous source hash、5–10 个手动选定样本、Helius free budget。
   - 最小实现：输入/输出计数和 hash guard；只更新 changed/selected records；核验 creator/funding/trade shape 的证据包；选定结果进入 replay/library，不把全量 profile 直接升级。
   - 不做：不做自动发现、全量无预算重抓、跨链身份合并、GMGN signed automation。
   - 短验收：同输入 replay；delta count 可解释；预算耗尽显式 DEGRADED；私有输出未 tracked；独立审计能从 manifest 重算聚合。
   - 独立审计：零 provider 或按 Owner 明确授权的 bounded live read 分开审；不能用旧 report 代替新 evidence。
   - 依赖/复用：wallet profile pilot、master table、data-quality report、provider executor、source hash/replay manifest。

### P2 / PARK：有价值但不应挤占当前主线

- BSC 1,034 / first-30：等 Solana E2E GREEN 和 Owner stage activation；不借私有 coverage 绕过 stage lock。
- 宏观 Dune、global liquidity、market dashboard：保留研究与 observation schema，等 CA-first 可用后再排。
- 自动 top-token discovery、cron、automatic sedimentation：只保留 manual/offline implementation，等 Owner 明确启用。
- Postgres/Redis production console path：等待部署目标、backfill 和保留策略决策。
- Live Shadow Observation、cross-chain HUD、Robinhood：等待 replay/adapter/audit/Owner gates；不作为简单 replay 前置。
- 竞品 UI、Alpha Terminal、Telegram/social：ARCHIVE/DESIGN-FOR-LATER，不作为 implementation authority。

## 9. 当前与目标主线

两张 Mermaid 图和四周节奏见同目录的 PROJECT_MAINLINE_RESET_DIAGRAMS_2026-08-05.md。当前系统的关键断点是“live CA first 只返回 bounded summary、hotpath 依赖 fixture/borrowed、library 没有由 CA 真正驱动、深度分析和 replay 没有形成可持久化/可验证用户结果”。目标系统把同一套 Helius facts、cleaning、library、judgment 和 replay 作为一条主线，Harness 作为按风险挂载的 sidecar，而不是产品流程本身。

四周建议节奏：

| 周 | 主线交付 | 明确不做 |
| --- | --- | --- |
| 第 1 周 | Helius audited facts 最小闭环、CA card、partial/watermark、live/fixture 双验收 | 新 provider、自动发现、BSC |
| 第 2 周 | CA→address library sedimentation、SOL 32 中文导入 pack、增量 refresh schema | GMGN 写回、全量 1,433 chain verification |
| 第 3 周 | replay contracts/engine/SOL adapter，现实成本和 no-fill | Live shadow、交易 |
| 第 4 周 | 5–10 个手动样本 chain verification、replay 与 library 交叉验收、历史 evidence 归档 | 宏观/跨链/cron/生产 DB |

## 10. 验证结果与残余风险

在独立审查工作树执行：

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

交付 commit message：docs: audit project mainline and harness scope
Draft PR title：docs: audit project mainline and reset priorities

不创建 Ready PR，不 merge，不 squash/rebase，不 force-push，不修改共享 checkout，不删除任何文件。
