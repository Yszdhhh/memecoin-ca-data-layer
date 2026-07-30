/**
 * ORCHESTRATOR-CORE-001 — process-local job queue with idempotency + lease.
 * PG SKIP LOCKED is the durable target; this MVP recovers on process restart via disk.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type JobState = "queued" | "leased" | "running" | "completed" | "partial" | "failed" | "cancelled";

export interface JobRecord {
  jobId: string;
  type: string;
  inputHash: string;
  input: Record<string, unknown>;
  state: JobState;
  attempt: number;
  budget: number;
  requestsUsed: number;
  leaseOwner: string | null;
  leaseUntil: string | null;
  createdAt: string;
  updatedAt: string;
  outputRef: string | null;
  error: string | null;
  lineageId: string;
}

export interface JobQueueOptions {
  dataDir: string;
  leaseMs?: number;
  now?: () => Date;
}

export class JobQueue {
  private jobs = new Map<string, JobRecord>();
  private byInputHash = new Map<string, string>();
  private readonly leaseMs: number;
  private readonly now: () => Date;

  constructor(private readonly options: JobQueueOptions) {
    this.leaseMs = options.leaseMs ?? 60_000;
    this.now = options.now ?? (() => new Date());
    fs.mkdirSync(options.dataDir, { recursive: true });
    this.load();
  }

  private file(): string {
    return path.join(this.options.dataDir, "jobs.json");
  }

  private load(): void {
    const p = this.file();
    if (!fs.existsSync(p)) return;
    const rows = JSON.parse(fs.readFileSync(p, "utf8")) as JobRecord[];
    for (const j of rows) {
      this.jobs.set(j.jobId, j);
      this.byInputHash.set(j.inputHash, j.jobId);
      // Recover abandoned leases
      if ((j.state === "leased" || j.state === "running") && j.leaseUntil && j.leaseUntil < this.now().toISOString()) {
        j.state = "queued";
        j.leaseOwner = null;
        j.leaseUntil = null;
      }
    }
  }

  save(): void {
    const all = [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    fs.writeFileSync(this.file(), JSON.stringify(all, null, 2), "utf8");
  }

  static inputHash(type: string, input: Record<string, unknown>): string {
    return createHash("sha256").update(JSON.stringify({ type, input })).digest("hex");
  }

  enqueue(type: string, input: Record<string, unknown>, budget = 20): JobRecord {
    const inputHash = JobQueue.inputHash(type, input);
    const existingId = this.byInputHash.get(inputHash);
    if (existingId) {
      const existing = this.jobs.get(existingId);
      if (existing && existing.state !== "failed" && existing.state !== "cancelled") {
        return existing;
      }
    }
    const now = this.now().toISOString();
    const job: JobRecord = {
      jobId: randomUUID(),
      type,
      inputHash,
      input,
      state: "queued",
      attempt: 0,
      budget,
      requestsUsed: 0,
      leaseOwner: null,
      leaseUntil: null,
      createdAt: now,
      updatedAt: now,
      outputRef: null,
      error: null,
      lineageId: existingId ? this.jobs.get(existingId)!.lineageId : randomUUID(),
    };
    this.jobs.set(job.jobId, job);
    this.byInputHash.set(inputHash, job.jobId);
    this.save();
    return job;
  }

  /** Claim next queued job (SKIP LOCKED analog). */
  claim(workerId: string): JobRecord | null {
    const now = this.now();
    for (const job of this.jobs.values()) {
      if (job.state !== "queued") continue;
      job.state = "leased";
      job.leaseOwner = workerId;
      job.leaseUntil = new Date(now.getTime() + this.leaseMs).toISOString();
      job.attempt += 1;
      job.updatedAt = now.toISOString();
      this.save();
      return job;
    }
    return null;
  }

  markRunning(jobId: string): void {
    const j = this.jobs.get(jobId);
    if (!j) return;
    j.state = "running";
    j.updatedAt = this.now().toISOString();
    this.save();
  }

  complete(jobId: string, outputRef: string, requestsUsed: number, partial = false): void {
    const j = this.jobs.get(jobId);
    if (!j) return;
    j.state = partial ? "partial" : "completed";
    j.outputRef = outputRef;
    j.requestsUsed = requestsUsed;
    j.leaseOwner = null;
    j.leaseUntil = null;
    j.updatedAt = this.now().toISOString();
    this.save();
  }

  fail(jobId: string, error: string, requestsUsed = 0): void {
    const j = this.jobs.get(jobId);
    if (!j) return;
    j.state = "failed";
    j.error = error.slice(0, 300);
    j.requestsUsed = requestsUsed;
    j.leaseOwner = null;
    j.leaseUntil = null;
    j.updatedAt = this.now().toISOString();
    this.save();
  }

  get(jobId: string): JobRecord | null {
    return this.jobs.get(jobId) ?? null;
  }

  list(limit = 100): JobRecord[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

export interface ScheduleRecord {
  scheduleId: string;
  type: string;
  /** Explicit CA/watchlist only — never full market. */
  subjects: string[];
  enabled: boolean;
  intervalHours: number;
  nextRunAt: string;
  budgetPerRun: number;
  createdAt: string;
}

export class ScheduleStore {
  private rows = new Map<string, ScheduleRecord>();

  constructor(private readonly dataDir: string, private readonly now: () => Date = () => new Date()) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.load();
  }

  private file(): string {
    return path.join(this.dataDir, "schedules.json");
  }

  private load(): void {
    const p = this.file();
    if (!fs.existsSync(p)) return;
    for (const r of JSON.parse(fs.readFileSync(p, "utf8")) as ScheduleRecord[]) {
      this.rows.set(r.scheduleId, r);
    }
  }

  save(): void {
    fs.writeFileSync(this.file(), JSON.stringify([...this.rows.values()], null, 2), "utf8");
  }

  create(input: {
    type: string;
    subjects: string[];
    intervalHours: number;
    budgetPerRun: number;
    enabled?: boolean;
  }): ScheduleRecord {
    if (input.subjects.length === 0) throw new Error("subjects_required");
    if (input.subjects.includes("*") || input.type === "full_market_scan") {
      throw new Error("full_market_scan_forbidden");
    }
    const now = this.now();
    const rec: ScheduleRecord = {
      scheduleId: randomUUID(),
      type: input.type,
      subjects: [...new Set(input.subjects)],
      enabled: input.enabled === true, // default off
      intervalHours: Math.max(1, input.intervalHours),
      nextRunAt: new Date(now.getTime() + input.intervalHours * 3600_000).toISOString(),
      budgetPerRun: input.budgetPerRun,
      createdAt: now.toISOString(),
    };
    this.rows.set(rec.scheduleId, rec);
    this.save();
    return rec;
  }

  setEnabled(scheduleId: string, enabled: boolean): ScheduleRecord | null {
    const r = this.rows.get(scheduleId);
    if (!r) return null;
    r.enabled = enabled;
    this.save();
    return r;
  }

  list(): ScheduleRecord[] {
    return [...this.rows.values()];
  }
}
