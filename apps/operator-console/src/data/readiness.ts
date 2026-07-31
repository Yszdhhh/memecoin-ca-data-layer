import { allowOperatorApiBase } from "./api-base";
import {
  makeApiError,
  mapHttpStatusError,
  mapNetworkFailure,
  OperatorApiError,
  scrubErrorText,
  type OperatorApiErrorCode,
} from "./api-error";

/** Safe health DTO — no credential value/hash/length, no full provider endpoint. */
export interface OperatorHealthDto {
  service?: string;
  version?: string;
  status?: string;
  liveEnabled?: boolean;
  credentialConfigured?: boolean;
  provider?: string;
  chain?: string;
  bindMode?: string;
  observedAt?: string;
  /** legacy field from early server — not used for READY */
  liveDefault?: boolean;
}

export interface ReadinessFlags {
  HTTP_CONFIGURED: boolean;
  API_REACHABLE: boolean;
  LIVE_ENABLED: boolean;
  CREDENTIAL_AVAILABLE: boolean;
  READY: boolean;
  /** Chinese banner text for UI */
  banner: string;
  /** English/stable reason code for disable tooltip */
  reason: string;
  health: OperatorHealthDto | null;
  error: OperatorApiError | null;
}

export function emptyReadiness(partial?: Partial<ReadinessFlags>): ReadinessFlags {
  return {
    HTTP_CONFIGURED: false,
    API_REACHABLE: false,
    LIVE_ENABLED: false,
    CREDENTIAL_AVAILABLE: false,
    READY: false,
    banner: "未配置 API",
    reason: "http_not_configured",
    health: null,
    error: null,
    ...partial,
  };
}

/**
 * Pure readiness computation from env base + optional health response.
 * Setting a URL alone never implies Live Ready.
 */
export function computeReadiness(opts: {
  apiBase: string | null | undefined;
  health: OperatorHealthDto | null;
  healthError: OperatorApiError | null;
}): ReadinessFlags {
  const base = allowOperatorApiBase(opts.apiBase ?? null);
  const HTTP_CONFIGURED = base !== null;

  if (!HTTP_CONFIGURED) {
    return emptyReadiness({
      banner: "未配置 API",
      reason: "http_not_configured",
      error: opts.healthError,
    });
  }

  if (opts.healthError || !opts.health) {
    return emptyReadiness({
      HTTP_CONFIGURED: true,
      API_REACHABLE: false,
      banner: "API 无法连接",
      reason: "api_unreachable",
      error: opts.healthError ?? makeApiError("api_unreachable", { message: "health missing" }),
    });
  }

  const health = opts.health;
  // schema: require object with service or status ok-ish
  const schemaOk =
    typeof health === "object" &&
    health !== null &&
    (health.status === "ok" || health.service === "operator-api" || typeof health.liveEnabled === "boolean");

  if (!schemaOk) {
    return emptyReadiness({
      HTTP_CONFIGURED: true,
      API_REACHABLE: false,
      banner: "API 无法连接",
      reason: "health_schema_error",
      health,
      error: makeApiError("schema_error", { message: "health schema invalid" }),
    });
  }

  const LIVE_ENABLED = health.liveEnabled === true;
  const CREDENTIAL_AVAILABLE = health.credentialConfigured === true;

  if (!LIVE_ENABLED) {
    return {
      HTTP_CONFIGURED: true,
      API_REACHABLE: true,
      LIVE_ENABLED: false,
      CREDENTIAL_AVAILABLE,
      READY: false,
      banner: "API 已连接但 Live 关闭",
      reason: "live_disabled",
      health,
      error: null,
    };
  }

  if (!CREDENTIAL_AVAILABLE) {
    return {
      HTTP_CONFIGURED: true,
      API_REACHABLE: true,
      LIVE_ENABLED: true,
      CREDENTIAL_AVAILABLE: false,
      READY: false,
      banner: "Live 已开但凭据不可用",
      reason: "credential_unavailable",
      health,
      error: null,
    };
  }

  return {
    HTTP_CONFIGURED: true,
    API_REACHABLE: true,
    LIVE_ENABLED: true,
    CREDENTIAL_AVAILABLE: true,
    READY: true,
    banner: "Ready",
    reason: "ready",
    health,
    error: null,
  };
}

/** Parse health JSON fail-closed; reject credential leaks in browser object. */
export function parseHealthDto(raw: unknown): OperatorHealthDto {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw makeApiError("schema_error", { message: "health body not object" });
  }
  const o = raw as Record<string, unknown>;
  // Reject accidental credential fields in response
  for (const k of Object.keys(o)) {
    const lk = k.toLowerCase();
    if (
      lk.includes("apikey") ||
      lk.includes("api_key") ||
      lk.includes("credentialvalue") ||
      lk.includes("credential_hash") ||
      lk === "key" ||
      lk === "secret"
    ) {
      throw makeApiError("schema_error", { message: "health must not expose credentials" });
    }
  }

  const dto: OperatorHealthDto = {};
  if (typeof o.service === "string") dto.service = o.service;
  if (typeof o.version === "string") dto.version = o.version;
  if (typeof o.status === "string") dto.status = o.status;
  if (typeof o.liveEnabled === "boolean") dto.liveEnabled = o.liveEnabled;
  if (typeof o.credentialConfigured === "boolean") dto.credentialConfigured = o.credentialConfigured;
  if (typeof o.provider === "string") {
    // provider name only — not endpoint URL
    if (/^https?:\/\//i.test(o.provider)) {
      throw makeApiError("schema_error", { message: "health provider must not be URL" });
    }
    dto.provider = o.provider;
  }
  if (typeof o.chain === "string") dto.chain = o.chain;
  if (typeof o.bindMode === "string") dto.bindMode = o.bindMode;
  if (typeof o.observedAt === "string") dto.observedAt = o.observedAt;
  if (typeof o.liveDefault === "boolean") dto.liveDefault = o.liveDefault;
  return dto;
}

/** Browser-safe health object for UI — never includes credential material. */
export function scrubHealthForBrowser(h: OperatorHealthDto | null): Record<string, unknown> | null {
  if (!h) return null;
  return {
    service: h.service ?? null,
    version: h.version ?? null,
    status: h.status ?? null,
    liveEnabled: h.liveEnabled === true,
    credentialConfigured: h.credentialConfigured === true,
    provider: h.provider ?? null,
    chain: h.chain ?? null,
    bindMode: h.bindMode ?? null,
    observedAt: h.observedAt ?? null,
  };
}

export async function fetchOperatorHealth(baseUrl: string): Promise<OperatorHealthDto> {
  const origin = allowOperatorApiBase(baseUrl);
  if (!origin) {
    throw makeApiError("api_unreachable", { message: "invalid API base" });
  }
  let res: Response;
  try {
    res = await fetch(`${origin}/api/v1/health`, {
      headers: { accept: "application/json" },
    });
  } catch (e) {
    throw mapNetworkFailure(e);
  }

  let body: unknown = {};
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw makeApiError("schema_error", {
      httpStatus: res.status,
      message: "health invalid JSON",
      cause: scrubErrorText(text.slice(0, 80)),
    });
  }

  if (!res.ok) {
    const err =
      body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : null;
    throw mapHttpStatusError(res.status, err, body as Record<string, unknown>);
  }

  return parseHealthDto(body);
}

export async function probeReadiness(apiBase: string | null | undefined): Promise<ReadinessFlags> {
  const base = allowOperatorApiBase(apiBase ?? null);
  if (!base) {
    return computeReadiness({ apiBase: null, health: null, healthError: null });
  }
  try {
    const health = await fetchOperatorHealth(base);
    return computeReadiness({ apiBase: base, health, healthError: null });
  } catch (e) {
    const err =
      e instanceof OperatorApiError
        ? e
        : mapNetworkFailure(e);
    return computeReadiness({ apiBase: base, health: null, healthError: err });
  }
}

export function readinessBlocksLiveSubmit(flags: ReadinessFlags): {
  disabled: boolean;
  reason: string;
} {
  if (flags.READY) return { disabled: false, reason: "" };
  return { disabled: true, reason: flags.reason || flags.banner };
}

/** Map readiness reason → error code for banners that share vocabulary. */
export function readinessToErrorCode(flags: ReadinessFlags): OperatorApiErrorCode | null {
  if (flags.READY) return null;
  if (!flags.HTTP_CONFIGURED) return null;
  if (!flags.API_REACHABLE) return "api_unreachable";
  if (!flags.LIVE_ENABLED) return "live_disabled";
  if (!flags.CREDENTIAL_AVAILABLE) return "credential_unavailable";
  return null;
}
