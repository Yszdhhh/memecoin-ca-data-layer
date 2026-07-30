/**
 * WATCHLIST-ALERTS-001 — local watchlist + research alert events.
 * Dedupe, cooldown, evidence links. No trade execution. No external push required.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const WATCHLIST_ALERTS_RULE_VERSION = "watchlist-alerts-v1";

export type WatchSubjectKind = "ca" | "address";
export type AlertKind =
  | "holder_change"
  | "dev_sell"
  | "address_hit"
  | "liquidity_anomaly"
  | "data_quality"
  | "manual";

export interface WatchlistItem {
  watchId: string;
  kind: WatchSubjectKind;
  subject: string;
  label: string | null;
  enabled: boolean;
  createdAt: string;
  cooldownMinutes: number;
}

export interface AlertEvent {
  alertId: string;
  watchId: string;
  kind: AlertKind;
  subject: string;
  summary: string;
  evidenceRefs: string[];
  evidenceLink: string | null;
  fingerprint: string;
  createdAt: string;
  read: boolean;
  /** Research notification only — never a trade instruction. */
  disclaimer: string;
}

export interface WatchlistStoreOptions {
  dataDir: string;
  now?: () => Date;
  defaultCooldownMinutes?: number;
}

function fingerprintOf(input: {
  watchId: string;
  kind: AlertKind;
  subject: string;
  summary: string;
  evidenceRefs: string[];
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      watchId: input.watchId,
      kind: input.kind,
      subject: input.subject,
      summary: input.summary,
      evidenceRefs: [...input.evidenceRefs].sort(),
    }))
    .digest("hex");
}

export class WatchlistAlertStore {
  private watches = new Map<string, WatchlistItem>();
  private alerts: AlertEvent[] = [];
  private readonly now: () => Date;
  private readonly defaultCooldownMinutes: number;

  constructor(private readonly options: WatchlistStoreOptions) {
    this.now = options.now ?? (() => new Date());
    this.defaultCooldownMinutes = options.defaultCooldownMinutes ?? 60;
    fs.mkdirSync(options.dataDir, { recursive: true });
    this.load();
  }

  private watchFile(): string {
    return path.join(this.options.dataDir, "watchlist.json");
  }
  private alertFile(): string {
    return path.join(this.options.dataDir, "alerts.json");
  }

  private load(): void {
    if (fs.existsSync(this.watchFile())) {
      for (const w of JSON.parse(fs.readFileSync(this.watchFile(), "utf8")) as WatchlistItem[]) {
        this.watches.set(w.watchId, w);
      }
    }
    if (fs.existsSync(this.alertFile())) {
      this.alerts = JSON.parse(fs.readFileSync(this.alertFile(), "utf8")) as AlertEvent[];
    }
  }

  save(): void {
    fs.writeFileSync(this.watchFile(), JSON.stringify([...this.watches.values()], null, 2), "utf8");
    fs.writeFileSync(this.alertFile(), JSON.stringify(this.alerts, null, 2), "utf8");
  }

  listWatches(): WatchlistItem[] {
    return [...this.watches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  addWatch(input: {
    kind: WatchSubjectKind;
    subject: string;
    label?: string;
    cooldownMinutes?: number;
  }): WatchlistItem {
    const subject = input.subject.trim();
    if (subject.length < 32) throw new Error("invalid_subject");
    // Dedupe active same subject
    for (const w of this.watches.values()) {
      if (w.kind === input.kind && w.subject === subject && w.enabled) return w;
    }
    const item: WatchlistItem = {
      watchId: randomUUID(),
      kind: input.kind,
      subject,
      label: input.label?.trim() || null,
      enabled: true,
      createdAt: this.now().toISOString(),
      cooldownMinutes: input.cooldownMinutes ?? this.defaultCooldownMinutes,
    };
    this.watches.set(item.watchId, item);
    this.save();
    return item;
  }

  setEnabled(watchId: string, enabled: boolean): WatchlistItem | null {
    const w = this.watches.get(watchId);
    if (!w) return null;
    w.enabled = enabled;
    this.save();
    return w;
  }

  removeWatch(watchId: string): boolean {
    const ok = this.watches.delete(watchId);
    if (ok) this.save();
    return ok;
  }

  listAlerts(opts?: { unreadOnly?: boolean; limit?: number }): AlertEvent[] {
    let rows = [...this.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (opts?.unreadOnly) rows = rows.filter((a) => !a.read);
    return rows.slice(0, opts?.limit ?? 100);
  }

  markRead(alertId: string): AlertEvent | null {
    const a = this.alerts.find((x) => x.alertId === alertId);
    if (!a) return null;
    a.read = true;
    this.save();
    return a;
  }

  markAllRead(): number {
    let n = 0;
    for (const a of this.alerts) {
      if (!a.read) {
        a.read = true;
        n += 1;
      }
    }
    if (n) this.save();
    return n;
  }

  /**
   * Emit alert with dedupe (same fingerprint) and cooldown window.
   * Returns null if suppressed.
   */
  emitAlert(input: {
    watchId: string;
    kind: AlertKind;
    summary: string;
    evidenceRefs: string[];
    evidenceLink?: string | null;
  }): AlertEvent | null {
    const watch = this.watches.get(input.watchId);
    if (!watch || !watch.enabled) return null;

    const fp = fingerprintOf({
      watchId: input.watchId,
      kind: input.kind,
      subject: watch.subject,
      summary: input.summary,
      evidenceRefs: input.evidenceRefs,
    });

    // Exact dedupe: identical open/unread fingerprint
    if (this.alerts.some((a) => a.fingerprint === fp)) return null;

    // Cooldown: same watchId+kind within cooldown window
    const now = this.now();
    const cooldownMs = watch.cooldownMinutes * 60_000;
    const recent = this.alerts.find(
      (a) =>
        a.watchId === input.watchId &&
        a.kind === input.kind &&
        now.getTime() - Date.parse(a.createdAt) < cooldownMs,
    );
    if (recent) return null;

    const event: AlertEvent = {
      alertId: randomUUID(),
      watchId: input.watchId,
      kind: input.kind,
      subject: watch.subject,
      summary: input.summary,
      evidenceRefs: [...input.evidenceRefs],
      evidenceLink: input.evidenceLink ?? (watch.kind === "ca" ? `/ca/${watch.subject}` : `/wallets/${watch.subject}`),
      fingerprint: fp,
      createdAt: now.toISOString(),
      read: false,
      disclaimer: "Research notification only — not a trade signal. No auto-execution.",
    };
    this.alerts.unshift(event);
    // Cap retention
    this.alerts = this.alerts.slice(0, 500);
    this.save();
    return event;
  }

  /** Evaluate simple offline checks against a CA analysis-like snapshot. */
  evaluateCaSnapshot(
    mint: string,
    snap: {
      concentrationEligible?: boolean | null;
      accountingEligible?: boolean | null;
      liquidityUsd?: number | null;
      addressHitCount?: number;
      mintAuthorityPresent?: boolean | null;
    },
  ): AlertEvent[] {
    const emitted: AlertEvent[] = [];
    const watches = this.listWatches().filter((w) => w.enabled && w.kind === "ca" && w.subject === mint);
    for (const w of watches) {
      if (snap.accountingEligible === false || snap.concentrationEligible === false) {
        const e = this.emitAlert({
          watchId: w.watchId,
          kind: "data_quality",
          summary: "Holder accounting/concentration gates incomplete (fail-closed).",
          evidenceRefs: ["gate:accounting", "gate:concentration"],
          evidenceLink: `/ca/${mint}`,
        });
        if (e) emitted.push(e);
      }
      if (typeof snap.liquidityUsd === "number" && snap.liquidityUsd < 5_000) {
        const e = this.emitAlert({
          watchId: w.watchId,
          kind: "liquidity_anomaly",
          summary: `Observed liquidity low: ${snap.liquidityUsd} USD (Tier-B observation).`,
          evidenceRefs: ["market:liquidity"],
          evidenceLink: `/ca/${mint}`,
        });
        if (e) emitted.push(e);
      }
      if ((snap.addressHitCount ?? 0) > 0) {
        const e = this.emitAlert({
          watchId: w.watchId,
          kind: "address_hit",
          summary: `${snap.addressHitCount} local address-library hit(s).`,
          evidenceRefs: ["address_store:hits"],
          evidenceLink: `/ca/${mint}`,
        });
        if (e) emitted.push(e);
      }
      if (snap.mintAuthorityPresent === true) {
        const e = this.emitAlert({
          watchId: w.watchId,
          kind: "dev_sell",
          summary: "Mint authority still present — review Dev/authority panel.",
          evidenceRefs: ["authority:mint"],
          evidenceLink: `/ca/${mint}`,
        });
        if (e) emitted.push(e);
      }
    }
    return emitted;
  }
}
