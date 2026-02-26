import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const currentPath = path.join(root, "catalog", "integrations.json");
const outputPath = path.join(root, "dist", "catalog", "changelog.json");

function getJsonFromGit(refSpec) {
  try {
    const stdout = execFileSync("git", ["show", refSpec], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}

function getShortHash(ref) {
  try {
    return execFileSync("git", ["rev-parse", "--short", ref], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function diffFields(previous, current) {
  const fields = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changed = [];
  for (const field of fields) {
    const left = JSON.stringify(previous[field]);
    const right = JSON.stringify(current[field]);
    if (left !== right) {
      changed.push(field);
    }
  }
  return changed;
}

async function main() {
  const current = JSON.parse(await fs.readFile(currentPath, "utf8"));
  const previous = getJsonFromGit("HEAD~1:catalog/integrations.json");

  const previousMap = new Map(previous.map((entry) => [entry.id, entry]));
  const currentMap = new Map(current.map((entry) => [entry.id, entry]));

  const changes = [];

  for (const entry of current) {
    const prev = previousMap.get(entry.id);
    if (!prev) {
      changes.push({ type: "added", id: entry.id, name: entry.name, details: ["new listing"] });
      continue;
    }

    const changedFields = diffFields(prev, entry);
    if (changedFields.length === 0) {
      continue;
    }

    if (entry.maturity === "deprecated" && prev.maturity !== "deprecated") {
      changes.push({ type: "deprecated", id: entry.id, name: entry.name, details: ["maturity -> deprecated"] });
      continue;
    }

    changes.push({ type: "updated", id: entry.id, name: entry.name, details: changedFields.slice(0, 8) });
  }

  for (const entry of previous) {
    if (!currentMap.has(entry.id)) {
      changes.push({ type: "removed", id: entry.id, name: entry.name, details: ["listing removed"] });
    }
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    generated_at: generatedAt,
    baseline_commit: getShortHash("HEAD~1"),
    current_commit: getShortHash("HEAD"),
    changes
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));

  console.log(`Generated changelog feed with ${changes.length} changes`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
