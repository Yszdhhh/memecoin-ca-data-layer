import { CaHolderTaskService } from "../application/operator-api/ca-holder-task-service.js";
import { createOperatorApiServer, listenOperatorApi } from "../application/operator-api/http-server.js";
import { LiveHeliusDataSource } from "../infrastructure/solana/helius/live-helius-data-source.js";
import type { ProviderExecutor } from "../application/provider-executor/provider-executor.js";

/**
 * Local loopback Operator API for CA holder hotpath.
 *
 *   OPERATOR_API_LIVE=1 HELIUS_API_KEY=... npx tsx src/cli/run-operator-api.ts --port 8787
 *
 * Default: live gate disabled (createTask fails closed).
 * Binds 127.0.0.1 only. No cron. Memory tasks only.
 * Credential is read only from process env HELIUS_API_KEY (never body/CLI/browser).
 */
async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const liveEnabled = process.env.OPERATOR_API_LIVE === "1";
  const service = new CaHolderTaskService({
    liveEnabled,
    requestBudget: args.requestBudget,
    maxPages: args.maxPages,
    baseCommit: process.env.GIT_COMMIT ?? "local",
    sourceFactory: (executor?: ProviderExecutor) =>
      LiveHeliusDataSource.fromRuntime({
        // Shared task executor is the single request-budget authority.
        ...(executor ? { executor } : { requestBudget: args.requestBudget }),
        minRequestIntervalMs: 350,
        timeoutMs: 15_000,
      }),
  });

  const server = createOperatorApiServer({
    host: "127.0.0.1",
    service,
  });

  await listenOperatorApi(server, args.port);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    status: "listening",
    host: "127.0.0.1",
    port: args.port,
    liveEnabled,
    requestBudget: args.requestBudget,
    maxPages: args.maxPages,
    note: "memory_tasks_mvp_restart_drops_state",
  }));

  await new Promise<void>(() => {
    /* run until process signal */
  });
  return 0;
}

function parseArgs(argv: string[]): { port: number; requestBudget: number; maxPages: number } {
  let port = 8787;
  let requestBudget = 20;
  let maxPages = 8;
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--port" && v) {
      port = Number(v);
      i += 1;
    } else if (k === "--request-budget" && v) {
      requestBudget = Number(v);
      i += 1;
    } else if (k === "--max-pages" && v) {
      maxPages = Number(v);
      i += 1;
    }
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("invalid_port");
  if (!Number.isInteger(requestBudget) || requestBudget < 1 || requestBudget > 20) {
    throw new Error("invalid_request_budget");
  }
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) {
    throw new Error("invalid_max_pages");
  }
  return { port, requestBudget, maxPages };
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : "startup_failed";
  // Never print secrets, credential-bearing URLs, or absolute user paths.
  const scrubbed = msg
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[A-Za-z]:\\[^\s]+/g, "[path]")
    .replace(/\/Users\/[^\s]+/g, "[path]")
    .replace(/HELIUS_API_KEY\s*=\s*\S+/gi, "HELIUS_API_KEY=[redacted]");
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({
    status: "failed",
    error: scrubbed.includes("http") && !scrubbed.startsWith("invalid_") ? "startup_failed" : scrubbed,
  }));
  process.exit(1);
});
