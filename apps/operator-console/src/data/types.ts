export type TrustLabel = "CONFIRMED" | "UNVERIFIED" | "PARTIAL" | "UNAVAILABLE";
export type ExclusionCoverage = "complete" | "partial" | "unavailable";
export type TaskStatus = "queued" | "running" | "completed" | "partial" | "failed" | "blocked";

export interface ConcentrationMetricView {
  numerator: string;
  denominator: string;
  ratio: number | null;
  verificationStatus: "confirmed" | "unverified";
}

export interface DataQualityIssueView {
  code: string;
  severity: string;
  affectedRecordCount?: number;
  affectedBalance?: string;
  whetherManualReviewRequired?: boolean;
  evidence?: string[];
}

export interface CaScanListItem {
  mint: string;
  status: "OK" | "PARTIAL" | "REJECTED" | string;
  symbol: string | null;
  name: string | null;
  accountingEligible: boolean;
  exclusionCoverage: ExclusionCoverage;
  concentrationEligible: boolean;
  observedAt: string;
  dataSource: string;
}

export interface CaScanViewModel extends CaScanListItem {
  decimals: number | null;
  mintSupplyRaw: string | null;
  sourceWatermark: string;
  provider: string;
  heliusRequestCountHistorical?: number;
  judgmentEligibleDeprecated: boolean;
  accounting: {
    mintSupplyRaw: string;
    enumeratedTokenAccountBalanceRaw: string;
    includedOwnerBalanceRaw: string;
    excludedBalanceRaw: string;
    unresolvedBalanceRaw: string;
    accountingResidualRaw: string;
    accountingResidualRatio: number | null;
    completeness: string;
    paginationComplete: boolean;
    residualReasons: string[];
    identity: string;
  };
  ownerCounts: {
    total: number;
    included: number;
    excluded: number;
    unresolved: number;
    tokenAccounts: number;
  };
  paginationComplete: boolean;
  concentration: Record<string, ConcentrationMetricView | null>;
  concentrationWarnings: string[];
  issues: DataQualityIssueView[];
  universeDefinition: string;
}

export interface WalletListItem {
  id: string;
  fingerprint: string;
  tier: string;
  status7d: string;
  status30d: string;
  completeness: number;
  warnings: string[];
  verificationStatus: "unverified" | "confirmed";
}

export interface WalletViewModel extends WalletListItem {
  disclaimer: string;
  observedAt: string;
  caHitsPlaceholder: string;
  labels: Array<{ label: string; source: string; confidence: number; verificationStatus: string }>;
  note: string;
}

export interface WalletPoolSummary {
  alpha: number;
  tierBUsablePool: number;
  tierBShortlist: number;
  manualReview: number;
  unavailablePeriodWallets: number;
  mapped: number;
  partialApproxPct: number;
  source: string;
  verificationStatus: string;
  disclaimer: string;
  observedAt: string;
  wallets: WalletListItem[];
}

export interface AddressLabelViewModel {
  id: string;
  display: string;
  labels: Array<{ label: string; source: string; confidence: number; verificationStatus: string }>;
  note: string;
}

export interface LocalDemoLabelInput {
  addressId: string;
  label: string;
  note?: string;
  confidence?: number;
}

export interface TaskViewModel {
  taskId: string;
  input: { mint?: string };
  provider: string;
  status: TaskStatus;
  requestBudget: number;
  requestsUsed: number;
  startedAt: string | null;
  endedAt: string | null;
  warnings: string[];
  outputLink: string | null;
  failureReason: string | null;
}

export interface OperatorConsoleDataSource {
  listCaScans(): Promise<CaScanListItem[]>;
  getCaScan(mint: string): Promise<CaScanViewModel | null>;
  listWallets(): Promise<{ summary: WalletPoolSummary; items: WalletListItem[] }>;
  getWallet(walletId: string): Promise<WalletViewModel | null>;
  listAddressLabels(): Promise<AddressLabelViewModel[]>;
  saveLocalDemoLabel(input: LocalDemoLabelInput): Promise<void>;
  listTasks(): Promise<TaskViewModel[]>;
  getTask(taskId: string): Promise<TaskViewModel | null>;
  createLocalDemoTask(mint: string): Promise<TaskViewModel>;
  getDataSourceMeta(): { mode: "fixture" | "http"; live: boolean; note: string };
}
