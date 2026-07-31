import { beforeEach, describe, expect, it } from "vitest";
import { FixtureOperatorConsoleDataSource } from "./fixture-source";
import { formatRatio } from "../lib/format";

describe("FixtureOperatorConsoleDataSource", () => {
  const ds = new FixtureOperatorConsoleDataSource();

  beforeEach(() => {
    localStorage.clear();
  });

  it("loads fixture CA list", async () => {
    const list = await ds.listCaScans();
    expect(list.length).toBe(6);
    expect(list.filter((x) => x.status === "OK").length).toBe(3);
    expect(list.filter((x) => x.status === "PARTIAL").length).toBe(3);
  });

  it("OK CA has accounting confirmed and concentration unverified", async () => {
    const list = await ds.listCaScans();
    const ok = list.find((x) => x.status === "OK")!;
    const scan = await ds.getCaScan(ok.mint);
    expect(scan).not.toBeNull();
    expect(scan!.accountingEligible).toBe(true);
    expect(scan!.exclusionCoverage).toBe("partial");
    expect(scan!.concentrationEligible).toBe(false);
    expect(scan!.concentration.top10?.ratio).toBeNull();
    expect(scan!.concentration.top10?.verificationStatus).toBe("unverified");
  });

  it("PARTIAL CA is not accounting confirmed", async () => {
    const list = await ds.listCaScans();
    const partial = list.find((x) => x.status === "PARTIAL")!;
    const scan = await ds.getCaScan(partial.mint);
    expect(scan!.accountingEligible).toBe(false);
    expect(scan!.concentrationEligible).toBe(false);
  });

  it("ratio null formats as 暂不可确认 not 0%", () => {
    expect(formatRatio(null)).toBe("暂不可确认");
    expect(formatRatio(undefined)).toBe("暂不可确认");
    expect(formatRatio(0)).toBe("0.00%");
  });

  it("wallets are Tier-B unverified and never smart money confirmed", async () => {
    const { summary, items } = await ds.listWallets();
    expect(summary.alpha).toBe(0);
    expect(summary.tierBUsablePool).toBe(1370);
    expect(summary.tierBShortlist).toBe(8);
    expect(summary.manualReview).toBe(9);
    expect(summary.mapped).toBe(0);
    expect(summary.unavailablePeriodWallets).toBe(84);
    expect(summary.verificationStatus).toBe("unverified");
    expect(summary.disclaimer.toLowerCase()).toContain("not confirmed on-chain smart money");
    for (const w of items) {
      expect(w.verificationStatus).toBe("unverified");
      // Sample wallets remain fingerprint/synthetic only — no plaintext Solana address bulk.
      expect(w.id).toMatch(/^(fp-|demo-)/);
      expect(w.fingerprint.length).toBeLessThan(48);
      expect(w.fingerprint).not.toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    }
  });

  it("demo address labels can be saved locally", async () => {
    await ds.saveLocalDemoLabel({ addressId: "demo-addr-1", label: "shell_test_label", note: "n1" });
    const list = await ds.listAddressLabels();
    const hit = list.find((a) => a.id === "demo-addr-1");
    expect(hit?.labels.some((l) => l.label === "shell_test_label")).toBe(true);
    expect(hit?.note).toBe("n1");
  });

  it("fixture createCaHolderTask does not use network provider", async () => {
    const t = await ds.createCaHolderTask("H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump");
    expect(t.provider).toContain("fixture");
    expect(t.requestsUsed).toBe(0);
    expect(t.requestBudget).toBe(0);
    expect(t.warnings).toContain("local_demo_task_no_provider");
  });

  it("missing fixture returns null", async () => {
    expect(await ds.getCaScan("does-not-exist-mint")).toBeNull();
    expect(await ds.getWallet("missing-wallet")).toBeNull();
  });

  it("meta is fixture non-live", () => {
    const meta = ds.getDataSourceMeta();
    expect(meta.mode).toBe("fixture");
    expect(meta.live).toBe(false);
  });
});
