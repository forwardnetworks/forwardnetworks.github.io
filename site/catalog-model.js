export const FRESH_DAYS = 30;
export const STALE_DAYS = 90;
export const INACTIVE_DAYS = 180;

export const DEFAULT_CATALOG_STATE = {
  q: "",
  target: "all",
  status: "all",
  sort: "trust",
  inactive: false
};

const ALLOWED_STATUS = new Set(["all", "fresh", "aging", "stale", "inactive"]);
const ALLOWED_SORT = new Set(["trust", "recent", "name"]);

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function parseDate(dateString) {
  const value = new Date(`${dateString}T00:00:00Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function daysSince(dateString, now = new Date()) {
  const parsed = parseDate(dateString);
  if (!parsed) {
    return null;
  }

  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((utcToday - parsed.getTime()) / dayMs);
}

export function readinessFor(entry, now = new Date()) {
  const ageDays = daysSince(entry.last_verified_date, now);
  if (ageDays === null) {
    return { label: "unknown", className: "readiness-unknown", ageDays: null };
  }

  if (ageDays <= FRESH_DAYS) {
    return { label: "fresh", className: "readiness-fresh", ageDays };
  }

  if (ageDays <= STALE_DAYS) {
    return { label: "aging", className: "readiness-aging", ageDays };
  }

  return { label: "stale", className: "readiness-stale", ageDays };
}

export function inactiveFor(entry, now = new Date()) {
  const repoAge = daysSince(entry.last_repo_commit_date, now);
  const verifyAge = daysSince(entry.last_verified_date, now);
  if (repoAge === null || verifyAge === null) {
    return false;
  }
  return repoAge > INACTIVE_DAYS && verifyAge > INACTIVE_DAYS;
}

export function titleCase(value) {
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function handleToGithubUrl(handle) {
  const normalized = String(handle || "").replace(/^@/, "");
  return `https://github.com/${normalized}`;
}

export function linkedHandle(handle) {
  const safeHandle = escapeHtml(handle);
  const href = escapeHtml(handleToGithubUrl(handle));
  return `<a class="meta-link" href="${href}" target="_blank" rel="noopener noreferrer">${safeHandle}</a>`;
}

export function toRelativeLabel(dateString, now = new Date()) {
  const ageDays = daysSince(dateString, now);
  if (ageDays === null) {
    return "unknown";
  }
  if (ageDays === 0) {
    return "today";
  }
  if (ageDays === 1) {
    return "1 day ago";
  }
  return `${ageDays} days ago`;
}

export function maintainerSourceLabel(entry) {
  if (entry.maintainer_source === "derived_recent_contributors") {
    if (entry.maintainer_last_derived_date) {
      return `Derived from recent org contributors (12m), refreshed ${entry.maintainer_last_derived_date}`;
    }
    return "Derived from recent org contributors (12m)";
  }
  return "Manual maintainer list";
}

export function parseCatalogState(searchParams) {
  const q = (searchParams.get("q") || "").trim();
  const target = (searchParams.get("target") || "all").trim() || "all";

  const statusCandidate = (searchParams.get("status") || "all").trim();
  const status = ALLOWED_STATUS.has(statusCandidate) ? statusCandidate : "all";

  const sortCandidate = (searchParams.get("sort") || "trust").trim();
  const sort = ALLOWED_SORT.has(sortCandidate) ? sortCandidate : "trust";

  const inactiveRaw = (searchParams.get("inactive") || "0").trim();
  const inactive = inactiveRaw === "1" || inactiveRaw === "true";

  return { q, target, status, sort, inactive };
}

export function stateToSearchParams(state) {
  const params = new URLSearchParams();

  if (state.q) {
    params.set("q", state.q);
  }
  if (state.target && state.target !== "all") {
    params.set("target", state.target);
  }
  if (state.status && state.status !== "all") {
    params.set("status", state.status);
  }
  if (state.sort && state.sort !== "trust") {
    params.set("sort", state.sort);
  }
  if (state.inactive) {
    params.set("inactive", "1");
  }

  return params;
}

export function trustRankFor(entry, now = new Date()) {
  if (inactiveFor(entry, now)) {
    return 4;
  }

  const readiness = readinessFor(entry, now).label;
  if (readiness === "fresh") return 0;
  if (readiness === "aging") return 1;
  if (readiness === "stale") return 2;
  return 3;
}

export function compareEntries(a, b, sort, now = new Date()) {
  if (sort === "name") {
    return a.name.localeCompare(b.name);
  }

  if (sort === "recent") {
    const aDays = daysSince(a.last_repo_commit_date, now);
    const bDays = daysSince(b.last_repo_commit_date, now);
    if (aDays === null && bDays === null) return a.name.localeCompare(b.name);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    if (aDays !== bDays) return aDays - bDays;
    return a.name.localeCompare(b.name);
  }

  const aTrust = trustRankFor(a, now);
  const bTrust = trustRankFor(b, now);
  if (aTrust !== bTrust) {
    return aTrust - bTrust;
  }

  const aVerify = daysSince(a.last_verified_date, now);
  const bVerify = daysSince(b.last_verified_date, now);
  if (aVerify !== null && bVerify !== null && aVerify !== bVerify) {
    return aVerify - bVerify;
  }

  return a.name.localeCompare(b.name);
}
