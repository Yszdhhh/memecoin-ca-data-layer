import type {
  HeliusAddressTag,
  HeliusSwap,
  HeliusSwapTokenLeg,
  HeliusTokenMetadata,
  HeliusTransaction,
  HeliusWalletFacts,
  RpcMint,
  RpcTokenAccount,
  SolanaHeliusDataSource,
  SourceResponse,
  SourceWatermark,
} from "./helius-solana-adapter.js";
import { normalizeSwap, normalizeTokenTransfers, SourceDataUnavailableError } from "./helius-solana-adapter.js";
import { normalizeSolanaAddress } from "../../../domain/solana-address.js";
import type { AddressTag, ClusterMember, NormalizedTrade, TokenRef, TokenTransfer } from "../../../domain/types.js";
import { SolanaDevHistoryService } from "../dev/solana-dev-history-service.js";
import type { DevHistoryWatermark, PumpCreatorEvidence, SolanaDevHistoryResult } from "../dev/solana-dev-history-service.js";
import { assembleSnapshot } from "../holders/solana-holder-snapshot-service.js";
import type { HolderSnapshotWatermark, SolanaHolderSnapshot, SolanaTokenAccountBalance } from "../holders/solana-holder-snapshot-service.js";
import { PUMP_PROGRAM_ID, PumpInstructionDecoder } from "../pump/pump-instruction-decoder.js";
import {
  ProviderBudgetExhaustedError,
  type ProviderExecutor,
} from "../../../application/provider-executor/provider-executor.js";

export type HeliusRpcEndpointMode = "mainnet" | "gatekeeper_beta";

export interface LiveHeliusDataSourceOptions {
  apiKey?: string;
  rpcEndpointMode?: HeliusRpcEndpointMode;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  requestBudget?: number;
  minRequestIntervalMs?: number;
  timeoutMs?: number;
  /**
   * Shared task-level budget. When set, every HTTP attempt (page + retry)
   * consumes one unit from this executor (single authority).
   */
  executor?: ProviderExecutor;
}

export interface TokenAccountEnumerationResult {
  accounts: RpcTokenAccount[];
  pageCount: number;
  paginationComplete: boolean;
  watermark: SourceWatermark;
  pageSlots: string[];
  /** Rows skipped because a single account shape could not be normalized. */
  skippedMalformedCount: number;
}

const RPC_ENDPOINTS: Record<HeliusRpcEndpointMode, string> = {
  mainnet: "https://mainnet.helius-rpc.com/",
  gatekeeper_beta: "https://beta.helius-rpc.com/",
};
const ENHANCED_API_ENDPOINT = "https://api-mainnet.helius-rpc.com/";
const DEFAULT_REQUEST_BUDGET = 8;
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 150;
const DEFAULT_TIMEOUT_MS = 5_000;
const HOLDER_ENUMERATION_MAX_PAGES = 50;
/** Bounded raw-transaction scan for the Pump create instruction (oldest first). */
const MAX_CREATE_EVIDENCE_SCAN_TRANSACTIONS = 4;

/**
 * Small, read-only Helius boundary for bounded owner-approved live reads.
 * It keeps transport credentials in process memory only and never persists raw
 * provider responses. Missing, malformed, throttled, or incomplete critical
 * responses fail closed rather than falling back to another RPC provider.
 */
export class LiveHeliusDataSource implements SolanaHeliusDataSource {
  private readonly apiKey: string;
  private readonly rpcEndpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly requestBudget: number;
  private readonly minRequestIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly executor: ProviderExecutor | undefined;
  private requestCount = 0;
  private nextRequestStartMs = 0;
  private requestStartQueue: Promise<void> = Promise.resolve();

  constructor(options: LiveHeliusDataSourceOptions = {}) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) throw new SourceDataUnavailableError("helius_runtime_credential_unavailable");
    this.apiKey = apiKey;
    this.rpcEndpoint = RPC_ENDPOINTS[runtimeRpcEndpointMode(options.rpcEndpointMode)];
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.executor = options.executor;
    // When a shared executor is present it is the sole budget authority.
    this.requestBudget = this.executor
      ? this.executor.budget
      : positiveInteger(options.requestBudget ?? DEFAULT_REQUEST_BUDGET, "request budget");
    this.minRequestIntervalMs = nonNegativeInteger(
      options.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS,
      "minimum request interval",
    );
    this.timeoutMs = positiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeout");
  }

  static fromRuntime(options: Omit<LiveHeliusDataSourceOptions, "apiKey"> = {}): LiveHeliusDataSource {
    const apiKey = process.env.HELIUS_API_KEY;
    const rpcEndpointMode = runtimeRpcEndpointMode(process.env.HELIUS_RPC_ENDPOINT_MODE);
    return apiKey === undefined
      ? new LiveHeliusDataSource({ ...options, rpcEndpointMode })
      : new LiveHeliusDataSource({ ...options, apiKey, rpcEndpointMode });
  }

  async getMint(ca: string): Promise<SourceResponse<RpcMint | null>> {
    const result = await this.rpc("getAccountInfo", [
      requiredAddress(ca),
      { encoding: "jsonParsed", commitment: "finalized" },
    ]);
    const row = record(result);
    const value = row.value;
    if (value === null) return this.response(null, finalizedSlot(row.context));
    const account = record(value);
    const data = record(account.data);
    const parsed = record(data.parsed);
    const info = record(parsed.info);
    const decimals = info.decimals;
    const supplyRaw = info.supply;
    if (
      parsed.type !== "mint"
      || typeof decimals !== "number"
      || !Number.isInteger(decimals)
      || typeof supplyRaw !== "string"
      || !/^\d+$/.test(supplyRaw)
    ) {
      throw new SourceDataUnavailableError("helius_mint_malformed");
    }
    return this.response({ decimals, supplyRaw }, finalizedSlot(row.context));
  }

  async getTokenAccounts(ca: string): Promise<SourceResponse<RpcTokenAccount[]>> {
    const result = await this.rpc("getTokenAccounts", {
      mint: requiredAddress(ca),
      limit: 1_000,
      options: { showZeroBalance: false },
    });
    const row = record(result);
    const tokenAccounts = row.token_accounts;
    if (!Array.isArray(tokenAccounts)) throw new SourceDataUnavailableError("helius_token_accounts_malformed");
    const total = row.total;
    if (total !== undefined && (typeof total !== "number" || !Number.isInteger(total) || total < 0)) {
      throw new SourceDataUnavailableError("helius_token_accounts_malformed");
    }
    const hasMore = typeof total === "number"
      ? total > tokenAccounts.length
      : typeof row.cursor === "string" && row.cursor.length > 0;
    if (hasMore) throw new SourceDataUnavailableError("helius_token_accounts_truncated");

    const accounts = tokenAccounts.map((entry) => tokenAccount(entry));
    return this.response(accounts, indexedSlot(row));
  }

  /**
   * Full token-account enumeration with cursor pagination.
   * Does not fall back to public RPC. Stops at maxPages and reports partial.
   */
  async enumerateTokenAccounts(
    ca: string,
    options: { maxPages?: number; pageSize?: number; showZeroBalance?: boolean } = {},
  ): Promise<TokenAccountEnumerationResult> {
    const mint = requiredAddress(ca);
    const maxPages = positiveInteger(options.maxPages ?? 50, "max pages");
    const pageSize = positiveInteger(options.pageSize ?? 1_000, "page size");
    const showZeroBalance = options.showZeroBalance === true;
    const accounts: RpcTokenAccount[] = [];
    const seen = new Set<string>();
    const pageSlots: string[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    let paginationComplete = true;
    let lastSlot: bigint | undefined;
    let skippedMalformedCount = 0;

    for (;;) {
      if (pageCount >= maxPages) {
        paginationComplete = false;
        break;
      }
      const params: Record<string, unknown> = {
        mint,
        limit: pageSize,
        options: { showZeroBalance },
      };
      if (cursor !== undefined) params.cursor = cursor;
      let result: unknown;
      try {
        result = await this.rpc("getTokenAccounts", params);
      } catch (error) {
        // If later pages fail, return accounts already collected as partial rather than wiping the CA.
        if (accounts.length > 0) {
          paginationComplete = false;
          break;
        }
        throw error;
      }
      const row = record(result);
      const tokenAccounts = row.token_accounts;
      if (!Array.isArray(tokenAccounts)) {
        if (accounts.length > 0) {
          paginationComplete = false;
          break;
        }
        throw new SourceDataUnavailableError("helius_token_accounts_malformed");
      }
      const slot = indexedSlot(row);
      if (slot !== undefined) {
        lastSlot = slot;
        pageSlots.push(slot.toString());
      }
      for (const entry of tokenAccounts) {
        try {
          const parsed = tokenAccount(entry);
          if (seen.has(parsed.tokenAccount)) {
            // Identical re-delivery across pages is treated as a provider drift signal but not fatal.
            skippedMalformedCount += 1;
            continue;
          }
          seen.add(parsed.tokenAccount);
          accounts.push(parsed);
        } catch (error) {
          if (error instanceof SourceDataUnavailableError && error.message === "helius_token_account_malformed") {
            skippedMalformedCount += 1;
            continue;
          }
          throw error;
        }
      }
      pageCount += 1;
      this.executor?.recordPage();
      const nextCursor = typeof row.cursor === "string" && row.cursor.length > 0 ? row.cursor : undefined;
      const total = row.total;
      if (total !== undefined && (typeof total !== "number" || !Number.isInteger(total) || total < 0)) {
        if (accounts.length > 0) {
          paginationComplete = false;
          break;
        }
        throw new SourceDataUnavailableError("helius_token_accounts_malformed");
      }
      if (nextCursor === undefined) {
        // Compare against successfully parsed accounts only; skipped rows may leave total > length.
        if (typeof total === "number" && total > accounts.length + skippedMalformedCount) paginationComplete = false;
        break;
      }
      if (cursor !== undefined && nextCursor === cursor) {
        if (accounts.length > 0) {
          paginationComplete = false;
          break;
        }
        throw new SourceDataUnavailableError("helius_token_accounts_cursor_stuck");
      }
      cursor = nextCursor;
    }

    return {
      accounts,
      pageCount,
      paginationComplete,
      watermark: {
        source: "helius",
        observedAt: new Date(this.now()),
        completeness: paginationComplete ? "complete" : "partial",
        ...(lastSlot === undefined ? {} : { finalizedSlot: lastSlot }),
        ...(cursor === undefined ? {} : { cursor }),
      },
      pageSlots,
      skippedMalformedCount,
    };
  }

  getRequestCount(): number {
    return this.executor ? this.executor.requestsUsed : this.requestCount;
  }

  async getTokenMetadata(ca: string): Promise<SourceResponse<HeliusTokenMetadata | null>> {
    const result = await this.rpc("getAsset", { id: requiredAddress(ca) });
    if (result === null) return this.response(null);
    const asset = record(result);
    const content = optionalRecord(asset.content);
    const metadata = optionalRecord(content?.metadata);
    if (!metadata) return this.response({});
    const name = optionalString(metadata.name);
    const symbol = optionalString(metadata.symbol);
    return this.response({ ...(name ? { name } : {}), ...(symbol ? { symbol } : {}) }, indexedSlot(asset));
  }

  async getTransactions(addresses: string[], since: Date): Promise<SourceResponse<HeliusTransaction[]>> {
    if (!(since instanceof Date) || Number.isNaN(since.getTime()) || addresses.length === 0) {
      throw new SourceDataUnavailableError("helius_transaction_request_invalid");
    }
    const transactions: HeliusTransaction[] = [];
    let completeness: "complete" | "partial" = "complete";
    for (const address of addresses) {
      const url = new URL(`v0/addresses/${requiredAddress(address)}/transactions`, ENHANCED_API_ENDPOINT);
      url.searchParams.set("api-key", this.apiKey);
      url.searchParams.set("commitment", "finalized");
      url.searchParams.set("limit", "100");
      const payload = await this.request(url);
      if (!Array.isArray(payload)) throw new SourceDataUnavailableError("helius_transactions_malformed");
      if (payload.length === 100) completeness = "partial";
      for (const entry of payload) {
        const parsed = transactionFromEnhanced(entry);
        if (parsed.incompleteTransferEvents) completeness = "partial";
        if (new Date(parsed.transaction.blockTime) >= since) transactions.push(parsed.transaction);
      }
    }
    return this.response(transactions, undefined, undefined, completeness);
  }

  async getAddressTags(_addresses: string[]): Promise<SourceResponse<HeliusAddressTag[]>> {
    throw new SourceDataUnavailableError("helius_address_tags_unavailable");
  }

  async getWalletFacts(_addresses: string[], _at: Date): Promise<SourceResponse<HeliusWalletFacts[]>> {
    throw new SourceDataUnavailableError("helius_wallet_facts_unavailable");
  }

  /**
   * Full holder enumeration reusing the existing pagination/budget mechanism,
   * then the same owner aggregation, completeness assessment and cleaning rules
   * as SolanaHolderSnapshotService. A truncated or boundary-less enumeration is
   * reported partial so concentration is never confirmed on an incomplete set.
   */
  async getHolderSnapshot(
    token: TokenRef,
    addressTags: AddressTag[],
    clusterMembers: ClusterMember[],
  ): Promise<SourceResponse<SolanaHolderSnapshot>> {
    const enumeration = await this.enumerateTokenAccounts(token.ca, { maxPages: HOLDER_ENUMERATION_MAX_PAGES });
    const accounts: SolanaTokenAccountBalance[] = enumeration.accounts.map((account) => ({
      tokenAccountAddress: account.tokenAccount,
      ownerAddress: account.owner,
      balanceRaw: BigInt(account.amountRaw),
    }));
    const snapshot = assembleSnapshot(
      {
        tokenAddress: token.ca,
        totalSupplyRaw: token.totalSupplyRaw,
        addressTags,
        clusterMembers,
      },
      accounts,
      this.holderWatermarks(enumeration),
    );
    return this.response(
      snapshot,
      enumeration.watermark.finalizedSlot,
      enumeration.watermark.cursor,
      snapshot.completeness,
    );
  }

  /**
   * Decodes the pinned Pump create_v2 instruction from the mint's oldest
   * transactions and returns first-hand creator evidence. When no pinned
   * create decodes, the response is null and marked partial — never treated
   * as a confirmed negative.
   */
  async getPumpCreatorEvidence(token: TokenRef): Promise<SourceResponse<PumpCreatorEvidence | null>> {
    const transactions = await this.getTransactions([token.ca], new Date(0));
    // The enhanced list is newest-first; creation is the oldest transaction
    // that touches the mint, so scan the oldest few for a create_v2.
    const oldestFirst = transactions.data.slice(-MAX_CREATE_EVIDENCE_SCAN_TRANSACTIONS).reverse();
    const decoder = new PumpInstructionDecoder();
    for (const candidate of oldestFirst) {
      const raw = await this.rpc("getTransaction", [
        candidate.signature,
        { encoding: "json", maxSupportedTransactionVersion: 0 },
      ]);
      if (raw === null) continue;
      for (const instruction of rawInstructions(raw)) {
        if (instruction.programId !== PUMP_PROGRAM_ID) continue;
        const result = decoder.decode({
          programId: instruction.programId,
          accounts: instruction.accounts,
          dataBase58: instruction.dataBase58,
          signature: candidate.signature,
          slot: BigInt(candidate.slot),
          blockTime: new Date(candidate.blockTime),
          retrieval: {
            rpcEndpoint: this.rpcEndpoint,
            commitment: "finalized",
            retrievedAt: new Date(this.now()),
          },
        });
        if (result.status !== "decoded" || result.instruction.kind !== "create") continue;
        const create = result.instruction;
        if (create.mint !== token.ca) continue;
        return this.response({
          source: "pump_create.creator",
          creatorAddress: create.creator,
          signature: create.provenance.signature,
          slot: create.provenance.slot,
          blockTime: new Date(create.provenance.blockTime),
          programId: create.provenance.programId,
          sourceCommit: create.provenance.sourceCommit,
          idlSha256: create.provenance.idlSha256,
        });
      }
    }
    return this.response(null, undefined, undefined, "partial");
  }

  /**
   * Bounded dev history: one enhanced transaction fetch, then normalized
   * buy/sell swaps and token transfers from creation. The coverage watermark
   * is honest about truncation (hasGaps when the enhanced list is partial) and
   * about whether the fetch reaches back to creation; when it does not, the
   * service reports DEV_HISTORY_INCOMPLETE_FROM_CREATION instead of totals.
   */
  async getDevHistory(input: {
    token: TokenRef;
    creatorEvidence: PumpCreatorEvidence;
    holderSnapshot: SolanaHolderSnapshot;
    relatedAddresses: string[];
    at: Date;
  }): Promise<SourceResponse<SolanaDevHistoryResult>> {
    const since = input.token.createdAt ?? new Date(0);
    const history = await this.getTransactions([input.token.ca], since);
    const creationSlot = input.creatorEvidence.slot;
    const trades: NormalizedTrade[] = [];
    const transfers: TokenTransfer[] = [];
    let oldestObservedSlot: bigint | undefined;
    let newestObservedSlot: bigint | undefined;
    let newestSignature = "";
    for (const transaction of history.data) {
      const slot = BigInt(transaction.slot);
      if (oldestObservedSlot === undefined || slot < oldestObservedSlot) oldestObservedSlot = slot;
      if (newestObservedSlot === undefined || slot > newestObservedSlot) newestObservedSlot = slot;
      if (newestSignature === "") newestSignature = transaction.signature;
      trades.push(...normalizeSwap(input.token, transaction));
      transfers.push(...normalizeTokenTransfers(input.token, transaction));
    }

    const result = new SolanaDevHistoryService().analyze({
      tokenId: input.token.id,
      totalSupplyRaw: input.token.totalSupplyRaw,
      creatorEvidence: input.creatorEvidence,
      directCurrentBalanceRaw: input.holderSnapshot.ownerBalances.get(input.creatorEvidence.creatorAddress) ?? 0n,
      relatedCurrentBalances: new Map(
        input.relatedAddresses.map((address) => [address, input.holderSnapshot.ownerBalances.get(address) ?? 0n]),
      ),
      relatedAddresses: input.relatedAddresses,
      trades,
      transfers,
      creationSlot,
      watermark: {
        oldestObservedSlot: oldestObservedSlot ?? creationSlot,
        newestObservedSlot: newestObservedSlot ?? creationSlot,
        finalizedSlot: newestObservedSlot ?? creationSlot,
        cursor: newestSignature,
        // The enhanced list marks partial when truncated at 100 or when a
        // transfer event failed to normalize; either way trades are incomplete.
        hasGaps: history.watermark.completeness !== "complete",
        observedAt: new Date(this.now()),
      },
      calculatedAt: input.at,
    });

    return this.response(result, undefined, undefined, result.coverage.completeFromCreation ? "complete" : "partial");
  }

  private holderWatermarks(enumeration: TokenAccountEnumerationResult): HolderSnapshotWatermark[] {
    const observedAt = new Date(this.now());
    const watermarks: HolderSnapshotWatermark[] = enumeration.pageSlots.map((slot) => ({
      source: "helius",
      observedAt,
      finalizedSlot: BigInt(slot),
      completeness: "complete",
    }));
    // A page without a finalized boundary, or a truncated page set, must mark
    // the snapshot partial so concentration is never confirmed.
    if (enumeration.pageSlots.length < enumeration.pageCount || !enumeration.paginationComplete || watermarks.length === 0) {
      watermarks.push({ source: "helius", observedAt, completeness: "partial" });
    }
    if (enumeration.watermark.cursor !== undefined) {
      watermarks[watermarks.length - 1]!.cursor = enumeration.watermark.cursor;
    }
    return watermarks;
  }

  private async rpc(method: string, params: unknown): Promise<unknown> {
    const url = new URL(this.rpcEndpoint);
    url.searchParams.set("api-key", this.apiKey);
    const payload = await this.request(url, {
      jsonrpc: "2.0",
      id: "live-readonly",
      method,
      params,
    });
    const response = record(payload);
    if (response.error !== undefined) throw new SourceDataUnavailableError("helius_rpc_error");
    if (!("result" in response)) throw new SourceDataUnavailableError("helius_rpc_malformed");
    return response.result;
  }

  private async request(url: URL, body?: unknown): Promise<unknown> {
    const maxAttempts = 2;
    let lastError: SourceDataUnavailableError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const isRetry = attempt > 1;
      try {
        await this.reserveRequest(isRetry);
      } catch (error) {
        if (error instanceof ProviderBudgetExhaustedError) {
          throw new SourceDataUnavailableError("helius_request_budget_exhausted");
        }
        throw error;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const init: RequestInit = body === undefined
          ? { method: "GET", cache: "no-store", signal: controller.signal }
          : {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
            signal: controller.signal,
          };
        // Never log url (contains api-key query). Transport only.
        const response = await this.fetchImpl(url, init);
        if (!response.ok) {
          const code = `helius_http_${response.status}`;
          // Retry rate-limit / transient 5xx once or twice without retaining bodies.
          if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
            lastError = new SourceDataUnavailableError(code);
            await delay(300 * attempt);
            continue;
          }
          throw new SourceDataUnavailableError(code);
        }
        try {
          return await response.json();
        } catch {
          if (attempt < maxAttempts) {
            lastError = new SourceDataUnavailableError("helius_response_malformed");
            await delay(300 * attempt);
            continue;
          }
          throw new SourceDataUnavailableError("helius_response_malformed");
        }
      } catch (error) {
        if (error instanceof SourceDataUnavailableError) {
          if (error.message === "helius_request_budget_exhausted") throw error;
          if (
            attempt < maxAttempts
            && (error.message === "helius_response_malformed"
              || error.message === "helius_transport_unavailable"
              || error.message === "helius_timeout"
              || /^helius_http_(429|5\d\d)$/.test(error.message))
          ) {
            lastError = error;
            await delay(300 * attempt);
            continue;
          }
          throw error;
        }
        const mapped = new SourceDataUnavailableError(
          controller.signal.aborted ? "helius_timeout" : "helius_transport_unavailable",
        );
        if (controller.signal.aborted) this.executor?.recordTimeout();
        if (attempt < maxAttempts) {
          lastError = mapped;
          await delay(300 * attempt);
          continue;
        }
        throw mapped;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new SourceDataUnavailableError("helius_transport_unavailable");
  }

  private async reserveRequest(isRetry = false): Promise<void> {
    if (this.executor) {
      try {
        this.executor.consumeHttpAttempt({ operation: "helius_http", isRetry });
      } catch (error) {
        if (error instanceof ProviderBudgetExhaustedError) {
          throw new SourceDataUnavailableError("helius_request_budget_exhausted");
        }
        throw error;
      }
      // Keep local counter in sync for getRequestCount fallbacks.
      this.requestCount = this.executor.requestsUsed;
    } else {
      if (this.requestCount >= this.requestBudget) {
        throw new SourceDataUnavailableError("helius_request_budget_exhausted");
      }
      this.requestCount += 1;
    }
    let release: (() => void) | undefined;
    const previous = this.requestStartQueue;
    this.requestStartQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const waitMs = Math.max(0, this.nextRequestStartMs - this.now().getTime());
      if (waitMs > 0) await delay(waitMs);
      this.nextRequestStartMs = this.now().getTime() + this.minRequestIntervalMs;
    } finally {
      release?.();
    }
  }

  private response<T>(
    data: T,
    finalizedSlot?: bigint,
    cursor?: string,
    completeness: "complete" | "partial" = "complete",
  ): SourceResponse<T> {
    const watermark: SourceWatermark = {
      source: "helius",
      observedAt: new Date(this.now()),
      completeness,
      ...(finalizedSlot === undefined ? {} : { finalizedSlot }),
      ...(cursor === undefined ? {} : { cursor }),
    };
    return { data, watermark };
  }
}

function requiredAddress(value: string): string {
  const address = normalizeSolanaAddress(value);
  if (address === null) throw new SourceDataUnavailableError("helius_address_invalid");
  return address;
}

function runtimeRpcEndpointMode(value: string | undefined): HeliusRpcEndpointMode {
  const normalized = value?.trim() || "mainnet";
  if (normalized === "mainnet" || normalized === "gatekeeper_beta") return normalized;
  throw new SourceDataUnavailableError("helius_rpc_endpoint_mode_invalid");
}

function positiveInteger(value: number, context: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid ${context}`);
  return value;
}

function nonNegativeInteger(value: number, context: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid ${context}`);
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SourceDataUnavailableError("helius_response_malformed");
  }
  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function finalizedSlot(context: unknown): bigint | undefined {
  const row = optionalRecord(context);
  return slotFrom(row?.slot);
}

function indexedSlot(row: Record<string, unknown>): bigint | undefined {
  return slotFrom(row.last_indexed_slot);
}

function slotFrom(value: unknown): bigint | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return undefined;
}

function tokenAccount(value: unknown): RpcTokenAccount {
  const row = record(value);
  const ownership = optionalRecord(row.ownership);
  const tokenInfo = optionalRecord(row.token_info) ?? optionalRecord(row.tokenInfo);
  const account = optionalRecord(row.account);
  const data = optionalRecord(account?.data);
  const parsed = optionalRecord(data?.parsed);
  const info = optionalRecord(parsed?.info);
  const tokenAmount = optionalRecord(info?.tokenAmount) ?? optionalRecord(tokenInfo?.token_amount);

  const tokenAccount =
    optionalString(row.address)
    ?? optionalString(row.pubkey)
    ?? optionalString(row.tokenAccount);
  const owner =
    optionalString(row.owner)
    ?? optionalString(ownership?.owner)
    ?? optionalString(info?.owner);
  const amountRaw =
    rawIntegerString(row.amount)
    ?? rawIntegerString(tokenInfo?.balance)
    ?? rawIntegerString(tokenInfo?.amount)
    ?? rawIntegerString(tokenAmount?.amount)
    ?? rawIntegerString(info?.tokenAmount);

  if (!tokenAccount || !owner || !amountRaw) {
    throw new SourceDataUnavailableError("helius_token_account_malformed");
  }
  return { tokenAccount, owner, amountRaw };
}

function rawIntegerString(value: unknown): string | undefined {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "bigint" && value >= 0n) return value.toString();
  return undefined;
}

function transactionFromEnhanced(value: unknown): { transaction: HeliusTransaction; incompleteTransferEvents: boolean } {
  const row = record(value);
  const signature = optionalString(row.signature);
  const slot = slotFrom(row.slot);
  const timestamp = row.timestamp;
  if (!signature || slot === undefined || typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new SourceDataUnavailableError("helius_transaction_malformed");
  }
  const tokenTransfers = normalizedTransfers(row.tokenTransfers, enhancedTokenTransfer);
  const nativeTransfers = normalizedTransfers(row.nativeTransfers, enhancedNativeTransfer);
  let incompleteTransferEvents = tokenTransfers.incomplete || nativeTransfers.incomplete;
  let swap: HeliusSwap | undefined;
  if (row.swap !== undefined) {
    try {
      swap = enhancedSwap(row.swap);
    } catch (error) {
      if (!(error instanceof SourceDataUnavailableError)) throw error;
      incompleteTransferEvents = true;
    }
  }
  return {
    transaction: {
      signature,
      slot: slot.toString(),
      blockTime: new Date(timestamp * 1_000).toISOString(),
      ...(swap ? { swap } : {}),
      tokenTransfers: tokenTransfers.values,
      nativeTransfers: nativeTransfers.values,
    },
    incompleteTransferEvents,
  };
}

function normalizedTransfers<T>(
  value: unknown,
  normalize: (entry: unknown, eventIndex: number) => T,
): { values: T[]; incomplete: boolean } {
  if (value === undefined) return { values: [], incomplete: false };
  if (!Array.isArray(value)) return { values: [], incomplete: true };

  const values: T[] = [];
  let incomplete = false;
  for (const [eventIndex, entry] of value.entries()) {
    try {
      values.push(normalize(entry, eventIndex));
    } catch (error) {
      if (!(error instanceof SourceDataUnavailableError)) throw error;
      incomplete = true;
    }
  }
  return { values, incomplete };
}

function enhancedTokenTransfer(value: unknown, eventIndex: number) {
  const row = record(value);
  const mint = optionalString(row.mint);
  const from = optionalString(row.fromUserAccount);
  const to = optionalString(row.toUserAccount);
  const amount = row.tokenAmount;
  if (!mint || !from || !to || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(amount)) {
    throw new SourceDataUnavailableError("helius_token_transfer_malformed");
  }
  return { eventIndex, mint, from, to, amountRaw: String(amount), kind: "transfer" as const };
}

function enhancedNativeTransfer(value: unknown, eventIndex: number) {
  const row = record(value);
  const from = optionalString(row.fromUserAccount);
  const to = optionalString(row.toUserAccount);
  const amount = row.amount;
  if (!from || !to || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(amount)) {
    throw new SourceDataUnavailableError("helius_native_transfer_malformed");
  }
  return { eventIndex, from, to, amountRaw: String(amount) };
}

/** Maps the Helius enhanced swap event onto the domain swap legs. */
function enhancedSwap(value: unknown): HeliusSwap {
  const row = record(value);
  const user = optionalString(row.fromUserAccount);
  if (!user) throw new SourceDataUnavailableError("helius_swap_malformed");
  const nativeInput = optionalRecord(row.nativeInput);
  const nativeOutput = optionalRecord(row.nativeOutput);
  const venueAddress = optionalString(row.programId);
  const venue = optionalString(row.programName);
  return {
    user,
    tokenInputs: enhancedSwapLegs(row.tokenInputs),
    tokenOutputs: enhancedSwapLegs(row.tokenOutputs),
    ...(typeof nativeInput?.amount === "string" && /^\d+$/.test(nativeInput.amount) ? { quoteInputRaw: nativeInput.amount } : {}),
    ...(typeof nativeOutput?.amount === "string" && /^\d+$/.test(nativeOutput.amount) ? { quoteOutputRaw: nativeOutput.amount } : {}),
    ...(venueAddress ? { venueAddress } : {}),
    ...(venue ? { venue } : {}),
  };
}

function enhancedSwapLegs(value: unknown): HeliusSwapTokenLeg[] {
  if (!Array.isArray(value)) return [];
  const legs: HeliusSwapTokenLeg[] = [];
  for (const entry of value) {
    const row = record(entry);
    const mint = optionalString(row.mint);
    const rawTokenAmount = optionalRecord(row.rawTokenAmount)?.tokenAmount;
    const tokenAmount = typeof rawTokenAmount === "string"
      ? rawTokenAmount
      : (typeof rawTokenAmount === "number" && Number.isSafeInteger(rawTokenAmount) && rawTokenAmount >= 0
        ? String(rawTokenAmount)
        : undefined);
    if (!mint || !tokenAmount) throw new SourceDataUnavailableError("helius_swap_malformed");
    legs.push({ mint, amountRaw: tokenAmount });
  }
  return legs;
}

/** Extracts pump-relevant instruction slices from an RPC getTransaction payload (encoding json). */
function rawInstructions(
  value: unknown,
): Array<{ programId: string; accounts: string[]; dataBase58: string }> {
  // getTransaction result shape: { slot, blockTime, transaction: { message: { accountKeys, instructions } } }.
  const resultRow = optionalRecord(value);
  const transaction = optionalRecord(resultRow?.transaction);
  const message = optionalRecord(transaction?.message);
  const accountKeys = message?.accountKeys;
  const instructions = message?.instructions;
  if (!Array.isArray(accountKeys) || !Array.isArray(instructions)) {
    throw new SourceDataUnavailableError("helius_raw_transaction_malformed");
  }
  const keys: string[] = accountKeys.map((entry) => {
    if (typeof entry === "string" && entry.length > 0) return entry;
    const pubkey = optionalString(optionalRecord(entry)?.pubkey);
    if (pubkey === undefined) throw new SourceDataUnavailableError("helius_raw_transaction_malformed");
    return pubkey;
  });
  const result: Array<{ programId: string; accounts: string[]; dataBase58: string }> = [];
  for (const entry of instructions) {
    const instruction = record(entry);
    const programIdIndex = instruction.programIdIndex;
    const accountIndexes = instruction.accounts;
    const dataBase58 = instruction.data;
    if (
      typeof programIdIndex !== "number"
      || !Number.isInteger(programIdIndex)
      || programIdIndex < 0
      || programIdIndex >= keys.length
      || !Array.isArray(accountIndexes)
      || typeof dataBase58 !== "string"
    ) {
      throw new SourceDataUnavailableError("helius_raw_transaction_malformed");
    }
    const accounts = accountIndexes.map((index) => {
      if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= keys.length) {
        throw new SourceDataUnavailableError("helius_raw_transaction_malformed");
      }
      return keys[index]!;
    });
    result.push({ programId: keys[programIdIndex]!, accounts, dataBase58 });
  }
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
