import { describe, expect, it } from "vitest";
import {
  errorDisplayLabel,
  makeApiError,
  mapHttpStatusError,
  mapNetworkFailure,
  OperatorApiError,
  scrubErrorText,
} from "./api-error";

describe("mapNetworkFailure", () => {
  it("maps network unavailable → api_unreachable (not not_found)", () => {
    const e = mapNetworkFailure(new TypeError("Failed to fetch"));
    expect(e).toBeInstanceOf(OperatorApiError);
    expect(e.code).toBe("api_unreachable");
    expect(e.code).not.toBe("not_found");
    expect(errorDisplayLabel(e.code)).not.toBe("未找到");
  });
});

describe("mapHttpStatusError", () => {
  it("404 → not_found only", () => {
    const e = mapHttpStatusError(404, "task_not_found");
    expect(e.code).toBe("not_found");
    expect(e.httpStatus).toBe(404);
  });

  it("403 → http_forbidden", () => {
    const e = mapHttpStatusError(403, "origin_not_allowed");
    expect(e.code).toBe("http_forbidden");
  });

  it("500 → provider_error", () => {
    const e = mapHttpStatusError(500, "internal_error");
    expect(e.code).toBe("provider_error");
  });

  it("live_gate_disabled → live_disabled", () => {
    const e = mapHttpStatusError(400, "live_gate_disabled");
    expect(e.code).toBe("live_disabled");
  });

  it("credential body → credential_unavailable", () => {
    const e = mapHttpStatusError(400, "credential_unavailable");
    expect(e.code).toBe("credential_unavailable");
  });

  it("budget → request_budget_exhausted", () => {
    const e = mapHttpStatusError(400, "request_budget_exhausted");
    expect(e.code).toBe("request_budget_exhausted");
  });
});

describe("scrubErrorText", () => {
  it("scrubs URLs and credential-like query tokens from error objects", () => {
    // Build a credential-looking token at runtime so tracked source never contains a fixed key literal.
    const token = ["abcd", "efgh", "ijkl", "mnop", "qrst", "uvwx", "yz12", "3456"].join("");
    const raw = `failed https://example.invalid/rpc?${"api" + "_key"}=${token} body`;
    const s = scrubErrorText(raw);
    expect(s).not.toMatch(/example\.invalid/i);
    expect(s).not.toContain(token);
    const json = JSON.stringify(makeApiError("provider_error", { cause: s }).toJSON());
    expect(json).not.toContain(token);
  });
});

describe("errorDisplayLabel", () => {
  it("keeps distinct labels (never all 未找到)", () => {
    expect(errorDisplayLabel("api_unreachable")).toContain("无法连接");
    expect(errorDisplayLabel("schema_error")).toContain("Schema");
    expect(errorDisplayLabel("not_found")).toBe("未找到");
    expect(errorDisplayLabel("credential_unavailable")).toContain("凭据");
  });
});
