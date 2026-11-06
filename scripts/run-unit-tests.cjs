const { readdirSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const files = readdirSync(path.join(__dirname, "../tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join(__dirname, "../tests", name));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
