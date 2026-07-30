import path from "node:path";
import { CaHolderTaskService } from "../application/operator-api/ca-holder-task-service.js";
import { createOperatorApiServer, listenOperatorApi } from "../application/operator-api/http-server.js";
import { OfflineBackend } from "../application/operator-api/offline-backend.js";
import { LiveHeliusDataSource } from "../infrastructure/solana/helius/live-helius-data-source.js";

/**
 * Local loopback Operator API: hotpath + offline product surfaces.
 *
 *   npm run operator-api -- --port 8787
 *   OPERATOR_API_LIVE=1 HELIUS_API_KEY=... npm run operator-api
 */
async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const liveEnabled = process.env.OPERATOR_API_LIVE === "1";
  const dataDir = args.dataDir ?? path.join(process.cwd(), ".local-data", "operator-api");
  const offline = new OfflineBackend({ dataDir });

  const service = new CaHolderTaskService({
    liveEnabled,
    requestBudget: args.requestBudget,
    maxPages: args.maxPages,
    baseCommit: process.env.GIT_COMMIT ?? "local",
    sourceFactory: () =>
      LiveHeliusDataSource.fromRuntime({
        requestBudget: args.requestBudget,
        minRequestIntervalMs: 350,
        timeoutMs: 15_000,
      }),
  });

  const server = createOperatorApiServer({
    host: "127.0.0.1",
    service,
    offline,
  });

  await listenOperatorApi(server, args.port);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      status: "listening",
      host: "127.0.0.1",
      port: args.port,
      liveEnabled,
      dataDir,
      offlineCaCount: offline.listCaScans().length,
      addressCount: offline.listAddresses().length,
      note: "offline_product_surfaces_seeded; live_create_requires_OPERATOR_API_LIVE",
    }),
  );

  await new Promise<void>(() => {
    /* run until signal */
  });
  return 0;
}

function parseArgs(argv: string[]): {
  port: number;
  requestBudget: number;
  maxPages: number;
  dataDir?: string;
} {
  let port = 8787;
  let requestBudget = 20;
  let maxPages = 8;
  let dataDir: string | undefined;
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
    } else if (k === "--data-dir" && v) {
      dataDir = v;
      i += 1;
    }
  }
  if (!Number.isInteger(port) || port <= 0) throw new Error("invalid_port");
  return { port, requestBudget, maxPages, ...(dataDir ? { dataDir } : {}) };
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : "startup_failed";
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ status: "failed", error: msg.includes("http") ? "startup_failed" : msg }));
  process.exit(1);
});
