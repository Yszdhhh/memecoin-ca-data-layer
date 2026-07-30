import fs from "node:fs";
import path from "node:path";
import { runBatchCardinalityDiagnostic } from "../application/gmgn/wallet-stats-batch-cardinality-diagnostic.js";

const INPUT_DIR="C:/Users/10639/chainfm_out/sol";
const OUTPUT_DIR="C:/Users/10639/chainfm_out/sol/derived/gmgn-wallet-stats-batch-cardinality-live-diagnostic-001";
const REPORT_PATH=path.resolve("harness/reports/SOL-GMGN-WALLET-STATS-BATCH-CARDINALITY-LIVE-DIAGNOSTIC-001/acceptance.md");

function render(result: Awaited<ReturnType<typeof runBatchCardinalityDiagnostic>>): string {
  const e=result.envelope;
  return `# Acceptance Report: SOL-GMGN-WALLET-STATS-BATCH-CARDINALITY-LIVE-DIAGNOSTIC-001

## Verdict

**${result.status}**

## Request and input controls

- Input hashes matched: ${result.inputHashesMatch}
- Approved input hashes: 64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C, B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3
- Selection: first 20 valid unique Solana Base58 strict-32-byte addresses
- Selection fingerprint: ${result.selectionFingerprint ?? "null"}
- Period: 30d
- CLI/provider requests used / cap: ${result.requestBudgetUsed} / 1
- API key present: ${result.credentialApiKeyPresent}
- Diagnostic code: ${result.diagnosticCode ?? "null"}

## Sanitized response cardinality

- Envelope kind: ${e?.envelopeKind ?? "unavailable"}
- Requested wallet count: ${e?.requestedWalletCount ?? 20}
- Candidate record count: ${e?.candidateRecordCount ?? 0}
- Records with identity: ${e?.recordsWithIdentityCount ?? 0}
- Requested identities matched: ${e?.requestedIdentityMatchCount ?? 0}
- Requested identities missing: ${e?.requestedIdentityMissingCount ?? 20}
- Duplicate requested identities: ${e?.duplicateRequestedIdentityCount ?? 0}
- Identityless records: ${e?.identitylessRecordCount ?? 0}
- Response covers all requested wallets: ${e?.responseCoversAllRequestedWallets ?? false}

## Safety and decision boundary

No plaintext address, identity value, label, API/private key, credential/proxy URL, arbitrary provider key, raw provider payload, raw stdout/stderr, or complete exception is stored here or in external output. This task does not alter parser behavior and does not authorize a full rerun. A zero-network independent audit must decide whether batch size 20 remains valid or transport must be repaired to one wallet per invocation.
`;
}
async function main(){
  if(fs.existsSync(OUTPUT_DIR))throw new Error("Refusing to overwrite diagnostic output");
  const result=await runBatchCardinalityDiagnostic({inputDir:INPUT_DIR});
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  fs.writeFileSync(path.join(OUTPUT_DIR,"summary.json"),JSON.stringify({...result,fetchedAt:new Date().toISOString()},null,2)+"\n","utf8");
  fs.mkdirSync(path.dirname(REPORT_PATH),{recursive:true});fs.writeFileSync(REPORT_PATH,render(result),"utf8");
  console.log("Task Status:",result.status);console.log("Input Hashes Match:",result.inputHashesMatch);console.log("CLI Requests Used:",result.requestBudgetUsed);console.log("Diagnostic Code:",result.diagnosticCode);console.log("Envelope:",result.envelope);console.log("Source: gmgn");console.log("Verification Status: unverified");
}
main().catch(()=>{console.error("Batch cardinality diagnostic failed safely");process.exit(1);});
