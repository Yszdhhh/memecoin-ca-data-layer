import http from "node:http";
import {
  CaHolderTaskService,
  toPublicResultSummary,
  toPublicTaskSummary,
} from "./ca-holder-task-service.js";
import type { OfflineBackend } from "./offline-backend.js";

export interface OperatorApiServerOptions {
  host?: string;
  port?: number;
  service: CaHolderTaskService;
  offline: OfflineBackend;
}

export function createOperatorApiServer(options: OperatorApiServerOptions): http.Server {
  const host = options.host ?? "127.0.0.1";
  const service = options.service;
  const offline = options.offline;

  const server = http.createServer((req, res) => {
    void handle(req, res, service, offline);
  });

  (server as http.Server & { __bindHost?: string }).__bindHost = host;
  return server;
}

export function listenOperatorApi(server: http.Server, port: number): Promise<void> {
  const host = (server as http.Server & { __bindHost?: string }).__bindHost ?? "127.0.0.1";
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on("error", reject);
  });
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: CaHolderTaskService,
  offline: OfflineBackend,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";

    if (method === "GET" && url.pathname === "/api/v1/health") {
      return json(res, 200, {
        status: "ok",
        service: "operator-api",
        bind: "127.0.0.1",
        liveDefault: false,
        offlineStore: true,
        note: "Hotpath + offline product surfaces. Memory/disk local only.",
      });
    }

    // --- Hotpath tasks ---
    if (method === "GET" && url.pathname === "/api/v1/ca-holder-tasks") {
      return json(res, 200, { tasks: service.listTasks().map(toPublicTaskSummary) });
    }

    if (method === "POST" && url.pathname === "/api/v1/ca-holder-tasks") {
      const body = await readJson(req);
      const fieldErr = CaHolderTaskService.rejectUnknownFields(body);
      if (fieldErr) return json(res, 400, { error: fieldErr });
      const obj = body as { mint: string; idempotencyKey?: string };
      try {
        const task = await service.createTask(
          typeof obj.idempotencyKey === "string"
            ? { mint: obj.mint, idempotencyKey: obj.idempotencyKey }
            : { mint: obj.mint },
        );
        return json(res, 202, toPublicTaskSummary(task));
      } catch (error) {
        const msg = error instanceof Error ? error.message : "create_failed";
        const status = msg === "invalid_mint" || msg === "live_gate_disabled" ? 400 : 500;
        return json(res, status, { error: msg });
      }
    }

    const taskMatch = url.pathname.match(/^\/api\/v1\/ca-holder-tasks\/([^/]+)$/);
    if (method === "GET" && taskMatch) {
      const task = service.getTask(decodeURIComponent(taskMatch[1]!));
      if (!task) return json(res, 404, { error: "task_not_found" });
      return json(res, 200, toPublicTaskSummary(task));
    }

    const resultMatch = url.pathname.match(/^\/api\/v1\/ca-holder-results\/([^/]+)$/);
    if (method === "GET" && resultMatch) {
      const task = service.getTask(decodeURIComponent(resultMatch[1]!));
      if (!task) return json(res, 404, { error: "task_not_found" });
      const summary = toPublicResultSummary(task);
      if (!summary) return json(res, 404, { error: "result_not_ready", status: task.status });
      return json(res, 200, summary);
    }

    // --- Offline CA dashboard ---
    if (method === "GET" && url.pathname === "/api/v1/tokens/latest") {
      return json(res, 200, { items: offline.listCaScans() });
    }

    const tokenMatch = url.pathname.match(/^\/api\/v1\/tokens\/([^/]+)\/latest$/);
    if (method === "GET" && tokenMatch) {
      const mint = decodeURIComponent(tokenMatch[1]!);
      const scan = offline.getCaScan(mint);
      if (!scan) return json(res, 404, { error: "token_not_found" });
      return json(res, 200, scan);
    }

    const analysisMatch = url.pathname.match(/^\/api\/v1\/ca-results\/([^/]+)$/);
    if (method === "GET" && analysisMatch) {
      const id = decodeURIComponent(analysisMatch[1]!);
      const analysis = offline.getCaAnalysis(id) ?? offline.getCaScan(id)?.analysis ?? null;
      if (!analysis) return json(res, 404, { error: "analysis_not_found" });
      return json(res, 200, analysis);
    }

    // --- Addresses / labels ---
    if (method === "GET" && url.pathname === "/api/v1/addresses") {
      const q = url.searchParams.get("q") ?? undefined;
      return json(res, 200, { items: offline.listAddresses(q) });
    }

    const labelMatch = url.pathname.match(/^\/api\/v1\/addresses\/([^/]+)\/labels$/);
    if (method === "POST" && labelMatch) {
      const address = decodeURIComponent(labelMatch[1]!);
      const body = (await readJson(req)) as { label?: string; note?: string; confidence?: number };
      try {
        const rec = offline.addLabel({
          address,
          label: String(body.label ?? ""),
          ...(body.note !== undefined ? { note: body.note } : {}),
          ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
        });
        return json(res, 201, { address: rec.address, labels: rec.labels });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "label_failed";
        return json(res, 400, { error: msg });
      }
    }

    // --- Wallets ---
    if (method === "GET" && url.pathname === "/api/v1/wallets") {
      return json(res, 200, offline.listWallets());
    }

    const walletMatch = url.pathname.match(/^\/api\/v1\/wallets\/([^/]+)$/);
    if (method === "GET" && walletMatch) {
      const w = offline.getWallet(decodeURIComponent(walletMatch[1]!));
      if (!w) return json(res, 404, { error: "wallet_not_found" });
      return json(res, 200, w);
    }

    // --- Liquidity ---
    if (method === "GET" && url.pathname === "/api/v1/liquidity/latest") {
      return json(res, 200, offline.getLiquidityLatest());
    }
    if (method === "GET" && url.pathname === "/api/v1/liquidity/history") {
      return json(res, 200, { points: offline.getLiquidityHistory() });
    }

    // --- Task center (orchestrator jobs) ---
    if (method === "GET" && url.pathname === "/api/v1/jobs") {
      return json(res, 200, { jobs: offline.listJobs() });
    }
    if (method === "POST" && url.pathname === "/api/v1/jobs") {
      const body = (await readJson(req)) as { type?: string; input?: Record<string, unknown>; budget?: number };
      if (!body.type) return json(res, 400, { error: "type_required" });
      const job = offline.enqueueOffline(body.type, body.input ?? {}, body.budget ?? 10);
      return json(res, 202, job);
    }
    const jobRunMatch = url.pathname.match(/^\/api\/v1\/jobs\/([^/]+)\/run$/);
    if (method === "POST" && jobRunMatch) {
      try {
        const job = offline.runOfflineJob(decodeURIComponent(jobRunMatch[1]!));
        return json(res, 200, job);
      } catch (e) {
        return json(res, 404, { error: e instanceof Error ? e.message : "job_failed" });
      }
    }

    // --- Schedules ---
    if (method === "GET" && url.pathname === "/api/v1/schedules") {
      return json(res, 200, { schedules: offline.schedules.list() });
    }
    if (method === "POST" && url.pathname === "/api/v1/schedules") {
      const body = (await readJson(req)) as {
        type?: string;
        subjects?: string[];
        intervalHours?: number;
        budgetPerRun?: number;
        enabled?: boolean;
      };
      try {
        const s = offline.schedules.create({
          type: body.type ?? "ca_watch",
          subjects: body.subjects ?? [],
          intervalHours: body.intervalHours ?? 24,
          budgetPerRun: body.budgetPerRun ?? 5,
          enabled: body.enabled === true,
        });
        return json(res, 201, s);
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : "schedule_failed" });
      }
    }

    // --- Cross-CA archive ---
    if (method === "GET" && url.pathname === "/api/v1/cross-ca") {
      const kind = (url.searchParams.get("kind") ?? "mint") as "wallet" | "mint" | "cluster";
      const id = url.searchParams.get("id") ?? "";
      if (!id) return json(res, 400, { error: "id_required" });
      return json(res, 200, offline.crossCa(kind, id));
    }

    // --- Replay / calibration offline ---
    if (method === "GET" && url.pathname === "/api/v1/replay/calibration") {
      return json(res, 200, offline.replayCalibration());
    }

    return json(res, 404, { error: "not_found" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "internal_error";
    return json(res, 500, { error: msg.includes("http") ? "internal_error" : msg });
  }
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 64_000) throw new Error("body_too_large");
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
