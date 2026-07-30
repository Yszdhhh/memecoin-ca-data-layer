import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBoundedSignedHoldingsSmoke } from "../application/gmgn/signed-cumulative-holdings-live-smoke.js";

const externalDirectory = "C:\\Users\\10639\\chainfm_out\\sol";
const cliPath = fileURLToPath(new URL("../../node_modules/gmgn-cli/dist/index.js", import.meta.url));

const result = await runBoundedSignedHoldingsSmoke({
  addressesPath: path.join(externalDirectory, "sol_addresses.txt"),
  labelsPath: path.join(externalDirectory, "sol_address_labels.json"),
  expectedAddressesSha256: "64764807CCFED755A2E4C0316D44FF589ACC49EFF8F2C1F299DC48662997D87C",
  expectedLabelsSha256: "B0BF00E9D7E90F28EEB5F12E9DFBB467D24C3C341E182304FF43B79EC8FE6FC3",
  cliPath,
  runtimeEnvironment: process.env,
});

process.stdout.write(`${JSON.stringify(result)}\n`);
