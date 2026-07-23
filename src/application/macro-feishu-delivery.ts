import { createHash } from "node:crypto";
import { defaultLarkCliCommand, executeLarkCli } from "../infrastructure/lark/lark-cardkit-publisher.js";

export type MacroFeishuTestSender = (input: { chatId: string; text: string; idempotencyKey: string }) => Promise<void>;

const defaultSender: MacroFeishuTestSender = async (input) => {
  await executeLarkCli(defaultLarkCliCommand, ["im", "+messages-send", "--as", "bot", "--chat-id", input.chatId, "--msg-type", "text", "--content", JSON.stringify({ text: input.text }), "--idempotency-key", input.idempotencyKey]);
};

export class MacroFeishuTestDelivery {
  constructor(private readonly chatId: string, private readonly sender: MacroFeishuTestSender = defaultSender) {}

  async send(input: { reportDay: string; text: string; allowlistSha256: string }): Promise<{ deliveryMode: "lark_card_sent"; payloadSha256: string; idempotencyKey: string }> {
    if (!this.chatId.trim()) throw new Error("FEISHU_TEST_CHAT_ID is required for test delivery");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reportDay) || !/^[0-9a-f]{64}$/.test(input.allowlistSha256)) throw new Error("Macro Feishu test delivery input is invalid");
    const payloadSha256 = hashMacroFeishuText(input.text);
    const idempotencyKey = `macro-live:solana:${input.reportDay}:${input.allowlistSha256.slice(0, 16)}`;
    await this.sender({ chatId: this.chatId, text: input.text, idempotencyKey });
    return { deliveryMode: "lark_card_sent", payloadSha256, idempotencyKey };
  }
}

export function hashMacroFeishuText(text: string): string { return createHash("sha256").update(text).digest("hex"); }