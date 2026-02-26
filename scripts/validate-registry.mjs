import fs from "node:fs/promises";

const registryPath = new URL("../catalog/integrations.json", import.meta.url);

const allowedCategories = new Set(["source-of-truth", "automation", "cloud-sync", "reporting", "other"]);
const allowedMaturity = new Set(["incubating", "active", "deprecated"]);
const allowedSupport = new Set(["best_effort"]);
const idRegex = /^[a-z0-9-]+$/;
const maintainerRegex = /^@[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)?$/;
const upstreamRepoRegex = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function mustBeHttpsUrl(label, value, errors, prefix) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      errors.push(`${prefix}${label} must use https`);
    }
  } catch {
    errors.push(`${prefix}${label} must be a valid URL`);
  }
}

function parseDate(label, value, errors, prefix, options = {}) {
  if (!dateRegex.test(value)) {
    errors.push(`${prefix}${label} must match YYYY-MM-DD`);
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${prefix}${label} must be a valid date`);
    return null;
  }

  if (options.disallowFuture) {
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (parsed.getTime() > todayUtc) {
      errors.push(`${prefix}${label} cannot be in the future`);
    }
  }

  return parsed;
}

function validateEntry(entry, index, ids, errors, staleEntries) {
  const prefix = `entry[${index}] `;
  const required = [
    "id",
    "name",
    "summary",
    "repo_url",
    "docs_url",
    "category",
    "integration_targets",
    "maturity",
    "support_tier",
    "maintainers",
    "verified_by",
    "issue_url",
    "license",
    "last_release_date",
    "last_repo_commit_date",
    "last_verified_date",
    "compatibility",
    "security_notes"
  ];

  for (const key of required) {
    if (!(key in entry)) {
      errors.push(`${prefix}missing required field '${key}'`);
    }
  }

  if (typeof entry.id !== "string" || !idRegex.test(entry.id)) {
    errors.push(`${prefix}id must match ${idRegex}`);
  } else if (ids.has(entry.id)) {
    errors.push(`${prefix}id '${entry.id}' is duplicated`);
  } else {
    ids.add(entry.id);
  }

  if (typeof entry.name !== "string" || !entry.name.trim()) {
    errors.push(`${prefix}name must be a non-empty string`);
  }

  if (typeof entry.summary !== "string" || !entry.summary.trim() || entry.summary.length > 200) {
    errors.push(`${prefix}summary must be 1-200 characters`);
  }

  mustBeHttpsUrl("repo_url", entry.repo_url, errors, prefix);
  mustBeHttpsUrl("docs_url", entry.docs_url, errors, prefix);
  mustBeHttpsUrl("issue_url", entry.issue_url, errors, prefix);

  if (!allowedCategories.has(entry.category)) {
    errors.push(`${prefix}category must be one of: ${[...allowedCategories].join(", ")}`);
  }

  if (!Array.isArray(entry.integration_targets) || entry.integration_targets.length === 0) {
    errors.push(`${prefix}integration_targets must be a non-empty array`);
  }

  if (!allowedMaturity.has(entry.maturity)) {
    errors.push(`${prefix}maturity must be one of: ${[...allowedMaturity].join(", ")}`);
  }

  if (!allowedSupport.has(entry.support_tier)) {
    errors.push(`${prefix}support_tier must be one of: ${[...allowedSupport].join(", ")}`);
  }

  if (!Array.isArray(entry.maintainers) || entry.maintainers.length === 0) {
    errors.push(`${prefix}maintainers must be a non-empty array`);
  } else {
    for (const maintainer of entry.maintainers) {
      if (typeof maintainer !== "string" || !maintainerRegex.test(maintainer)) {
        errors.push(`${prefix}maintainer '${maintainer}' is invalid`);
      }
    }
  }

  if (typeof entry.verified_by !== "string" || !maintainerRegex.test(entry.verified_by)) {
    errors.push(`${prefix}verified_by must match ${maintainerRegex}`);
  }

  if (typeof entry.license !== "string" || !entry.license.trim()) {
    errors.push(`${prefix}license must be a non-empty string`);
  }

  parseDate("last_release_date", entry.last_release_date, errors, prefix);
  parseDate("last_repo_commit_date", entry.last_repo_commit_date, errors, prefix, { disallowFuture: true });
  const verifiedDate = parseDate("last_verified_date", entry.last_verified_date, errors, prefix, { disallowFuture: true });
  if (verifiedDate) {
    const now = new Date();
    const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const dayMs = 24 * 60 * 60 * 1000;
    const age = Math.floor((utcToday - verifiedDate.getTime()) / dayMs);
    if (age > 90) {
      staleEntries.push({ id: entry.id, age });
    }
  }

  if (typeof entry.compatibility !== "object" || entry.compatibility === null) {
    errors.push(`${prefix}compatibility must be an object`);
  } else {
    if (!entry.compatibility.forward_min_version) {
      errors.push(`${prefix}compatibility.forward_min_version is required`);
    }
    if (
      !Array.isArray(entry.compatibility.tested_environments) ||
      entry.compatibility.tested_environments.length === 0
    ) {
      errors.push(`${prefix}compatibility.tested_environments must be a non-empty array`);
    }
  }

  if (typeof entry.security_notes !== "string" || !entry.security_notes.trim()) {
    errors.push(`${prefix}security_notes must be a non-empty string`);
  }

  if (entry.deprecation) {
    if (typeof entry.deprecation !== "object" || entry.deprecation === null) {
      errors.push(`${prefix}deprecation must be an object if present`);
    } else {
      if (!entry.deprecation.status) {
        errors.push(`${prefix}deprecation.status is required when deprecation is present`);
      }
      if (!entry.deprecation.date) {
        errors.push(`${prefix}deprecation.date is required when deprecation is present`);
      } else {
        parseDate("deprecation.date", entry.deprecation.date, errors, prefix);
      }
      if (!entry.deprecation.replacement) {
        errors.push(`${prefix}deprecation.replacement is required when deprecation is present`);
      }
    }
  }

  if (entry.fork) {
    if (typeof entry.fork !== "object" || entry.fork === null) {
      errors.push(`${prefix}fork must be an object if present`);
    } else {
      if (typeof entry.fork.upstream_repo !== "string" || !upstreamRepoRegex.test(entry.fork.upstream_repo)) {
        errors.push(`${prefix}fork.upstream_repo must match ${upstreamRepoRegex}`);
      }
      if (typeof entry.fork.upstream_branch !== "string" || !entry.fork.upstream_branch.trim()) {
        errors.push(`${prefix}fork.upstream_branch must be a non-empty string`);
      }
      if (typeof entry.fork.fork_branch !== "string" || !entry.fork.fork_branch.trim()) {
        errors.push(`${prefix}fork.fork_branch must be a non-empty string`);
      }
      if (typeof entry.fork.note !== "string" || !entry.fork.note.trim()) {
        errors.push(`${prefix}fork.note must be a non-empty string`);
      }
    }
  }
}

async function main() {
  const raw = await fs.readFile(registryPath, "utf8");
  const data = JSON.parse(raw);

  const errors = [];
  const ids = new Set();
  const staleEntries = [];

  if (!Array.isArray(data)) {
    console.error("integrations.json must contain a top-level array");
    process.exit(1);
  }

  data.forEach((entry, index) => validateEntry(entry, index, ids, errors, staleEntries));

  if (errors.length > 0) {
    console.error("Registry validation failed:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Registry validation passed: ${data.length} entries`);

  if (staleEntries.length > 0) {
    console.warn("\nStale verification warning (>90 days):");
    for (const stale of staleEntries.sort((a, b) => b.age - a.age)) {
      console.warn(`- ${stale.id}: ${stale.age} days`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
