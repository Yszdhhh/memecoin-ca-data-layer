import { execSync } from "node:child_process";

const pattern =
  "HELIUS_API_KEY[[:space:]]*=|api[_-]?key.{0,20}[A-Za-z0-9_-]{20,}|chainfm_out|wallet_master_private|DPAPI|private_key";

let out = "";
try {
  out = execSync(`git grep -n -I -E "${pattern}"`, { encoding: "utf8" });
} catch (e) {
  // git grep exit 1 = no matches
  out = (e && e.stdout && String(e.stdout)) || "";
}

const lines = out.split(/\r?\n/).filter(Boolean);

// Classify: policy/docs/tests mentioning patterns are not live credential leaks.
const leaks = lines.filter((l) => {
  if (/(^|\/)(docs|harness|test|scripts)\//.test(l)) return false;
  if (/\.md:/.test(l)) return false;
  if (/\.example/.test(l)) return false;
  if (/process\.env\.HELIUS_API_KEY|forbidden|redact|HELIUS_API_KEY not|credential_unavailable/.test(l)) {
    return false;
  }
  if (
    /FORBIDDEN_BODY_KEYS|apiKey|api_key|heliusApiKey/.test(l)
    && !(/=\s*['"][A-Za-z0-9_-]{20,}/.test(l))
  ) {
    return false;
  }
  return (
    /HELIUS_API_KEY\s*=\s*['"]?[A-Za-z0-9_-]{16,}/.test(l)
    || /api[_-]?key['"]?\s*[:=]\s*['"][A-Za-z0-9_-]{20,}/i.test(l)
  );
});

if (leaks.length) {
  console.error("SECURITY_SCAN_FAIL\n" + leaks.slice(0, 30).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: "PASS",
    matchedLines: lines.length,
    classifiedLeaks: 0,
    note: "policy docs hits are not leaks",
  }),
);
