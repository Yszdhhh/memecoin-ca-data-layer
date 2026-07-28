import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  cleanSolanaAddressDirectory,
  cleanLabels,
  computeFileSha256
} from "../../../src/application/chainfm/clean-solana-address-directory.js";

// Synthetic test addresses (standard public base58 keys)
const SYNTHETIC_ADDR_1 = "11111111111111111111111111111111";
const SYNTHETIC_ADDR_2 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SYNTHETIC_ADDR_3 = "SysvarRent111111111111111111111111111111111";
const INVALID_ADDR = "00000000_NOT_BASE58_INVALID_ADDRESS";

test("cleanLabels cleans, trims, removes empty strings, and deduplicates preserving first order", () => {
  const input = ["  alpha_trader  ", "", "  alpha_trader  ", "smart_money  ", "  "];
  const result = cleanLabels(input);
  assert.deepEqual(result, ["alpha_trader", "smart_money"]);
});

test("cleanLabels handles comma and tab separated strings", () => {
  const input = "  alpha_trader \t smart_money, alpha_trader,  kol ";
  const result = cleanLabels(input);
  assert.deepEqual(result, ["alpha_trader", "smart_money", "kol"]);
});

test("cleanSolanaAddressDirectory processes synthetic directory correctly", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sol-chainfm-test-input-"));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "sol-chainfm-test-output-"));

  try {
    const addressesTxt = `${SYNTHETIC_ADDR_1}\n${SYNTHETIC_ADDR_2}\n${SYNTHETIC_ADDR_3}\n`;
    fs.writeFileSync(path.join(tmpDir, "sol_addresses.txt"), addressesTxt, "utf8");

    const jsonRecords = [
      {
        address: `  ${SYNTHETIC_ADDR_1}  `,
        label_primary: "  primary_tag_1  ",
        labels: ["  primary_tag_1  ", "tag_2", "primary_tag_1", ""],
        labels_joined: "primary_tag_1,tag_2",
        label_count: 2
      },
      {
        address: SYNTHETIC_ADDR_2,
        label_primary: "",
        labels: ["single_tag"],
        labels_joined: "single_tag",
        label_count: 1
      },
      {
        address: SYNTHETIC_ADDR_3,
        labels: [],
        label_count: 0
      },
      {
        address: INVALID_ADDR,
        labels: ["some_tag"],
        label_count: 1
      }
    ];
    fs.writeFileSync(path.join(tmpDir, "sol_address_labels.json"), JSON.stringify(jsonRecords, null, 2), "utf8");

    const result = await cleanSolanaAddressDirectory({
      inputDir: tmpDir,
      outputDir: outDir
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.metrics.cleanedCount, 3);
    assert.equal(result.metrics.rejectCount, 1);
    assert.equal(result.metrics.multiLabelCount, 1);
    assert.equal(result.metrics.zeroLabelCount, 1);

    // Verify cleaned.jsonl
    const cleanedContent = fs.readFileSync(path.join(outDir, "cleaned.jsonl"), "utf8");
    const cleanedLines = cleanedContent.trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(cleanedLines.length, 3);

    const rec1 = cleanedLines.find((r: any) => r.address === SYNTHETIC_ADDR_1);
    assert.ok(rec1);
    assert.equal(rec1.labelPrimary, "primary_tag_1");
    assert.deepEqual(rec1.labels, ["primary_tag_1", "tag_2"]);
    assert.equal(rec1.labelCount, 2);
    assert.equal(rec1.source, "chainfm_import");
    assert.equal(rec1.inputConfidence, "unverified_user_label");

    // Verify rejects.jsonl
    const rejectsContent = fs.readFileSync(path.join(outDir, "rejects.jsonl"), "utf8");
    const rejectsLines = rejectsContent.trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(rejectsLines.length, 1);
    assert.equal(rejectsLines[0].rawAddress, INVALID_ADDR);
    assert.equal(rejectsLines[0].code, "INVALID_SOLANA_ADDRESS");

    // Verify sanitized_manifest.json and summary.json
    assert.ok(fs.existsSync(path.join(outDir, "sanitized_manifest.json")));
    assert.ok(fs.existsSync(path.join(outDir, "summary.json")));

    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "sanitized_manifest.json"), "utf8"));
    assert.equal(manifest.status, "SUCCESS");
    assert.equal(manifest.source, "chainfm_import");
    assert.ok(manifest.inputHashes["sol_addresses.txt"]);
    assert.ok(manifest.inputHashes["sol_address_labels.json"]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("cleanSolanaAddressDirectory throws input_manifest_mismatch on expected hash failure", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sol-chainfm-hash-input-"));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "sol-chainfm-hash-output-"));

  try {
    fs.writeFileSync(path.join(tmpDir, "sol_addresses.txt"), `${SYNTHETIC_ADDR_1}\n`, "utf8");
    fs.writeFileSync(
      path.join(tmpDir, "sol_address_labels.json"),
      JSON.stringify([{ address: SYNTHETIC_ADDR_1, labels: ["test"] }]),
      "utf8"
    );

    const WRONG_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    await assert.rejects(
      async () => {
        await cleanSolanaAddressDirectory({
          inputDir: tmpDir,
          outputDir: outDir,
          expectedHashes: {
            "sol_addresses.txt": WRONG_HASH
          }
        });
      },
      (err: any) => {
        assert.equal(err.code, "input_manifest_mismatch");
        return true;
      }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
