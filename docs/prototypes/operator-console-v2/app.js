/* Offline SPA for Operator Console v2 design prototype. No network fetch. */
(function () {
  "use strict";

  var R = window.OcRender;
  var S = window.OcSynthetic;
  var stateKey = "oc_v2_sim_state";
  var routeKey = "oc_v2_route";

  function $(id) {
    return document.getElementById(id);
  }

  function getSimState() {
    return localStorage.getItem(stateKey) || "partial";
  }

  function setSimState(v) {
    localStorage.setItem(stateKey, v);
  }

  function parseHash() {
    var h = (location.hash || "#/ca").replace(/^#/, "") || "/ca";
    var parts = h.split("/").filter(Boolean);
    return { path: "/" + parts.join("/"), parts: parts };
  }

  function navigate(path) {
    location.hash = path.charAt(0) === "#" ? path : "#" + path;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function badgeHtml(label) {
    var b = R.stateBadge(
      String(label || "")
        .toLowerCase()
        .replace(/\s+/g, "_")
    );
    var cls = "badge muted";
    var u = String(label || "").toUpperCase();
    if (
      u === "CONFIRMED" ||
      u === "COMPLETE" ||
      u === "OK" ||
      u === "COMPLETED" ||
      u === "SUCCEEDED"
    )
      cls = "badge ok";
    else if (
      u === "PARTIAL" ||
      u === "RUNNING" ||
      u === "QUEUED" ||
      u === "STALE_RESULT" ||
      u === "UNVERIFIED"
    )
      cls = "badge warn";
    else if (
      u === "FAILED" ||
      u === "BLOCKED" ||
      u === "BLOCKED_CREDENTIAL" ||
      u === "BUDGET_EXHAUSTED" ||
      u === "SCHEMA_ERROR" ||
      u === "REJECTED" ||
      u === "UNAVAILABLE"
    )
      cls = "badge bad";
    else if (u === "EMPTY") cls = "badge muted";
    return '<span class="' + cls + '" title="' + esc(u) + '"><span aria-hidden="true">●</span> ' + esc(u) + "</span>";
  }

  function trustStripHtml(ca) {
    if (!ca) {
      return (
        '<div class="grid-5">' +
        ["Accounting", "Exclusion Coverage", "Concentration", "Market Data", "Wallet Intelligence"]
          .map(function (d) {
            return (
              '<div class="trust-cell"><div class="domain">' +
              esc(d) +
              '</div><div style="margin-top:6px">' +
              badgeHtml("UNAVAILABLE") +
              '</div><div class="reason">No result payload</div></div>'
            );
          })
          .join("") +
        "</div>"
      );
    }
    var accounting = ca.accountingEligible
      ? "CONFIRMED"
      : ca.accounting && ca.accounting.completeness === "partial"
        ? "PARTIAL"
        : "UNVERIFIED";
    var exclusion = String(ca.exclusionCoverage || "unavailable").toUpperCase();
    var concentration = ca.concentrationEligible ? "CONFIRMED" : "UNVERIFIED";
    var market = ca.marketDataStatus || "UNVERIFIED";
    var wallet = ca.walletIntelStatus || "UNVERIFIED";
    var cells = [
      {
        d: "Accounting",
        s: accounting,
        r: ca.accountingEligible
          ? "pagination + residual gate passed"
          : "accounting incomplete or residual open",
        w: ca.accounting && ca.accounting.paginationComplete ? 0 : 1,
      },
      {
        d: "Exclusion Coverage",
        s: exclusion,
        r: exclusion === "COMPLETE" ? "pool/LP/infra exclusions complete" : "pool exclusion incomplete",
        w: exclusion === "COMPLETE" ? 0 : 1,
      },
      {
        d: "Concentration",
        s: concentration,
        r: ca.concentrationEligible
          ? "eligible under cleaned universe"
          : "blocked until exclusion complete",
        w: (ca.concentrationWarnings || []).length,
      },
      {
        d: "Market Data",
        s: market,
        r: "Tier-B enrichment · source=" + ((ca.market && ca.market.source) || "—"),
        w: ca.market && ca.market.boostsActive ? 1 : 0,
      },
      {
        d: "Wallet Intelligence",
        s: wallet,
        r: "Tier-B observations only · not confirmed smart money",
        w: (ca.addressHits || []).length,
      },
    ];
    return (
      '<div class="grid-5" role="group" aria-label="Trust strip five domains">' +
      cells
        .map(function (c) {
          return (
            '<div class="trust-cell">' +
            '<div class="domain">' +
            esc(c.d) +
            "</div>" +
            '<div style="margin-top:6px">' +
            badgeHtml(c.s) +
            "</div>" +
            '<div class="reason">' +
            esc(c.r) +
            "</div>" +
            '<div class="meta">warnings: ' +
            c.w +
            ' · <a href="#" data-evidence="1">details</a></div>' +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function concentrationTable(ca) {
    if (!ca || !ca.concentration) {
      return '<p class="muted">No concentration payload (fail-closed / empty).</p>';
    }
    var keys = ["top1", "top5", "top10", "top20", "top50", "top100"];
    var rows = keys
      .map(function (k) {
        var cell = R.concentrationCell(ca.concentration[k]);
        return (
          "<tr>" +
          "<td>" +
          esc(k) +
          "</td>" +
          '<td class="mono">' +
          esc(cell.numerator) +
          "</td>" +
          '<td class="mono">' +
          esc(cell.denominator) +
          "</td>" +
          "<td><strong>" +
          esc(cell.ratioText) +
          "</strong>" +
          (cell.nonConfirmable ? ' <span class="muted">(not 0%)</span>' : "") +
          "</td>" +
          "<td>" +
          badgeHtml(cell.verification) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="table-scroll"><table class="data" aria-label="Concentration table">' +
      "<thead><tr><th>Band</th><th>Numerator</th><th>Denominator</th><th>Ratio</th><th>Verification</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table></div>" +
      (ca.concentrationWarnings && ca.concentrationWarnings.length
        ? '<ul class="muted" style="margin:8px 0 0 16px">' +
          ca.concentrationWarnings.map(function (w) {
            return "<li class=\"mono\">" + esc(w) + "</li>";
          }).join("") +
          "</ul>"
        : "")
    );
  }

  function openEvidence(payload) {
    $("drawer-backdrop").classList.add("open");
    $("evidence-drawer").classList.add("open");
    $("evidence-body").innerHTML =
      '<div class="kv">' +
      '<div class="k">source</div><div class="mono">' +
      esc(payload.source || "synthetic") +
      "</div>" +
      '<div class="k">tier</div><div>' +
      esc(payload.tier || "A/B mixed") +
      "</div>" +
      '<div class="k">verification</div><div>' +
      badgeHtml(payload.verification || "unverified") +
      "</div>" +
      '<div class="k">observedAt</div><div class="mono">' +
      esc(payload.observedAt || "—") +
      "</div>" +
      '<div class="k">ruleVersion</div><div class="mono">' +
      esc(payload.ruleVersion || "—") +
      "</div>" +
      '<div class="k">sourceWatermark</div><div class="mono">' +
      esc(payload.sourceWatermark || "—") +
      "</div>" +
      '<div class="k">warnings</div><div class="mono">' +
      esc((payload.warnings || []).join(", ") || "—") +
      "</div>" +
      '<div class="k">raw payload</div><div class="muted">retained server-side · not shown in browser</div>' +
      "</div>";
  }

  function closeEvidence() {
    $("drawer-backdrop").classList.remove("open");
    $("evidence-drawer").classList.remove("open");
  }

  function pageCaList() {
    var rows = S.CA_LIST.map(function (c) {
      return (
        "<tr>" +
        '<td><a href="#/ca/' +
        encodeURIComponent(c.mint) +
        '">' +
        esc(c.symbol || "—") +
        "</a></td>" +
        '<td class="mono">' +
        esc(c.mint) +
        "</td>" +
        "<td>" +
        badgeHtml(c.status) +
        "</td>" +
        "<td>" +
        badgeHtml(c.accountingEligible ? "CONFIRMED" : "UNVERIFIED") +
        "</td>" +
        "<td>" +
        badgeHtml(String(c.exclusionCoverage).toUpperCase()) +
        "</td>" +
        "<td>" +
        badgeHtml(c.concentrationEligible ? "CONFIRMED" : "UNVERIFIED") +
        "</td>" +
        '<td class="mono">' +
        esc(c.observedAt) +
        "</td>" +
        "</tr>"
      );
    }).join("");
    return (
      "<h1>CA 列表 · Research queue</h1>" +
      '<div class="panel"><div class="input-row">' +
      '<input id="ca-input" aria-label="Solana mint CA" placeholder="Paste Solana mint (synthetic demo)" value="' +
      esc(S.PUBLIC_PILOT_MINT) +
      '" />' +
      '<button class="btn primary" id="btn-scan" type="button">Create task (demo)</button>' +
      "</div>" +
      '<p class="muted" style="margin:8px 0 0">Primary action: submit CA holder task. No Swap/Buy/Sell/Copy Trade.</p></div>' +
      '<div class="panel table-scroll"><table class="data"><thead><tr>' +
      "<th>Symbol</th><th>Mint</th><th>Status</th><th>Accounting</th><th>Exclusion</th><th>Concentration</th><th>observedAt</th>" +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div>"
    );
  }

  function pageCaDetail(mint) {
    var sim = getSimState();
    var scenario = S.SCENARIOS[sim] || S.SCENARIOS.partial;
    var ca = scenario.ca;
    if (ca && mint && mint !== ca.mint && mint !== S.SYNTH_MINT) {
      /* still show scenario payload but keep requested mint in header for navigation demo */
      ca = Object.assign({}, ca, { mint: mint });
    }
    var banner =
      scenario.banner
        ? '<div class="banner ' +
          esc(scenario.banner.kind) +
          '" role="status">' +
          esc(scenario.banner.text) +
          "</div>"
        : "";
    if (sim === "schema_error" || !ca) {
      return (
        "<h1>CA 详情 · Schema fail-closed</h1>" +
        banner +
        '<div class="panel">' +
        badgeHtml("SCHEMA_ERROR") +
        '<p style="margin-top:8px">未知契约 — 不渲染可疑 holder/concentration 数值。</p>' +
        '<p class="muted">Task: ' +
        esc(scenario.task.taskId) +
        " · " +
        esc(scenario.task.failureReason || "") +
        "</p>" +
        '<p><a href="#/tasks/' +
        encodeURIComponent(scenario.task.taskId) +
        '">Open task</a></p>' +
        "</div>"
      );
    }

    var market = ca.market || {};
    var hits = (ca.addressHits || [])
      .map(function (h) {
        var tb = R.tierBLabel(h.label);
        return (
          "<tr>" +
          "<td>" +
          esc(h.kind) +
          "</td>" +
          "<td>" +
          esc(tb.display) +
          "</td>" +
          "<td>" +
          esc(h.source) +
          "</td>" +
          "<td>" +
          badgeHtml(h.verificationStatus) +
          "</td>" +
          "<td>" +
          esc(h.note) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      banner +
      '<div class="sticky-ca-header">' +
      "<div style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center\">" +
      "<h1 style=\"margin:0\">" +
      esc(ca.symbol || "—") +
      " · " +
      esc(ca.name || "unnamed") +
      " " +
      badgeHtml(ca.status) +
      "</h1>" +
      '<button class="btn" type="button" id="btn-copy-mint">Copy mint</button>' +
      '<button class="btn" type="button" id="btn-rescan">Rescan (new run)</button>' +
      '<button class="btn" type="button" id="btn-evidence">Evidence drawer</button>' +
      "</div>" +
      '<div class="mono" style="margin-top:6px">' +
      esc(ca.mint) +
      "</div>" +
      '<div class="muted" style="margin-top:4px">observedAt ' +
      esc(ca.observedAt) +
      " · watermark " +
      esc(ca.sourceWatermark) +
      " · task " +
      esc(scenario.task.taskId) +
      " · sim=" +
      esc(sim) +
      "</div></div>" +
      '<div class="panel"><h2>Trust Strip（五域拆分）</h2>' +
      trustStripHtml(ca) +
      "</div>" +
      '<div class="grid-2">' +
      '<div class="panel"><h2>Token / Market (Tier-B)</h2><div class="kv">' +
      '<div class="k">priceUsd</div><div class="mono">' +
      esc(market.priceUsd || "—") +
      "</div>" +
      '<div class="k">liquidityUsd</div><div class="mono">' +
      esc(market.liquidityUsd || "—") +
      "</div>" +
      '<div class="k">volume24h</div><div class="mono">' +
      esc(market.volume24h || "—") +
      "</div>" +
      '<div class="k">pair age (h)</div><div>' +
      esc(market.pairAgeHours != null ? market.pairAgeHours : "—") +
      "</div>" +
      '<div class="k">primary pair</div><div class="mono">' +
      esc(market.primaryPair || "—") +
      "</div>" +
      '<div class="k">source</div><div>' +
      badgeHtml("UNVERIFIED") +
      " " +
      esc(market.source || "—") +
      " · tier " +
      esc(market.tier || "B") +
      "</div>" +
      '<div class="k">boosts</div><div class="muted">active=' +
      esc(market.boostsActive != null ? market.boostsActive : "—") +
      " · paid exposure may affect heat</div>" +
      "</div></div>" +
      '<div class="panel"><h2>Holder universes</h2><div class="kv">' +
      '<div class="k">raw owners</div><div>' +
      esc(ca.ownerCounts.total) +
      "</div>" +
      '<div class="k">included</div><div>' +
      esc(ca.ownerCounts.included) +
      "</div>" +
      '<div class="k">excluded</div><div>' +
      esc(ca.ownerCounts.excluded) +
      "</div>" +
      '<div class="k">unresolved</div><div>' +
      esc(ca.ownerCounts.unresolved) +
      "</div>" +
      '<div class="k">token accounts</div><div>' +
      esc(ca.ownerCounts.tokenAccounts) +
      "</div>" +
      '<div class="k">universe</div><div class="mono">' +
      esc(ca.universeDefinition) +
      "</div>" +
      '<div class="k">ruleVersion</div><div class="mono">' +
      esc(ca.ruleVersion) +
      "</div>" +
      "</div></div></div>" +
      '<div class="panel"><h2>Concentration</h2>' +
      (!ca.concentrationEligible
        ? '<div class="banner warn" role="status">Concentration ineligible：ratio 显示「不可确认」，不是 0%。可显示 numerator/denominator observation。</div>'
        : "") +
      concentrationTable(ca) +
      "</div>" +
      '<div class="panel"><h2>Address hits</h2><div class="table-scroll"><table class="data"><thead><tr>' +
      "<th>Kind</th><th>Label</th><th>Source</th><th>Verification</th><th>Note</th>" +
      "</tr></thead><tbody>" +
      (hits || '<tr><td colspan="5" class="muted">No hits</td></tr>') +
      "</tbody></table></div>" +
      '<p class="muted" style="margin-top:8px">不得把 Tier-B hit 称为 confirmed smart money / insider。</p></div>' +
      '<div class="panel"><h2>Data quality</h2>' +
      (ca.issues && ca.issues.length
        ? '<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Severity</th><th>Evidence</th></tr></thead><tbody>' +
          ca.issues
            .map(function (i) {
              return (
                "<tr><td class=\"mono\">" +
                esc(i.code) +
                "</td><td>" +
                esc(i.severity) +
                '</td><td class="mono">' +
                esc((i.evidence || []).join("; ")) +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table></div>"
        : '<p class="muted">No data-quality issues in this scenario.</p>') +
      "</div>" +
      '<div class="panel placeholder-future"><strong>NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA</strong><br/>' +
      "Dev · Early Buyer · Cluster graph · Cross-CA · Replay — 占位，不伪装为已完成。</div>"
    );
  }

  function pageTasks() {
    var rows = S.TASKS.map(function (t) {
      return (
        "<tr>" +
        '<td><a href="#/tasks/' +
        encodeURIComponent(t.taskId) +
        '">' +
        esc(t.taskId) +
        "</a></td>" +
        '<td class="mono">' +
        esc((t.input && t.input.mint) || "—") +
        "</td>" +
        "<td>" +
        badgeHtml(t.status) +
        "</td>" +
        "<td>" +
        esc(t.requestsUsed) +
        "/" +
        esc(t.requestBudget) +
        "</td>" +
        "<td>" +
        esc(t.provider) +
        "</td>" +
        "</tr>"
      );
    }).join("");
    return (
      "<h1>Task Center</h1>" +
      '<div class="panel table-scroll"><table class="data"><thead><tr>' +
      "<th>Task</th><th>Input mint</th><th>Status</th><th>Budget</th><th>Provider</th>" +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div>"
    );
  }

  function pageTaskDetail(id) {
    var sim = getSimState();
    var scenario = S.SCENARIOS[sim] || S.SCENARIOS.partial;
    var t = null;
    for (var i = 0; i < S.TASKS.length; i++) {
      if (S.TASKS[i].taskId === id) t = S.TASKS[i];
    }
    if (!t) {
      t = Object.assign({}, scenario.task, { input: { mint: S.PUBLIC_PILOT_MINT }, provider: "helius" });
    }
    var badge = R.stateBadge(sim === "success" ? "success" : sim);
    return (
      "<h1>Task · " +
      esc(t.taskId || id) +
      " " +
      '<span class="' +
      badge.className +
      '">' +
      esc(badge.text) +
      "</span></h1>" +
      (scenario.banner
        ? '<div class="banner ' + esc(scenario.banner.kind) + '">' + esc(scenario.banner.text) + "</div>"
        : "") +
      '<div class="panel"><div class="kv">' +
      '<div class="k">input mint</div><div class="mono">' +
      esc((t.input && t.input.mint) || "—") +
      "</div>" +
      '<div class="k">provider</div><div>' +
      esc(t.provider || "helius") +
      "</div>" +
      '<div class="k">status</div><div>' +
      badgeHtml(t.status) +
      "</div>" +
      '<div class="k">budget</div><div>' +
      esc(t.requestsUsed) +
      " / " +
      esc(t.requestBudget) +
      ' <span class="muted">(exhausted ≠ complete)</span></div>' +
      '<div class="k">failureReason</div><div class="mono">' +
      esc(t.failureReason || "—") +
      "</div>" +
      '<div class="k">warnings</div><div class="mono">' +
      esc((t.warnings || []).join(", ") || "—") +
      "</div>" +
      '<div class="k">lineage</div><div class="mono">' +
      esc(JSON.stringify(t.lineage || { attempt: 1 })) +
      "</div>" +
      '<div class="k">result</div><div>' +
      (t.outputLink
        ? '<a href="' + esc(t.outputLink) + '">Open CA result</a>'
        : '<span class="muted">no output</span>') +
      "</div>" +
      "</div>" +
      '<p style="margin-top:10px"><button class="btn" type="button" id="btn-retry">Retry (new run, keep lineage)</button></p>' +
      "</div>"
    );
  }

  function pageWallets() {
    var rows = S.WALLETS.map(function (w) {
      return (
        "<tr>" +
        '<td><a href="#/wallets/' +
        encodeURIComponent(w.id) +
        '">' +
        esc(w.fingerprint) +
        "</a></td>" +
        "<td>" +
        esc(w.tier) +
        "</td>" +
        "<td>" +
        badgeHtml(w.verificationStatus) +
        "</td>" +
        "<td>" +
        esc(w.status7d) +
        " / " +
        esc(w.status30d) +
        "</td>" +
        "<td>" +
        esc(Math.round(w.completeness * 100)) +
        "%</td>" +
        "</tr>"
      );
    }).join("");
    return (
      "<h1>Wallets · Tier-B pools</h1>" +
      '<div class="banner warn">Third-party Tier-B observation · Not confirmed on-chain smart money</div>' +
      '<div class="panel table-scroll"><table class="data"><thead><tr>' +
      "<th>Fingerprint</th><th>Pool tier</th><th>Verification</th><th>7d/30d</th><th>Completeness</th>" +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div>"
    );
  }

  function pageWalletDetail(id) {
    var w = null;
    for (var i = 0; i < S.WALLETS.length; i++) if (S.WALLETS[i].id === id) w = S.WALLETS[i];
    if (!w) w = S.WALLETS[0];
    return (
      "<h1>Wallet · " +
      esc(w.fingerprint) +
      "</h1>" +
      '<div class="banner warn">' +
      esc(w.disclaimer) +
      "</div>" +
      '<div class="panel"><div class="kv">' +
      '<div class="k">id</div><div class="mono">' +
      esc(w.id) +
      "</div>" +
      '<div class="k">tier</div><div>' +
      esc(w.tier) +
      "</div>" +
      '<div class="k">verification</div><div>' +
      badgeHtml(w.verificationStatus) +
      "</div>" +
      '<div class="k">completeness</div><div>' +
      esc(w.completeness) +
      "</div>" +
      '<div class="k">warnings</div><div class="mono">' +
      esc((w.warnings || []).join(", ") || "—") +
      "</div>" +
      '<div class="k">labels</div><div>' +
      (w.labels || [])
        .map(function (l) {
          return esc(R.tierBLabel(l.label).display) + " (" + esc(l.source) + ")";
        })
        .join("<br/>") +
      "</div>" +
      '<div class="k">CA hits</div><div class="muted">' +
      esc(w.caHitsPlaceholder) +
      "</div>" +
      '<div class="k">note</div><div>' +
      esc(w.note) +
      "</div>" +
      "</div></div>"
    );
  }

  function pageAddresses() {
    var rows = S.ADDRESSES.map(function (a) {
      return (
        "<tr>" +
        "<td>" +
        esc(a.display) +
        "</td>" +
        "<td>" +
        (a.labels || [])
          .map(function (l) {
            return esc(l.label);
          })
          .join(", ") +
        "</td>" +
        "<td>" +
        esc(a.source) +
        "</td>" +
        "<td>" +
        badgeHtml(a.verificationStatus) +
        "</td>" +
        "<td>" +
        esc(a.note) +
        "</td>" +
        "</tr>"
      );
    }).join("");
    return (
      "<h1>Address Library</h1>" +
      '<div class="panel"><p class="muted">Long-term cognitive asset: tags, notes, source, confidence, verification, version history (demo).</p>' +
      '<div class="table-scroll"><table class="data"><thead><tr>' +
      "<th>Address</th><th>Labels</th><th>Source</th><th>Verification</th><th>Note</th>" +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div></div>"
    );
  }

  function pagePlaceholder(title, note) {
    return (
      "<h1>" +
      esc(title) +
      "</h1>" +
      '<div class="panel placeholder-future"><strong>NOT_WIRED · FUTURE_MILESTONE · NO_LIVE_DATA</strong><br/>' +
      esc(note) +
      "</div>"
    );
  }

  function setActiveNav(path) {
    var links = document.querySelectorAll("nav a[data-nav]");
    for (var i = 0; i < links.length; i++) {
      var p = links[i].getAttribute("data-nav");
      links[i].classList.toggle("active", path === p || path.indexOf(p + "/") === 0);
    }
  }

  function render() {
    var route = parseHash();
    var parts = route.parts;
    var root = parts[0] || "ca";
    var view = $("view");
    var html = "";
    if (root === "ca" && parts[1]) html = pageCaDetail(decodeURIComponent(parts[1]));
    else if (root === "ca") html = pageCaList();
    else if (root === "tasks" && parts[1]) html = pageTaskDetail(decodeURIComponent(parts[1]));
    else if (root === "tasks") html = pageTasks();
    else if (root === "wallets" && parts[1]) html = pageWalletDetail(decodeURIComponent(parts[1]));
    else if (root === "wallets") html = pageWallets();
    else if (root === "addresses") html = pageAddresses();
    else if (root === "watchlist")
      html = pagePlaceholder("Watchlist", "Local watchlist + alert policy — design only.");
    else if (root === "schedules")
      html = pagePlaceholder("Schedules", "Cron/schedules Owner-gated — not G1.");
    else if (root === "replay")
      html = pagePlaceholder("Replay", "As-of historical replay engine — G6 boundary.");
    else if (root === "liquidity")
      html = pagePlaceholder("Liquidity dashboard", "Daily macro liquidity — separate from CA hotpath SLA.");
    else if (root === "settings")
      html = pagePlaceholder("Settings", "Fixture/Live indicator, budget defaults, display density.");
    else html = pageCaList();

    view.innerHTML =
      html +
      '<p class="footer-note">Offline synthetic prototype · network requests for demo data = 0 · ' +
      esc(R.watermarkText()) +
      "</p>";

    setActiveNav("/" + root);
    $("sim-state").value = getSimState();
    $("live-meta").textContent =
      "mode=fixture · live=false · sim=" + getSimState() + " · " + R.watermarkText();

    var btnScan = $("btn-scan");
    if (btnScan) {
      btnScan.onclick = function () {
        navigate("/tasks/task_synth_001");
      };
    }
    var btnCopy = $("btn-copy-mint");
    if (btnCopy) {
      btnCopy.onclick = function () {
        /* no clipboard permission required for prototype */
        btnCopy.textContent = "Copied (demo)";
        setTimeout(function () {
          btnCopy.textContent = "Copy mint";
        }, 800);
      };
    }
    var btnRescan = $("btn-rescan");
    if (btnRescan) {
      btnRescan.onclick = function () {
        navigate("/tasks/task_synth_001");
      };
    }
    var btnEv = $("btn-evidence");
    if (btnEv) {
      btnEv.onclick = function () {
        var sim = getSimState();
        var sc = S.SCENARIOS[sim] || S.SCENARIOS.partial;
        var ca = sc.ca || {};
        openEvidence({
          source: ca.provider || "synthetic",
          tier: "A (chain) + B (market)",
          verification: ca.concentrationEligible ? "mixed" : "unverified",
          observedAt: ca.observedAt,
          ruleVersion: ca.ruleVersion,
          sourceWatermark: ca.sourceWatermark,
          warnings: ca.concentrationWarnings || sc.task.warnings || [],
        });
      };
    }
    var btnRetry = $("btn-retry");
    if (btnRetry) {
      btnRetry.onclick = function () {
        alert("Demo: retry creates a NEW run with lineage.parentTaskId set. No live call.");
      };
    }
    view.querySelectorAll("[data-evidence]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        if (btnEv) btnEv.click();
        else
          openEvidence({
            source: "trust-strip",
            tier: "A/B",
            verification: "unverified",
            observedAt: new Date().toISOString(),
            warnings: [],
          });
      });
    });
  }

  function init() {
    if (location.protocol === "file:") {
      $("file-hint").hidden = false;
    }
    $("wm").textContent = R.watermarkText();
    $("sim-state").onchange = function (e) {
      setSimState(e.target.value);
      render();
    };
    $("drawer-close").onclick = closeEvidence;
    $("drawer-backdrop").onclick = closeEvidence;
    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#/ca";
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
