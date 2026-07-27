import type {
  HeliusAddressTag,
  HeliusTokenMetadata,
  HeliusTransaction,
  HeliusWalletFacts,
  RpcMint,
  RpcTokenAccount,
  SolanaHeliusDataSource,
  SourceResponse,
  SourceWatermark,
} from "./helius-solana-adapter.js";
import { SourceDataUnavailableError } from "./helius-solana-adapter.js";

export interface LiveHeliusDataSourceOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  requestBudget?: number;
  minRequestIntervalMs?: number;
  timeoutMs?: number;
}

const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/";
const ENHANCED_API_ENDPOINT = "https://api-mainnet.helius-rpc.com/";
const DEFAULT_REQUEST_BUDGET = 8;
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 150;
const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Small, read-only Helius boundary for the explicitly owner-gated live smoke.
 * It keeps transport credentials in process memory only and never persists raw
 * provider responses. Missing, malformed, throttled, or incomplete critical
 * responses fail closed rather than falling back to another RPC provider.
 */
export class LiveHeliusDataSource implements SolanaHeliusDataSource {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly requestBudget: number;
  private readonly minRequestIntervalMs: number;
  private readonly timeoutMs: number;
  private requestCount = 0;
  private nextRequestStartMs = 0;
  private requestStartQueue: Promise<void> = Promise.resolve();

  constructor(options: LiveHeliusDataSourceOptions = {}) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) throw new SourceDataUnavailableError("helius_runtime_credential_unavailable");
    this.apiKey = apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.requestBudget = positiveInteger(options.requestBudget ?? DEFAULT_REQUEST_BUDGET, "request budget");
    this.minRequestIntervalMs = nonNegativeInteger(
      options.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS,
      "minimum request interval",
    );
    this.timeoutMs = positiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeout");
  }

  static fromRuntime(options: Omit<LiveHeliusDataSourceOptions, "apiKey"> = {}): LiveHeliusDataSource {
    const apiKey = process.env.HELIUS_API_KEY;
    return apiKey === undefined
      ? new LiveHeliusDataSource(options)
      : new LiveHeliusDataSource({ ...options, apiKey });
  }

  async getMint(ca: string): Promise<SourceResponse<RpcMint | null>> {
    const result = await this.rpc("getTokenSupply", [requiredAddress(ca), { commitment: "finalized" }]);
    const row = record(result);
    const value = row.value;
    if (value === null) return this.response(null, finalizedSlot(row.context));
    const mint = record(value);
    const decimals = mint.decimals;
    const supplyRaw = mint.amount;
    if (typeof decimals !== "number" || !Number.isInteger(decimals) || typeof supplyRaw !== "string" || !/^\d+$/.test(supplyRaw)) {
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
    if (typeof row.cursor === "string" && row.cursor.length > 0) {
      throw new SourceDataUnavailableError("helius_token_accounts_truncated");
    }
    if (typeof row.total === "number" && row.total > tokenAccounts.length) {
      throw new SourceDataUnavailableError("helius_token_accounts_truncated");
    }

    const accounts = tokenAccounts.map((entry) => tokenAccount(entry));
    return this.response(accounts, indexedSlot(row));
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
        const transaction = transactionFromEnhanced(entry);
        if (new Date(transaction.blockTime) >= since) transactions.push(transaction);
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

  private async rpc(method: string, params: unknown): Promise<unknown> {
    const url = new URL(RPC_ENDPOINT);
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
    await this.reserveRequest();
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
      const response = await this.fetchImpl(url, init);
      if (!response.ok) throw new SourceDataUnavailableError(`helius_http_${response.status}`);
      try {
        return await response.json();
      } catch {
        throw new SourceDataUnavailableError("helius_response_malformed");
      }
    } catch (error) {
      if (error instanceof SourceDataUnavailableError) throw error;
      throw new SourceDataUnavailableError(controller.signal.aborted ? "helius_timeout" : "helius_transport_unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async reserveRequest(): Promise<void> {
    if (this.requestCount >= this.requestBudget) throw new SourceDataUnavailableError("helius_request_budget_exhausted");
    this.requestCount += 1;
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
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SourceDataUnavailableError("helius_address_invalid");
  }
  return value.trim();
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
  const tokenInfo = optionalRecord(row.token_info);
  const tokenAccount = optionalString(row.address);
  const owner = optionalString(ownership?.owner);
  const amountRaw = optionalString(tokenInfo?.balance);
  if (!tokenAccount || !owner || !amountRaw || !/^\d+$/.test(amountRaw)) {
    throw new SourceDataUnavailableError("helius_token_account_malformed");
  }
  return { tokenAccount, owner, amountRaw };
}

function transactionFromEnhanced(value: unknown): HeliusTransaction {
  const row = record(value);
  const signature = optionalString(row.signature);
  const slot = slotFrom(row.slot);
  const timestamp = row.timestamp;
  if (!signature || slot === undefined || typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new SourceDataUnavailableError("helius_transaction_malformed");
  }
  const tokenTransfers = array(row.tokenTransfers).map((transfer, eventIndex) => enhancedTokenTransfer(transfer, eventIndex));
  const nativeTransfers = array(row.nativeTransfers).map((transfer, eventIndex) => enhancedNativeTransfer(transfer, eventIndex));
  return {
    signature,
    slot: slot.toString(),
    blockTime: new Date(timestamp * 1_000).toISOString(),
    tokenTransfers,
    nativeTransfers,
  };
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
