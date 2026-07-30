/**
 * ADDRESS-STORE-SCHEMA-001 / LABEL-OPS / CA-ADDRESS-HIT — local file-backed store.
 * PostgreSQL remains optional; this store never commits private bulk to Git.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type AddressTier = "A" | "B" | "unknown";
export type LabelVerification = "unverified" | "confirmed" | "rejected" | "insufficient";

export interface AddressLabel {
  label: string;
  source: string;
  tier: AddressTier;
  confidence: number;
  verificationStatus: LabelVerification;
  validFrom: string;
  validTo: string | null;
  note?: string;
}

export interface AddressRecord {
  address: string;
  alias: string | null;
  labels: AddressLabel[];
  firstSeen: string;
  lastSeen: string;
  reviewStatus: "none" | "queued" | "reviewed";
}

export interface AddressHit {
  owner: string;
  labels: AddressLabel[];
  verificationStatus: LabelVerification;
  tier: AddressTier;
}

export interface ImportSummary {
  sourcePath: string;
  sourceSha256: string;
  imported: number;
  skipped: number;
  shortlist: number;
  review: number;
  usablePool: number;
  /** Irreversible digest for Git — not the address list. */
  irreversibleDigest: string;
}

export class LocalAddressStore {
  private readonly byAddress = new Map<string, AddressRecord>();

  constructor(private readonly dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.load();
  }

  private storePath(): string {
    return path.join(this.dataDir, "addresses.json");
  }

  private load(): void {
    const p = this.storePath();
    if (!fs.existsSync(p)) return;
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as AddressRecord[];
    for (const r of raw) this.byAddress.set(r.address, r);
  }

  save(): void {
    const all = [...this.byAddress.values()].sort((a, b) => a.address.localeCompare(b.address));
    fs.writeFileSync(this.storePath(), JSON.stringify(all, null, 2), "utf8");
  }

  get(address: string): AddressRecord | null {
    return this.byAddress.get(address) ?? null;
  }

  search(query: string, limit = 50): AddressRecord[] {
    const q = query.trim().toLowerCase();
    const out: AddressRecord[] = [];
    for (const r of this.byAddress.values()) {
      if (
        !q ||
        r.address.toLowerCase().includes(q) ||
        (r.alias && r.alias.toLowerCase().includes(q)) ||
        r.labels.some((l) => l.label.toLowerCase().includes(q))
      ) {
        out.push(r);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  upsertLabel(
    address: string,
    label: Omit<AddressLabel, "validFrom" | "validTo"> & { validFrom?: string },
  ): AddressRecord {
    const now = new Date().toISOString();
    let rec = this.byAddress.get(address);
    if (!rec) {
      rec = {
        address,
        alias: null,
        labels: [],
        firstSeen: now,
        lastSeen: now,
        reviewStatus: "none",
      };
      this.byAddress.set(address, rec);
    }
    rec.lastSeen = now;
    // Version: close previous same label+source
    for (const existing of rec.labels) {
      if (existing.label === label.label && existing.source === label.source && existing.validTo === null) {
        existing.validTo = now;
      }
    }
    rec.labels.push({
      label: label.label,
      source: label.source,
      tier: label.tier,
      confidence: label.confidence,
      verificationStatus: label.verificationStatus,
      validFrom: label.validFrom ?? now,
      validTo: null,
      ...(label.note ? { note: label.note } : {}),
    });
    // Confirmed only with explicit evidence path — never auto from Tier-B import.
    if (label.verificationStatus === "confirmed" && label.tier === "B") {
      rec.labels[rec.labels.length - 1]!.verificationStatus = "unverified";
    }
    return rec;
  }

  /**
   * Import from local chainfm_out-style JSON (array or {address,labels} rows).
   * Does not write address plaintext into Git — only returns digests.
   */
  importFromLocalFile(filePath: string, opts?: { shortlist?: Set<string>; review?: Set<string> }): ImportSummary {
    const buf = fs.readFileSync(filePath);
    const sourceSha256 = createHash("sha256").update(buf).digest("hex");
    const text = buf.toString("utf8");
    let rows: Array<{ address?: string; wallet?: string; labels?: string[] | string; tier?: string }> = [];
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) rows = parsed as typeof rows;
      else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { wallets?: unknown }).wallets)) {
        rows = (parsed as { wallets: typeof rows }).wallets;
      }
    } catch {
      // line-delimited addresses
      rows = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((address) => ({ address }));
    }

    let imported = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    const addressHashes: string[] = [];

    for (const row of rows) {
      const address = (row.address ?? row.wallet ?? "").trim();
      if (!address || address.length < 32) {
        skipped += 1;
        continue;
      }
      addressHashes.push(createHash("sha256").update(address).digest("hex"));
      const labels = Array.isArray(row.labels)
        ? row.labels
        : typeof row.labels === "string"
          ? row.labels.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
          : ["tierb_usable_pool"];
      for (const lab of labels) {
        this.upsertLabel(address, {
          label: lab,
          source: "chainfm_out_local_import",
          tier: "B",
          confidence: 0.5,
          verificationStatus: "unverified",
          validFrom: now,
          note: "Tier-B import only; never Alpha/confirmed smart money",
        });
      }
      if (opts?.shortlist?.has(address)) {
        this.upsertLabel(address, {
          label: "shortlist",
          source: "chainfm_out_local_import",
          tier: "B",
          confidence: 0.6,
          verificationStatus: "unverified",
        });
      }
      if (opts?.review?.has(address)) {
        const rec = this.byAddress.get(address);
        if (rec) rec.reviewStatus = "queued";
      }
      imported += 1;
    }

    this.save();
    addressHashes.sort();
    const irreversibleDigest = createHash("sha256").update(addressHashes.join("\n")).digest("hex");

    return {
      sourcePath: filePath,
      sourceSha256,
      imported,
      skipped,
      shortlist: opts?.shortlist?.size ?? 0,
      review: opts?.review?.size ?? 0,
      usablePool: imported,
      irreversibleDigest,
    };
  }

  /** Local set intersection — no per-wallet provider calls. */
  hitOwners(owners: readonly string[]): AddressHit[] {
    const hits: AddressHit[] = [];
    for (const owner of owners) {
      const rec = this.byAddress.get(owner);
      if (!rec) continue;
      const active = rec.labels.filter((l) => l.validTo === null);
      const tier: AddressTier = active.some((l) => l.tier === "A") ? "A" : active.some((l) => l.tier === "B") ? "B" : "unknown";
      const verificationStatus: LabelVerification = active.some((l) => l.verificationStatus === "confirmed")
        ? "confirmed"
        : "unverified";
      hits.push({ owner, labels: active, verificationStatus, tier });
    }
    return hits;
  }

  count(): number {
    return this.byAddress.size;
  }
}
