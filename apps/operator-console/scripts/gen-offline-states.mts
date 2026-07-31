import { computeReadiness, scrubHealthForBrowser } from "../src/data/readiness.ts";
import { makeApiError } from "../src/data/api-error.ts";
import { mapPublicResultToCaScan } from "../src/data/live-api-map.ts";
import { writeFileSync, mkdirSync } from "node:fs";

const out =
  process.env.OFFLINE_OUT ??
  "C:/Users/10639/AppData/Local/Temp/grok-goal-9bf98c84e05e/implementer/offline-states";
mkdirSync(out, { recursive: true });

const cases = {
  "api-unreachable": computeReadiness({
    apiBase: "http://127.0.0.1:8787",
    health: null,
    healthError: makeApiError("api_unreachable"),
  }),
  "live-disabled": computeReadiness({
    apiBase: "http://127.0.0.1:8787",
    health: {
      status: "ok",
      service: "operator-api",
      liveEnabled: false,
      credentialConfigured: true,
    },
    healthError: null,
  }),
  "credential-unavailable": computeReadiness({
    apiBase: "http://127.0.0.1:8787",
    health: {
      status: "ok",
      service: "operator-api",
      liveEnabled: true,
      credentialConfigured: false,
    },
    healthError: null,
  }),
  "not-configured": computeReadiness({
    apiBase: null,
    health: null,
    healthError: null,
  }),
  ready: computeReadiness({
    apiBase: "http://127.0.0.1:8787",
    health: {
      status: "ok",
      service: "operator-api",
      liveEnabled: true,
      credentialConfigured: true,
      provider: "helius",
    },
    healthError: null,
  }),
};

let schemaError: { code?: string; message?: string } | null = null;
try {
  mapPublicResultToCaScan({
    taskId: "t",
    mint: "M",
    status: "OK",
    accountingEligible: true,
    exclusionCoverage: "partial",
    concentrationEligible: false,
    accounting: null,
    ownerCounts: null,
    concentration: [],
    issues: [],
    providerRequestCount: 0,
    paginationComplete: true,
    sourceWatermark: "x",
    observedAt: "",
    universeDefinition: "cleaned_holder_universe",
  } as never);
} catch (e) {
  const err = e as { code?: string; message?: string };
  schemaError = { code: err.code, message: err.message };
}

for (const [k, v] of Object.entries(cases)) {
  const body = JSON.stringify(
    {
      state: k,
      banner: v.banner,
      flags: {
        HTTP_CONFIGURED: v.HTTP_CONFIGURED,
        API_REACHABLE: v.API_REACHABLE,
        LIVE_ENABLED: v.LIVE_ENABLED,
        CREDENTIAL_AVAILABLE: v.CREDENTIAL_AVAILABLE,
        READY: v.READY,
      },
      reason: v.reason,
    },
    null,
    2,
  );
  writeFileSync(`${out}/${k}.json`, body);
  writeFileSync(
    `${out}/${k}.html`,
    `<!doctype html><html><body><h1 data-testid="readiness-banner">${v.banner}</h1><pre>${body}</pre></body></html>`,
  );
}
writeFileSync(`${out}/schema-error.json`, JSON.stringify(schemaError, null, 2));
writeFileSync(
  `${out}/budget-exhausted-partial.json`,
  JSON.stringify({ kind: "budget_exhausted", mapsToTaskStatus: "partial" }, null, 2),
);
writeFileSync(`${out}/empty.json`, JSON.stringify({ kind: "empty" }, null, 2));
writeFileSync(
  `${out}/summary.json`,
  JSON.stringify(
    {
      cases,
      schemaError,
      scrubbedReadyHealth: scrubHealthForBrowser(cases.ready.health),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      ok: true,
      banners: Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, v.banner])),
      schemaError,
    },
    null,
    2,
  ),
);
