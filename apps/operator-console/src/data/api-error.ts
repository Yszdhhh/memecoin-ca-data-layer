/**
 * Typed Operator API errors — never collate failures into null / "未找到".
 * causeScrubbed must not contain credentials, full provider URLs, or raw payloads.
 */

export type OperatorApiErrorCode =
  | "api_unreachable"
  | "http_forbidden"
  | "not_found"
  | "live_disabled"
  | "credential_unavailable"
  | "request_budget_exhausted"
  | "provider_error"
  | "timeout"
  | "schema_error"
  | "unknown_error";

export interface OperatorApiErrorShape {
  code: OperatorApiErrorCode;
  httpStatus: number | null;
  message: string;
  retryable: boolean;
  taskId: string | null;
  warningCodes: string[];
  causeScrubbed: string | null;
}

export class OperatorApiError extends Error implements OperatorApiErrorShape {
  readonly code: OperatorApiErrorCode;
  readonly httpStatus: number | null;
  readonly retryable: boolean;
  readonly taskId: string | null;
  readonly warningCodes: string[];
  readonly causeScrubbed: string | null;

  constructor(init: OperatorApiErrorShape) {
    super(init.message);
    this.name = "OperatorApiError";
    this.code = init.code;
    this.httpStatus = init.httpStatus;
    this.retryable = init.retryable;
    this.taskId = init.taskId;
    this.warningCodes = init.warningCodes;
    this.causeScrubbed = init.causeScrubbed;
  }

  toJSON(): OperatorApiErrorShape {
    return {
      code: this.code,
      httpStatus: this.httpStatus,
      message: this.message,
      retryable: this.retryable,
      taskId: this.taskId,
      warningCodes: this.warningCodes,
      causeScrubbed: this.causeScrubbed,
    };
  }
}

/** Strip credential-ish / URL / long opaque blobs from error text. */
export function scrubErrorText(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  return String(raw)
    .replace(/https?:\/\/[^\s"'`]+/gi, "[url]")
    .replace(/api[_-]?key[=:\s]+[A-Za-z0-9_\-]{8,}/gi, "api_key=[redacted]")
    .replace(/helius[^\s]{0,40}/gi, "[provider]")
    .replace(/[A-Za-z0-9_\-]{40,}/g, "[opaque]")
    .slice(0, 200);
}

function retryableFor(code: OperatorApiErrorCode): boolean {
  return code === "api_unreachable" || code === "timeout" || code === "provider_error";
}

export function makeApiError(
  code: OperatorApiErrorCode,
  opts?: {
    httpStatus?: number | null;
    message?: string;
    taskId?: string | null;
    warningCodes?: string[];
    cause?: string | null;
  },
): OperatorApiError {
  const message = opts?.message ?? code;
  return new OperatorApiError({
    code,
    httpStatus: opts?.httpStatus ?? null,
    message,
    retryable: retryableFor(code),
    taskId: opts?.taskId ?? null,
    warningCodes: opts?.warningCodes ?? [],
    causeScrubbed: opts?.cause != null ? scrubErrorText(opts.cause) : null,
  });
}

/** Map fetch/network throw → api_unreachable (not not_found). */
export function mapNetworkFailure(cause: unknown): OperatorApiError {
  const msg = cause instanceof Error ? cause.message : String(cause ?? "network");
  return makeApiError("api_unreachable", {
    message: "API unreachable",
    cause: msg,
  });
}

/**
 * Map HTTP status + body.error string → typed code.
 * Only real 404 → not_found.
 */
export function mapHttpStatusError(
  status: number,
  bodyError: string | null | undefined,
  body?: Record<string, unknown>,
): OperatorApiError {
  const err = scrubErrorText(bodyError ?? `http_${status}`);
  const lower = (bodyError ?? "").toLowerCase();
  const taskId = typeof body?.taskId === "string" ? body.taskId : null;

  if (status === 404) {
    return makeApiError("not_found", { httpStatus: 404, message: err, taskId, cause: bodyError });
  }
  if (status === 403 || status === 401) {
    return makeApiError("http_forbidden", {
      httpStatus: status,
      message: "HTTP forbidden / origin rejected",
      taskId,
      cause: bodyError,
    });
  }
  if (
    lower.includes("live_gate_disabled") ||
    lower.includes("live_disabled") ||
    lower === "live_gate_disabled"
  ) {
    return makeApiError("live_disabled", {
      httpStatus: status,
      message: "Live disabled",
      taskId,
      cause: bodyError,
    });
  }
  if (lower.includes("credential")) {
    return makeApiError("credential_unavailable", {
      httpStatus: status,
      message: "Credential unavailable",
      taskId,
      cause: bodyError,
      warningCodes: ["credential_unavailable"],
    });
  }
  if (lower.includes("budget")) {
    return makeApiError("request_budget_exhausted", {
      httpStatus: status,
      message: "Request budget exhausted",
      taskId,
      cause: bodyError,
      warningCodes: ["request_budget_exhausted"],
    });
  }
  if (lower.includes("timeout")) {
    return makeApiError("timeout", {
      httpStatus: status,
      message: "Timeout",
      taskId,
      cause: bodyError,
      warningCodes: ["timeout"],
    });
  }
  if (status >= 500) {
    return makeApiError("provider_error", {
      httpStatus: status,
      message: "Provider / server error",
      taskId,
      cause: bodyError,
    });
  }
  if (status === 400 && (lower.includes("schema") || lower.includes("invalid"))) {
    return makeApiError("schema_error", {
      httpStatus: status,
      message: "Schema / validation error",
      taskId,
      cause: bodyError,
    });
  }
  return makeApiError("unknown_error", {
    httpStatus: status,
    message: err,
    taskId,
    cause: bodyError,
  });
}

export function isOperatorApiError(e: unknown): e is OperatorApiError {
  return e instanceof OperatorApiError;
}

/** UI label for error codes — distinct from empty / 未找到. */
export function errorDisplayLabel(code: OperatorApiErrorCode): string {
  switch (code) {
    case "api_unreachable":
      return "API 无法连接";
    case "http_forbidden":
      return "HTTP 拒绝（CORS/origin）";
    case "not_found":
      return "未找到";
    case "live_disabled":
      return "Live 关闭";
    case "credential_unavailable":
      return "凭据不可用";
    case "request_budget_exhausted":
      return "请求预算耗尽（partial）";
    case "provider_error":
      return "Provider / 服务错误";
    case "timeout":
      return "超时";
    case "schema_error":
      return "Schema 错误";
    default:
      return "未知错误";
  }
}
