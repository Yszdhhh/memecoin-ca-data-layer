import path from "node:path";
import { cleanSolanaAddressDirectory, CleanAddressDirectoryOptions } from "../application/chainfm/clean-solana-address-directory.js";

interface ParsedArgs {
  inputDir: string;
  outputDir: string;
  enforceManifest: boolean;
  expectedHashesJson?: string | undefined;
}

function parseArgs(args: string[]): ParsedArgs {
  let inputDir = "";
  let outputDir = "";
  let enforceManifest = false;
  let expectedHashesJson: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--input-dir" || arg === "-i") {
      inputDir = args[++i] || "";
    } else if (arg === "--output-dir" || arg === "-o") {
      outputDir = args[++i] || "";
    } else if (arg === "--enforce-manifest") {
      enforceManifest = true;
    } else if (arg === "--expected-hashes") {
      expectedHashesJson = args[++i];
    }
  }

  const res: ParsedArgs = { inputDir, outputDir, enforceManifest };
  if (expectedHashesJson !== undefined) {
    res.expectedHashesJson = expectedHashesJson;
  }
  return res;
}

async function main() {
  const args = process.argv.slice(2);
  const { inputDir, outputDir, expectedHashesJson } = parseArgs(args);

  if (!inputDir || !outputDir) {
    console.error(
      JSON.stringify({
        status: "FAIL",
        error_code: "INVALID_CLI_ARGS",
        message: "Usage: tsx src/cli/clean-solana-chainfm-addresses.ts --input-dir <path> --output-dir <path> [--expected-hashes <json>]"
      })
    );
    process.exit(1);
  }

  let expectedHashes: Record<string, string> | undefined;
  if (expectedHashesJson) {
    try {
      expectedHashes = JSON.parse(expectedHashesJson);
    } catch {
      console.error(
        JSON.stringify({
          status: "FAIL",
          error_code: "INVALID_EXPECTED_HASHES_JSON",
          message: "Failed to parse expected-hashes JSON argument"
        })
      );
      process.exit(1);
    }
  }

  try {
    const opts: CleanAddressDirectoryOptions = {
      inputDir: path.resolve(inputDir),
      outputDir: path.resolve(outputDir)
    };
    if (expectedHashes !== undefined) {
      opts.expectedHashes = expectedHashes;
    }

    const result = await cleanSolanaAddressDirectory(opts);

    console.log(
      JSON.stringify(
        {
          status: result.status,
          metrics: result.metrics,
          input_hashes: result.inputHashes,
          output_files: result.outputFiles
        },
        null,
        2
      )
    );
    process.exit(0);
  } catch (err: any) {
    const code = err.code || "INGEST_FAILED";
    console.error(
      JSON.stringify({
        status: "FAIL",
        error_code: code,
        message: err.message
      })
    );
    process.exit(1);
  }
}

main();
