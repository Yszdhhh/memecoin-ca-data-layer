import http from "node:http";
import {
  CaHolderTaskService,
  toPublicResultSummary,
  toPublicTaskSummary,
} from "./ca-holder-task-service.js";

export interface OperatorApiServerOptions {
  host?: string;
  port?: number;
  service: CaHolderTaskService;
}

export function createOperatorApiServer(options: OperatorApiServerOptions): http.Server {
  const host = options.host ?? "127.0.0.1";
  const service = options.service;

  const server = http.createServer((req, res) => {
    void handle(req, res, service);
  });

  // Bind only after caller decides; default host is loopback.
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
        note: "CA holder hotpath + task list. Memory tasks. Process restart drops state.",
      });
    }

    if (method === "GET" && url.pathname === "/api/v1/ca-holder-tasks") {
      const tasks = service.listTasks().map(toPublicTaskSummary);
      return json(res, 200, { tasks });
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

    return json(res, 404, { error: "not_found" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "internal_error";
    // Never echo credentials or URLs with keys.
    return json(res, 500, { error: msg.includes("http") ? "internal_error" : msg });
  }
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
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
