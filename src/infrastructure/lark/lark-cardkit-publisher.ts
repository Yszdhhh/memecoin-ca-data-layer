import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { buildMacroDailyBriefCard, hashMacroDailyBriefCard } from "../../application/macro-daily-brief-card.js";
import type { MacroCoreBriefPublisher } from "../../application/macro-daily-core-run-service.js";

const execFileAsync = promisify(execFile);
export type LarkCommandExecutor = (command: string, arguments_: readonly string[]) => Promise<void>;
export const defaultLarkCliCommand = "lark-cli";

const defaultLarkExecutor: LarkCommandExecutor = async (command, arguments_) => {
  await executeLarkCli(command, arguments_);
};

export async function executeLarkCli(command: string, arguments_: readonly string[]): Promise<{ stdout: string }> {
  if (process.platform !== "win32" || command !== defaultLarkCliCommand) {
    const result = await execFileAsync(command, [...arguments_]);
    return { stdout: String(result.stdout) };
  }
  const scriptPath = await resolveWindowsLarkCliScript();
  const result = await execFileAsync(process.execPath, [scriptPath, ...arguments_]);
  return { stdout: String(result.stdout) };
}

export function parseWindowsLarkShim(source: string): string | null {
  const match = /^node\s+"([^"\r\n]*[\\/]@larksuite[\\/]cli[\\/]scripts[\\/]run\.js)"\s+%\*\s*$/im.exec(source);
  return match?.[1] ?? null;
}

async function resolveWindowsLarkCliScript(): Promise<string> {
  const { stdout } = await execFileAsync("where.exe", ["lark-cli.cmd"]);
  for (const shimPath of String(stdout).split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    const scriptPath = parseWindowsLarkShim(await readFile(shimPath, "utf8"));
    if (scriptPath !== null) return scriptPath;
  }
  throw new Error("No supported lark-cli.cmd Node shim was found");
}

export class LarkCardKitPublisher implements MacroCoreBriefPublisher {
  constructor(private readonly chatId: string, private readonly command = defaultLarkCliCommand, private readonly execute: LarkCommandExecutor = defaultLarkExecutor) {}

  async publish(input: { brief: Parameters<typeof buildMacroDailyBriefCard>[0]; dynamics: Parameters<typeof buildMacroDailyBriefCard>[1] }, dryRun: boolean): Promise<{ deliveryMode: "dry_run" | "lark_card_sent"; payloadSha256: string }> {
    const card = buildMacroDailyBriefCard(input.brief, input.dynamics);
    const payloadSha256 = hashMacroDailyBriefCard(card);
    if (dryRun) return { deliveryMode: "dry_run", payloadSha256 };
    if (!this.chatId.trim()) throw new Error("Feishu chat ID is required for CardKit delivery");
    const idempotencyKey = `macro-daily-${input.brief.reportDay}-${payloadSha256.slice(0, 16)}`;
    await this.execute(this.command, ["im", "+messages-send", "--as", "bot", "--chat-id", this.chatId, "--msg-type", "interactive", "--content", JSON.stringify(card), "--idempotency-key", idempotencyKey]);
    return { deliveryMode: "lark_card_sent", payloadSha256 };
  }
}
