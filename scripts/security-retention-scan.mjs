/**
 * SECURITY-RETENTION-CI-001 — offline secret / private-path / bundle scans.
 * Exit 1 on high-confidence leaks in tracked files.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const patterns = [
  { id: "helius_key_assignment", re: /HELIUS_API_KEY\s*=\s*['"][a-zA-Z0-9_-]{16,}/ },
  { id: "generic_api_key_literal", re: /api[_-]?key['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i },
  { id: "private_key_json", re: /"private_key"\s*:\s*"/i },
  { id: "chainfm_bulk_path_committed", re: /chainfm_out\/(addresses|address_labels)\.(txt|json|csv)/ },
  // Real DPAPI blobs / CryptUnprotect usage with ciphertext — not policy docs mentioning DPAPI.
  { id: "dpapi_material", re: /CryptUnprotectData\s*\(|AQAAANCMnd8B|dpapi[_-]?blob\s*[:=]\s*['"][A-Za-z0-9+/=]{40,}/i },
];

function listTracked() {
  const out = execSync("git ls-files", { encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

const findings = [];
for (const rel of listTracked()) {
  if (rel.includes("node_modules") || rel.endsWith(".png") || rel.endsWith(".lock")) continue;
  // allow this scanner and docs to mention names
  if (rel.endsWith("security-retention-scan.mjs")) continue;
  const full = path.join(root, rel);
  let text;
  try {
    text = fs.readFileSync(full, "utf8");
  } catch {
    continue;
  }
  if (text.length > 2_000_000) continue;
  for (const p of patterns) {
    if (p.re.test(text)) {
      findings.push({ file: rel, id: p.id });
    }
  }
}

// Bundle scan if present
const bundleDir = path.join(root, "apps/operator-console/dist/assets");
if (fs.existsSync(bundleDir)) {
  for (const f of fs.readdirSync(bundleDir)) {
    if (!f.endsWith(".js")) continue;
    const text = fs.readFileSync(path.join(bundleDir, f), "utf8");
    if (/HELIUS_API_KEY\s*[:=]\s*['"][^'"]+['"]/.test(text) || /api[_-]?key['"]?\s*:\s*['"][a-zA-Z0-9_\-]{20,}/i.test(text)) {
      findings.push({ file: `apps/operator-console/dist/assets/${f}`, id: "bundle_secret" });
    }
  }
}

const report = {
  taskId: "SECURITY-RETENTION-CI-001",
  scannedAt: new Date().toISOString(),
  findingCount: findings.length,
  findings,
  verdict: findings.length === 0 ? "GREEN" : "FAIL",
};

const outDir = path.join(root, "harness/reports/SECURITY-RETENTION-CI-001");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "scan.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(findings.length === 0 ? 0 : 1);
