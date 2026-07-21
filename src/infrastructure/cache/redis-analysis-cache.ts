import type { Redis } from "ioredis";
import type { AnalysisResult } from "../../domain/types.js";
import type { AnalysisCache } from "../../application/ports.js";

const BIGINT_PREFIX = "__bigint__:";

export class RedisAnalysisCache implements AnalysisCache {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<AnalysisResult | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw, (_key, value: unknown) => {
      if (typeof value === "string" && value.startsWith(BIGINT_PREFIX)) return BigInt(value.slice(BIGINT_PREFIX.length));
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value);
      return value;
    }) as AnalysisResult;
  }

  async set(key: string, value: AnalysisResult, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? `${BIGINT_PREFIX}${item.toString()}` : item,
    );
    await this.redis.set(key, raw, "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
