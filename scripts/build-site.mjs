import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distDir = path.join(root, "dist");
const siteDir = path.join(root, "site");
const catalogDir = path.join(root, "catalog");

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.cp(siteDir, distDir, { recursive: true });
  await fs.cp(catalogDir, path.join(distDir, "catalog"), { recursive: true });

  execFileSync("node", ["scripts/generate-changelog.mjs"], {
    cwd: root,
    stdio: "inherit"
  });

  console.log(`Built site artifact at ${distDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
