import {
  runDailyTopTokenMining,
  type DailyMiningConfig,
  type DailyMiningDeps,
  type DailyMiningReport,
  type MiningWindow,
} from "./daily-toptoken-mining.js";

export const OFFLINE_MINING_SCHEDULE_RULE_VERSION = "offline-mining-schedule-v1";

export type OfflineMiningScheduleConfig = Omit<DailyMiningConfig, "window" | "runAt"> & {
  /** Manual trigger time. This module never starts a timer or background worker. */
  triggeredAt: Date;
};

export interface OfflineMiningJob {
  window: MiningWindow;
  runAt: Date;
}

export interface OfflineMiningScheduleResult {
  scheduleRuleVersion: string;
  mode: "manual_offline";
  triggeredAt: Date;
  jobs: OfflineMiningJob[];
  reports: DailyMiningReport[];
}

/**
 * Computes deterministic UTC schedule slots for a manually invoked run. Daily
 * always runs; weekly runs only on Monday. Canonical slot timestamps make
 * repeated manual invocations use the same durable report identity.
 */
export function planOfflineMiningJobs(triggeredAt: Date): OfflineMiningJob[] {
  assertValidDate(triggeredAt);
  const dailyRunAt = utcDayStart(triggeredAt);
  const jobs: OfflineMiningJob[] = [{ window: "daily", runAt: dailyRunAt }];
  if (triggeredAt.getUTCDay() === 1) {
    jobs.push({ window: "weekly", runAt: dailyRunAt });
  }
  return jobs;
}

/**
 * Explicitly invoked fixture/offline runner. It deliberately contains no cron,
 * timer, process loop, provider construction, or network activity.
 */
export async function runOfflineMiningSchedule(
  deps: DailyMiningDeps,
  config: OfflineMiningScheduleConfig,
): Promise<OfflineMiningScheduleResult> {
  const jobs = planOfflineMiningJobs(config.triggeredAt);
  const reports: DailyMiningReport[] = [];
  for (const job of jobs) {
    reports.push(await runDailyTopTokenMining(deps, {
      ...config,
      window: job.window,
      runAt: job.runAt,
    }));
  }
  return {
    scheduleRuleVersion: OFFLINE_MINING_SCHEDULE_RULE_VERSION,
    mode: "manual_offline",
    triggeredAt: new Date(config.triggeredAt),
    jobs: jobs.map((job) => ({ ...job, runAt: new Date(job.runAt) })),
    reports,
  };
}

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function assertValidDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("offline mining schedule triggeredAt must be a valid date");
  }
}