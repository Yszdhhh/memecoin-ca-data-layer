export type WalletChain = "SOL" | "BSC";

export type IdentityStatus =
  | "VERIFIED_IDENTITY"
  | "STRONG_ALIAS_CLUSTER"
  | "WEAK_ALIAS_CLUSTER"
  | "HANDLE_ONLY"
  | "UNKNOWN";

export type SocialMappingStatus =
  | "VERIFIED_WALLET_MATCH"
  | "MULTI_SOURCE_MATCH"
  | "HANDLE_ONLY"
  | "NO_MATCH";

export type WalletTier = "CORE" | "WATCH" | "LEAD" | null;

export type WalletLifecycleStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "STALE"
  | "EXCLUDED_CONTRACT"
  | "DEMOTED"
  | "EXCLUDED_DATA_QUALITY";

export interface WalletSocialInput {
  x_handle?: string | null;
  x_display_name?: string | null;
  x_followers_exact?: number | null;
  x_followers_compact?: string | null;
  x_verified_status?: string | null;
  wallet_social_mapping_status?: SocialMappingStatus;
  social_sources?: string[];
  social_observed_at?: string | null;
  social_confidence?: number | null;
}

export interface WalletStatsInput {
  win_rate_30d: number | null;
  payoff_ratio: number | null;
  pnl_7d: number | null;
  pnl_30d: number | null;
  trade_count_7d: number | null;
  trade_count_30d: number | null;
  profitable_token_count: number | null;
  losing_token_count: number | null;
  token_count: number | null;
  multi_token_repeatability: string | null;
  pnl_concentration: string | number | null;
  activity_recency?: string | null;
  last_active_at: string | null;
  provider_data_quality: string | null;
  provider_data_status?: string | null;
  provider_pnl_status?: string | null;
  provider_pnl_source?: string | null;
  provider_pnl_confidence?: string | null;
  pnl_currency?: string | null;
  verification_status: string | null;
  replay_followability_status: string | null;
  average_profit_per_trade?: number | null;
  average_loss_per_trade?: number | null;
  data_completeness?: number | null;
}

export interface WalletLibraryInputRecord {
  chain: WalletChain;
  address: string;
  address_type: "EOA" | "CONTRACT" | "UNKNOWN";
  labels: string[];
  current_note: string | null;
  source_count: number | null;
  identity_last_verified_at: string | null;
  identity_verified?: boolean;
  social?: WalletSocialInput;
  stats: WalletStatsInput;
}

export interface WalletLibraryInput {
  schema_version: "wallet-library-input-v1";
  as_of: string;
  source_versions: Record<string, string>;
  input_hashes: Record<string, string>;
  wallets: WalletLibraryInputRecord[];
}

export interface WalletSocialEnrichment {
  x_handle: string | null;
  x_display_name: string | null;
  x_followers_exact: number | null;
  x_followers_compact: string | null;
  x_verified_status: string | null;
  wallet_social_mapping_status: SocialMappingStatus;
  social_sources: string[];
  social_observed_at: string | null;
  social_confidence: number | null;
}

export interface WalletLibraryRecord {
  chain: WalletChain;
  address: string;
  address_type: "EOA" | "CONTRACT" | "UNKNOWN";
  current_gmgn_note: string | null;
  canonical_identity: string;
  identity_display_name: string;
  raw_labels: string[];
  raw_label_count: number;
  normalized_label_count: number;
  unique_source_count: number | null;
  dominant_alias: string | null;
  dominant_alias_count: number;
  dominant_alias_share: number | null;
  identity_confidence: number;
  identity_status: IdentityStatus;
  alias_variants: string[];
  identity_last_verified_at: string | null;
  social: WalletSocialEnrichment;
  x_handle: string | null;
  x_display_name: string | null;
  x_followers_exact: number | null;
  x_followers_compact: string | null;
  x_verified_status: string | null;
  wallet_social_mapping_status: SocialMappingStatus;
  social_sources: string[];
  social_observed_at: string | null;
  social_confidence: number | null;
  win_rate_30d: number | null;
  payoff_ratio: number | null;
  pnl_7d: number | null;
  pnl_30d: number | null;
  trade_count_7d: number | null;
  trade_count_30d: number | null;
  profitable_token_count: number | null;
  losing_token_count: number | null;
  token_count: number | null;
  multi_token_repeatability: string | null;
  pnl_concentration: string | number | null;
  activity_recency: string;
  last_active_at: string | null;
  frequency_percentile: number | null;
  provider_data_quality: string | null;
  provider_data_status: string | null;
  provider_pnl_status: string | null;
  provider_pnl_source: string | null;
  provider_pnl_confidence: string | null;
  pnl_currency: string | null;
  verification_status: string | null;
  replay_followability_status: string | null;
  data_completeness: number | null;
  identity_score: number;
  social_influence_score: number;
  trading_quality_score: number;
  data_confidence_score: number;
  followability_score: number;
  freshness_score: number;
  total_score: number;
  tier: WalletTier;
  lifecycle_status: WalletLifecycleStatus;
  gmgn_note: string;
  gmgn_emoji: string;
  keep_recommendation: "RETAIN_CORE" | "RETAIN_WATCH" | "RETAIN_LEAD" | "REVIEW" | "EXCLUDE";
}

export interface CohortMetricSummary {
  valid_count: number;
  null_count: number;
  zero_count: number;
  mean: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
}

export interface CohortBenchmarks {
  schema_version: "wallet-library-cohort-benchmarks-v1";
  as_of: string;
  cohorts: Record<string, Record<string, CohortMetricSummary>>;
}

export interface RefreshOptions {
  inputFile: string;
  outputRoot: string;
  mode: "daily" | "weekly" | "monthly";
  runId?: string;
  runAt?: string;
  dryRun?: boolean;
  cacheReplay?: boolean;
  providerBudget?: number | null;
  previousSnapshot?: string | null;
}

export interface RefreshResult {
  run_id: string;
  status: "SUCCESS" | "DRY_RUN";
  counts: {
    total: number;
    sol: number;
    bsc: number;
    identity_address_count: number;
    core: number;
    watch: number;
    lead: number;
    verified_wallet_match: number;
    notes_with_verified_followers: number;
    valid_win_rate: number;
    valid_payoff: number;
    stale: number;
    contracts_excluded: number;
  };
  changes: Record<string, number>;
  max_note_length: number;
  backup_version_count: number;
  output_hash: string;
  output_root: string;
}
