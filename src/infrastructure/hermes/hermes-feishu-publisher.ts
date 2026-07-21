import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MacroBriefPublisher } from "../../application/macro-daily-g2-run-service.js";
const execFileAsync = promisify(execFile);
export class HermesFeishuPublisher implements MacroBriefPublisher {
  constructor(private readonly target: string, private readonly command = "hermes") {}
  async publish(markdown: string, dryRun: boolean): Promise<"dry_run" | "hermes_sent"> { if (dryRun) return "dry_run"; if (!this.target.trim()) throw new Error("HERMES_FEISHU_TARGET is required"); await execFileAsync(this.command,["send","--to",`feishu:${this.target}`,"--subject","每日链上市场简讯",markdown]); return "hermes_sent"; }
}
