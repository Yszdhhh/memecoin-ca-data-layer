import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";

export interface CleanedAddressRecord {
  address: string;
  labelPrimary: string;
  labels: string[];
  labelCount: number;
  source: "chainfm_import";
  inputConfidence: "unverified_user_label";
}

export interface RejectedAddressRecord {
  rawAddress: unknown;
  reason: string;
  code: string;
  rawInput?: unknown;
}

export interface InputManifestHashes {
  [fileName: string]: string;
}

export interface CleanAddressDirectoryOptions {
  inputDir: string;
  outputDir: string;
  expectedHashes?: Record<string, string> | undefined;
  enforceConsistencyCheck?: boolean | undefined;
}

export interface CleanAddressDirectoryResult {
  status: "SUCCESS" | "FAIL";
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  inputHashes: InputManifestHashes;
  metrics: {
    totalInputAddressesFile: number;
    totalInputJsonRecords: number;
    cleanedCount: number;
    rejectCount: number;
    multiLabelCount: number;
    zeroLabelCount: number;
    uniqueAddressCount: number;
    addressSetMatch: boolean;
  };
  outputFiles: {
    cleanedJsonl: string;
    rejectsJsonl: string;
    sanitizedManifest: string;
    summary: string;
  };
}

export function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex").toUpperCase();
}

export function cleanLabels(rawLabels: unknown, rawJoined?: unknown): string[] {
  let candidates: string[] = [];

  if (Array.isArray(rawLabels)) {
    candidates = rawLabels.map((l) => String(l ?? ""));
  } else if (typeof rawLabels === "string") {
    candidates = rawLabels.split(/[\t,]+/);
  } else if (typeof rawJoined === "string") {
    candidates = rawJoined.split(/[\t,]+/);
  }

  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    const trimmed = item.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      cleaned.push(trimmed);
    }
  }

  return cleaned;
}

export async function cleanSolanaAddressDirectory(
  options: CleanAddressDirectoryOptions
): Promise<CleanAddressDirectoryResult> {
  const { inputDir, outputDir, expectedHashes } = options;

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const jsonPath = path.join(inputDir, "sol_address_labels.json");
  const txtPath = path.join(inputDir, "sol_addresses.txt");

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Required input file missing: sol_address_labels.json in ${inputDir}`);
  }
  if (!fs.existsSync(txtPath)) {
    throw new Error(`Required input file missing: sol_addresses.txt in ${inputDir}`);
  }

  // 1. Compute SHA256 hashes of input files
  const inputFiles = fs.readdirSync(inputDir).filter((f) => fs.statSync(path.join(inputDir, f)).isFile());
  const inputHashes: InputManifestHashes = {};

  for (const file of inputFiles) {
    inputHashes[file] = computeFileSha256(path.join(inputDir, file));
  }

  // 2. Validate expected SHA256 hashes if provided (fail-closed)
  if (expectedHashes && Object.keys(expectedHashes).length > 0) {
    for (const [fileName, expectedHash] of Object.entries(expectedHashes)) {
      const actualHash = inputHashes[fileName];
      if (!actualHash || actualHash.toUpperCase() !== expectedHash.toUpperCase()) {
        const error = new Error(`Input manifest hash mismatch for ${fileName}`);
        (error as any).code = "input_manifest_mismatch";
        throw error;
      }
    }
  }

  // 3. Read and parse sol_addresses.txt for address set cross-check
  const txtContent = fs.readFileSync(txtPath, "utf8");
  const txtLines = txtContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const txtValidAddresses = new Set<string>();

  for (const line of txtLines) {
    const norm = normalizeSolanaAddress(line);
    if (norm) {
      txtValidAddresses.add(norm);
    }
  }

  // 4. Read and parse sol_address_labels.json
  const jsonContent = fs.readFileSync(jsonPath, "utf8");
  const rawRecords = JSON.parse(jsonContent);

  if (!Array.isArray(rawRecords)) {
    throw new Error("sol_address_labels.json must contain a JSON array");
  }

  const cleanedRecords: CleanedAddressRecord[] = [];
  const rejectedRecords: RejectedAddressRecord[] = [];
  const jsonUniqueAddresses = new Set<string>();

  let multiLabelCount = 0;
  let zeroLabelCount = 0;

  for (const rawItem of rawRecords) {
    if (!rawItem || typeof rawItem !== "object") {
      rejectedRecords.push({
        rawAddress: null,
        reason: "Record is not an object",
        code: "INVALID_RECORD_FORMAT",
        rawInput: rawItem
      });
      continue;
    }

    const rawAddress = (rawItem as any).address;
    const normalized = normalizeSolanaAddress(rawAddress);

    if (!normalized) {
      rejectedRecords.push({
        rawAddress,
        reason: "Address is not a valid 32-byte Solana Base58 public key",
        code: "INVALID_SOLANA_ADDRESS",
        rawInput: rawItem
      });
      continue;
    }

    const labels = cleanLabels((rawItem as any).labels, (rawItem as any).labels_joined);

    let labelPrimary = "";
    if (typeof (rawItem as any).label_primary === "string" && (rawItem as any).label_primary.trim().length > 0) {
      labelPrimary = (rawItem as any).label_primary.trim();
    } else if (typeof (rawItem as any).labelPrimary === "string" && (rawItem as any).labelPrimary.trim().length > 0) {
      labelPrimary = (rawItem as any).labelPrimary.trim();
    } else if (labels.length > 0 && labels[0]) {
      labelPrimary = labels[0];
    }

    if (labels.length > 1) {
      multiLabelCount++;
    } else if (labels.length === 0) {
      zeroLabelCount++;
    }

    jsonUniqueAddresses.add(normalized);

    cleanedRecords.push({
      address: normalized,
      labelPrimary,
      labels,
      labelCount: labels.length,
      source: "chainfm_import",
      inputConfidence: "unverified_user_label"
    });
  }

  // 5. Cross-check address set integrity
  let addressSetMatch = true;
  if (txtValidAddresses.size !== jsonUniqueAddresses.size) {
    addressSetMatch = false;
  } else {
    for (const addr of txtValidAddresses) {
      if (!jsonUniqueAddresses.has(addr)) {
        addressSetMatch = false;
        break;
      }
    }
  }

  // 6. Write external outputs
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cleanedJsonlPath = path.join(outputDir, "cleaned.jsonl");
  const rejectsJsonlPath = path.join(outputDir, "rejects.jsonl");
  const manifestPath = path.join(outputDir, "sanitized_manifest.json");
  const summaryPath = path.join(outputDir, "summary.json");

  const cleanedLines = cleanedRecords.map((r) => JSON.stringify(r)).join("\n");
  fs.writeFileSync(cleanedJsonlPath, cleanedLines ? cleanedLines + "\n" : "", "utf8");

  const rejectsLines = rejectedRecords.map((r) => JSON.stringify(r)).join("\n");
  fs.writeFileSync(rejectsJsonlPath, rejectsLines ? rejectsLines + "\n" : "", "utf8");

  const metrics = {
    totalInputAddressesFile: txtLines.length,
    totalInputJsonRecords: rawRecords.length,
    cleanedCount: cleanedRecords.length,
    rejectCount: rejectedRecords.length,
    multiLabelCount,
    zeroLabelCount,
    uniqueAddressCount: jsonUniqueAddresses.size,
    addressSetMatch
  };

  const manifest = {
    version: "v1",
    source: "chainfm_import",
    timestamp: new Date().toISOString(),
    inputHashes,
    metrics,
    outputFiles: {
      cleanedJsonl: path.basename(cleanedJsonlPath),
      rejectsJsonl: path.basename(rejectsJsonlPath),
      sanitizedManifest: path.basename(manifestPath),
      summary: path.basename(summaryPath)
    },
    status: "SUCCESS"
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const summary = {
    status: "SUCCESS",
    metrics,
    inputHashes
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  return {
    status: "SUCCESS",
    inputHashes,
    metrics,
    outputFiles: {
      cleanedJsonl: cleanedJsonlPath,
      rejectsJsonl: rejectsJsonlPath,
      sanitizedManifest: manifestPath,
      summary: summaryPath
    }
  };
}
