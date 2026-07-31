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
  /** Explicit Console origins allowed for browser Origin/CORS. */
  allowedOrigins?: string[];
}

const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

export function createOperatorApiServer(options: OperatorApiServerOptions): http.Server {
  const host = options.host ?? "127.0.0.1";
  const service = options.service;
  const allowedOrigins = new Set(options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS);

  const server = http.createServer((req, res) => {
    void handle(req, res, service, allowedOrigins);
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
  allowedOrigins: Set<string>,
): Promise<void> {
  try {
    const hostHeader = String(req.headers.host ?? "");
    if (!isLoopbackHost(hostHeader)) {
      return json(res, 403, { error: "host_not_allowed" });
    }

    const origin = headerValue(req.headers.origin);
    const secFetchSite = headerValue(req.headers["sec-fetch-site"]);

    // Cross-site browser fetches are never allowed against the loopback API.
    if (secFetchSite && secFetchSite.toLowerCase() === "cross-site") {
      return json(res, 403, { error: "cross_site_forbidden" });
    }

    if (origin !== undefined && !allowedOrigins.has(origin)) {
      return json(res, 403, { error: "origin_not_allowed" });
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      // Only preflight allowlisted Console origins (never *).
      if (!origin || !allowedOrigins.has(origin)) {
        return json(res, 403, { error: "origin_not_allowed" });
      }
      res.writeHead(204, corsHeaders(origin));
      res.end();
      return;
    }

    if (method === "GET" && url.pathname === "/api/v1/health") {
      return json(res, 200, {
        status: "ok",
        service: "operator-api",
        bind: "127.0.0.1",
        liveDefault: false,
        note: "CA holder hotpath only. Memory tasks. Process restart drops state.",
      }, origin);
    }

    if (method === "POST" && url.pathname === "/api/v1/ca-holder-tasks") {
      const contentType = headerValue(req.headers["content-type"]) ?? "";
      if (!contentType.toLowerCase().startsWith("application/json")) {
        return json(res, 415, { error: "content_type_must_be_application_json" }, origin);
      }

      const body = await readJson(req);
      const fieldErr = CaHolderTaskService.rejectUnknownFields(body);
      if (fieldErr) return json(res, 400, { error: fieldErr }, origin);
      const obj = body as { mint: string; idempotencyKey?: string };
      try {
        const task = await service.createTask(
          typeof obj.idempotencyKey === "string"
            ? { mint: obj.mint, idempotencyKey: obj.idempotencyKey }
            : { mint: obj.mint },
        );
        return json(res, 202, toPublicTaskSummary(task), origin);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "create_failed";
        const status = msg === "invalid_mint" || msg === "live_gate_disabled" ? 400 : 500;
        return json(res, status, { error: msg }, origin);
      }
    }

    const taskMatch = url.pathname.match(/^\/api\/v1\/ca-holder-tasks\/([^/]+)$/);
    if (method === "GET" && taskMatch) {
      const task = service.getTask(decodeURIComponent(taskMatch[1]!));
      if (!task) return json(res, 404, { error: "task_not_found" }, origin);
      return json(res, 200, toPublicTaskSummary(task), origin);
    }

    const resultMatch = url.pathname.match(/^\/api\/v1\/ca-holder-results\/([^/]+)$/);
    if (method === "GET" && resultMatch) {
      const task = service.getTask(decodeURIComponent(resultMatch[1]!));
      if (!task) return json(res, 404, { error: "task_not_found" }, origin);
      const summary = toPublicResultSummary(task);
      if (!summary) return json(res, 404, { error: "result_not_ready", status: task.status }, origin);
      return json(res, 200, summary, origin);
    }

    return json(res, 404, { error: "not_found" }, origin);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "internal_error";
    // Never echo credentials or URLs with keys.
    return json(res, 500, { error: msg.includes("http") ? "internal_error" : msg });
  }
}

function isLoopbackHost(hostHeader: string): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.trim().toLowerCase();
  // Accept host or host:port for loopback only.
  const hostname = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : host.split(":")[0] ?? "";
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin) return {};
  // Never Access-Control-Allow-Origin: *
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function json(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  origin?: string,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...corsHeaders(origin),
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
