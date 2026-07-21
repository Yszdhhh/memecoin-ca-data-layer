import { pathToFileURL } from "node:url";
import { runMacroDailyCoreLive } from "../application/macro-daily-core-live-run.js";
import { defaultLarkCliCommand, executeLarkCli } from "../infrastructure/lark/lark-cardkit-publisher.js";

export function parseMacroDailyCoreArgs(arguments_: readonly string[]): { dryRun: boolean } {
  if (arguments_.length === 0) return { dryRun: true };
  if (arguments_.length === 1 && arguments_[0] === "--send") return { dryRun: false };
  throw new Error("Usage: npm run macro:daily:core [-- --send]");
}

export async function runMacroDailyCoreCli(arguments_ = process.argv.slice(2), environment = process.env): Promise<{ reportDay: string; deliveryMode: "dry_run" | "lark_card_sent" }> {
  const { dryRun } = parseMacroDailyCoreArgs(arguments_);
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required");
  const feishuChatId = dryRun ? "" : await resolveFeishuChatId();
  const result = await runMacroDailyCoreLive({ databaseUrl, feishuChatId, dryRun });
  return { reportDay: result.reportDay, deliveryMode: result.deliveryMode };
}

async function resolveFeishuChatId(): Promise<string> {
  const { stdout } = await executeLarkCli(defaultLarkCliCommand, ["im", "+chat-search", "--query", "投研分析", "--disable-search-by-user", "--as", "bot", "--format", "json"]);
  const parsed = JSON.parse(String(stdout)) as { data?: { chats?: Array<{ chat_id?: string; name?: string }> } };
  const matches = parsed.data?.chats?.filter((chat) => chat.name === "投研分析" && typeof chat.chat_id === "string" && chat.chat_id.trim()) ?? [];
  if (matches.length !== 1) throw new Error("Feishu chat 投研分析 must resolve to exactly one target");
  return matches[0]!.chat_id!;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMacroDailyCoreCli().then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Macro daily core run failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
