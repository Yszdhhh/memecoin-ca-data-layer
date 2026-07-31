import { describe, expect, it } from "vitest";
import {
  computeReadiness,
  parseHealthDto,
  readinessBlocksLiveSubmit,
  scrubHealthForBrowser,
} from "./readiness";
import { makeApiError } from "./api-error";

describe("computeReadiness", () => {
  it("no API base → not configured", () => {
    const r = computeReadiness({ apiBase: null, health: null, healthError: null });
    expect(r.HTTP_CONFIGURED).toBe(false);
    expect(r.READY).toBe(false);
    expect(r.banner).toBe("未配置 API");
  });

  it("loopback + API down → unreachable", () => {
    const r = computeReadiness({
      apiBase: "http://127.0.0.1:8787",
      health: null,
      healthError: makeApiError("api_unreachable", { message: "down" }),
    });
    expect(r.HTTP_CONFIGURED).toBe(true);
    expect(r.API_REACHABLE).toBe(false);
    expect(r.READY).toBe(false);
    expect(r.banner).toBe("API 无法连接");
  });

  it("health live=false → live disabled", () => {
    const r = computeReadiness({
      apiBase: "http://127.0.0.1:8787",
      health: {
        status: "ok",
        service: "operator-api",
        liveEnabled: false,
        credentialConfigured: true,
      },
      healthError: null,
    });
    expect(r.API_REACHABLE).toBe(true);
    expect(r.LIVE_ENABLED).toBe(false);
    expect(r.READY).toBe(false);
    expect(r.banner).toContain("Live 关闭");
  });

  it("health credential=false → credential unavailable", () => {
    const r = computeReadiness({
      apiBase: "http://127.0.0.1:8787",
      health: {
        status: "ok",
        service: "operator-api",
        liveEnabled: true,
        credentialConfigured: false,
      },
      healthError: null,
    });
    expect(r.LIVE_ENABLED).toBe(true);
    expect(r.CREDENTIAL_AVAILABLE).toBe(false);
    expect(r.READY).toBe(false);
    expect(r.banner).toContain("凭据不可用");
  });

  it("all true → ready", () => {
    const r = computeReadiness({
      apiBase: "http://127.0.0.1:8787",
      health: {
        status: "ok",
        service: "operator-api",
        liveEnabled: true,
        credentialConfigured: true,
        provider: "helius",
        chain: "solana",
        bindMode: "loopback",
      },
      healthError: null,
    });
    expect(r.READY).toBe(true);
    expect(r.banner).toBe("Ready");
    expect(readinessBlocksLiveSubmit(r).disabled).toBe(false);
  });

  it("non-loopback rejected (HTTP_CONFIGURED false)", () => {
    const r = computeReadiness({
      apiBase: "http://evil.example:8787",
      health: { status: "ok", liveEnabled: true, credentialConfigured: true },
      healthError: null,
    });
    expect(r.HTTP_CONFIGURED).toBe(false);
    expect(r.READY).toBe(false);
  });

  it("URL alone never implies Ready without health", () => {
    const r = computeReadiness({
      apiBase: "http://127.0.0.1:8787",
      health: null,
      healthError: null,
    });
    expect(r.HTTP_CONFIGURED).toBe(true);
    expect(r.READY).toBe(false);
  });
});

describe("parseHealthDto / scrub", () => {
  it("rejects credential fields in health body", () => {
    expect(() =>
      parseHealthDto({ status: "ok", apiKey: "secretsecretsecretsecret" }),
    ).toThrow();
  });

  it("no credential value in browser object", () => {
    const scrubbed = scrubHealthForBrowser({
      service: "operator-api",
      liveEnabled: true,
      credentialConfigured: true,
      provider: "helius",
    });
    const json = JSON.stringify(scrubbed);
    expect(json).toContain("credentialConfigured");
    expect(json).not.toMatch(/api[_-]?key/i);
    expect(json).not.toMatch(/[A-Za-z0-9]{32,}/); // no long secrets
  });
});
