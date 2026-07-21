import { Pool } from "pg";
import { MacroDailyCoreRunService, type CoreDuneQueryGateway, type MacroCoreStore } from "./macro-daily-core-run-service.js";
import type { MacroCoreBriefPublisher } from "./macro-daily-core-run-service.js";
import { MacroCoreDuneCli } from "../infrastructure/dune/macro-dune-cli.js";
import { LarkCardKitPublisher } from "../infrastructure/lark/lark-cardkit-publisher.js";
import { PostgresMacroCoreRepository } from "../infrastructure/postgres/postgres-macro-core-repository.js";

export interface MacroDailyCoreLiveRunOptions {
  databaseUrl: string;
  feishuChatId: string;
  dryRun?: boolean;
}

export interface MacroDailyCoreLiveDependencies {
  createPool(databaseUrl: string): Pool;
  createDune(): CoreDuneQueryGateway;
  createStore(pool: Pool): MacroCoreStore;
  createPublisher(chatId: string): MacroCoreBriefPublisher;
}

const defaults: MacroDailyCoreLiveDependencies = {
  createPool: (databaseUrl) => new Pool({ connectionString: databaseUrl }),
  createDune: () => new MacroCoreDuneCli(),
  createStore: (pool) => new PostgresMacroCoreRepository(pool),
  createPublisher: (chatId) => new LarkCardKitPublisher(chatId),
};

export async function runMacroDailyCoreLive(options: MacroDailyCoreLiveRunOptions, dependencies: MacroDailyCoreLiveDependencies = defaults): Promise<{ markdown: string; reportDay: string; deliveryMode: "dry_run" | "lark_card_sent" }> {
  if (!options.databaseUrl.trim()) throw new Error("DATABASE_URL is required");
  const pool = dependencies.createPool(options.databaseUrl);
  try {
    const result = await new MacroDailyCoreRunService(dependencies.createDune(), dependencies.createStore(pool), dependencies.createPublisher(options.feishuChatId)).run({ dryRun: options.dryRun !== false });
    return { markdown: result.markdown, reportDay: result.reportDay, deliveryMode: result.deliveryMode };
  } finally {
    await pool.end();
  }
}
