import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SolanaHolderSnapshotService,
  type SolanaHolderSnapshotSource,
  type SolanaTokenAccountPage,
} from "../../../src/infrastructure/solana/holders/solana-holder-snapshot-service.js";
import type { AddressTag, ClusterMember } from "../../../src/domain/types.js";

interface Fixture {
  token_address: string;
  total_supply_raw: string;
  pages: Array<{
    accounts: Array<{ token_account_address: string; owner_address: string; balance_raw: string }>;
    next_cursor?: string;
    watermark: { source: string; observed_at: string; finalized_slot?: string; cursor?: string; completeness: "complete" | "partial" };
  }>;
  address_tags: Array<{ address: string; role: AddressTag["role"]; source: AddressTag["source"]; confidence: number }>;
  cluster_members: Array<{ address: string; cluster_id: string; confidence: number; evidence: Record<string, unknown> }>;
}

async function loadFixture(): Promise<Fixture> {
  return JSON.parse(
    await readFile(new URL("../../fixtures/solana/holders/holder-snapshot.json", import.meta.url), "utf8"),
  ) as Fixture;
}

function pageSource(fixture: Fixture, calls: Array<string | undefined>): SolanaHolderSnapshotSource {
  return {
    async getTokenAccountPage(_tokenAddress, cursor) {
      calls.push(cursor);
      const page = fixture.pages[cursor === undefined ? 0 : 1];
      if (!page) throw new Error(`Unknown fixture cursor: ${cursor}`);
      return {
        accounts: page.accounts.map((account) => ({
          tokenAccountAddress: account.token_account_address,
          ownerAddress: account.owner_address,
          balanceRaw: BigInt(account.balance_raw),
        })),
        ...(page.next_cursor ? { nextCursor: page.next_cursor } : {}),
        watermark: {
          source: page.watermark.source,
          observedAt: new Date(page.watermark.observed_at),
          ...(page.watermark.finalized_slot ? { finalizedSlot: BigInt(page.watermark.finalized_slot) } : {}),
          ...(page.watermark.cursor ? { cursor: page.watermark.cursor } : {}),
          completeness: page.watermark.completeness,
        },
      };
    },
  };
}

function requestFromFixture(fixture: Fixture) {
  return {
    tokenAddress: fixture.token_address,
    totalSupplyRaw: BigInt(fixture.total_supply_raw),
    addressTags: fixture.address_tags.map((tag) => ({ chain: "solana" as const, ...tag })),
    clusterMembers: fixture.cluster_members.map((member) => ({
      address: member.address,
      clusterId: member.cluster_id,
      confidence: member.confidence,
      evidence: member.evidence,
    })),
  };
}

test("enumerates every fixture page, aggregates owners, and retains cleaning evidence", async () => {
  const fixture = await loadFixture();
  const calls: Array<string | undefined> = [];
  const snapshot = await new SolanaHolderSnapshotService(pageSource(fixture, calls)).build(requestFromFixture(fixture));

  assert.deepEqual(calls, [undefined, "page-2"]);
  assert.equal(snapshot.completeness, "complete");
  assert.equal(snapshot.rawTokenAccounts.length, 6);
  assert.equal(snapshot.ownerBalances.get("alice"), 150n);
  assert.equal(snapshot.ownerBalances.get("bob"), 360n);
  assert.equal(snapshot.concentration?.top20Pct, 58);
  assert.equal(snapshot.concentration?.excludedPct, 42);
  assert.equal(snapshot.concentration?.rows.find((row) => row.address === "low-cluster")?.excluded, false);

  assert.deepEqual(snapshot.cleaningEvidence.map((evidence) => evidence.exclusionReason), ["bonding_curve", "same_source_cluster"]);
  const curveEvidence = snapshot.cleaningEvidence.find((evidence) => evidence.address === "curve");
  assert.equal(curveEvidence?.confidence, 1);
  assert.equal(curveEvidence?.label?.role, "bonding_curve");
  assert.equal(curveEvidence?.rawTokenAccounts[0]?.balanceRaw, 300n);
  const clusterEvidence = snapshot.cleaningEvidence.find((evidence) => evidence.address === "high-cluster");
  assert.equal(clusterEvidence?.confidence, 0.92);
  assert.equal(clusterEvidence?.cluster?.evidence.funder, "source-wallet");
  assert.equal(clusterEvidence?.ruleVersion, "v1");
});

test("returns completeness and a warning instead of partial Top20 concentration", async () => {
  const fixture = await loadFixture();
  const calls: Array<string | undefined> = [];
  const source = pageSource(fixture, calls);
  const partialSource: SolanaHolderSnapshotSource = {
    async getTokenAccountPage(tokenAddress, cursor) {
      const page = await source.getTokenAccountPage(tokenAddress, cursor);
      if (cursor === "page-2") page.watermark.completeness = "partial";
      return page;
    },
  };

  const snapshot = await new SolanaHolderSnapshotService(partialSource).build(requestFromFixture(fixture));
  assert.equal(snapshot.completeness, "partial");
  assert.equal(snapshot.concentration, null);
  assert.equal(snapshot.cleaningEvidence.length, 0);
  assert.match(snapshot.warnings[0] ?? "", /partial/i);
});

test("returns partial without concentration when pages have different finalized boundaries", async () => {
  const fixture = await loadFixture();
  const source = pageSource(fixture, []);
  const mixedBoundarySource: SolanaHolderSnapshotSource = {
    async getTokenAccountPage(tokenAddress, cursor) {
      const page = await source.getTokenAccountPage(tokenAddress, cursor);
      if (cursor === "page-2") page.watermark.finalizedSlot = 434047821n;
      return page;
    },
  };

  const snapshot = await new SolanaHolderSnapshotService(mixedBoundarySource).build(requestFromFixture(fixture));
  assert.equal(snapshot.completeness, "partial");
  assert.equal(snapshot.concentration, null);
  assert.match(snapshot.warnings.join(" "), /different finalized snapshot boundaries/i);
});

test("returns partial without concentration when a page lacks a finalized boundary", async () => {
  const fixture = await loadFixture();
  const source = pageSource(fixture, []);
  const missingBoundarySource: SolanaHolderSnapshotSource = {
    async getTokenAccountPage(tokenAddress, cursor) {
      const page = await source.getTokenAccountPage(tokenAddress, cursor);
      if (cursor === "page-2") delete page.watermark.finalizedSlot;
      return page;
    },
  };

  const snapshot = await new SolanaHolderSnapshotService(missingBoundarySource).build(requestFromFixture(fixture));
  assert.equal(snapshot.completeness, "partial");
  assert.equal(snapshot.concentration, null);
  assert.match(snapshot.warnings.join(" "), /lacks a finalized snapshot boundary/i);
});

test("rejects overlapping token accounts rather than double counting them", async () => {
  const fixture = await loadFixture();
  const source = pageSource(fixture, []);
  const overlappingSource: SolanaHolderSnapshotSource = {
    async getTokenAccountPage(tokenAddress, cursor) {
      const page = await source.getTokenAccountPage(tokenAddress, cursor);
      if (cursor === "page-2") {
        page.accounts.push({ tokenAccountAddress: "alice-ata-1", ownerAddress: "alice", balanceRaw: 100n });
      }
      return page;
    },
  };

  await assert.rejects(
    new SolanaHolderSnapshotService(overlappingSource).build(requestFromFixture(fixture)),
    /token account repeated: alice-ata-1/,
  );
});

test("rejects a repeated enumeration cursor rather than truncating holders", async () => {
  const page: SolanaTokenAccountPage = {
    accounts: [],
    nextCursor: "same-cursor",
    watermark: { source: "fixture", observedAt: new Date("2026-07-20T00:00:00Z"), completeness: "complete" },
  };
  const source: SolanaHolderSnapshotSource = { async getTokenAccountPage() { return page; } };

  await assert.rejects(
    new SolanaHolderSnapshotService(source).build({ tokenAddress: "fixture-mint", totalSupplyRaw: 1n, addressTags: [], clusterMembers: [] }),
    /cursor repeated/,
  );
});
