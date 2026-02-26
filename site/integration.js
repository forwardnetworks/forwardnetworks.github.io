const FRESH_DAYS = 30;
const STALE_DAYS = 90;
const INACTIVE_DAYS = 180;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function parseDate(dateString) {
  const value = new Date(`${dateString}T00:00:00Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function daysSince(dateString) {
  const parsed = parseDate(dateString);
  if (!parsed) {
    return null;
  }
  const now = new Date();
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((utcToday - parsed.getTime()) / dayMs);
}

function readinessFor(entry) {
  const ageDays = daysSince(entry.last_verified_date);
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

function inactiveFor(entry) {
  const releaseAge = daysSince(entry.last_release_date);
  const verifyAge = daysSince(entry.last_verified_date);
  if (releaseAge === null || verifyAge === null) {
    return false;
  }
  return releaseAge > INACTIVE_DAYS && verifyAge > INACTIVE_DAYS;
}

function titleCase(value) {
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function handleToGithubUrl(handle) {
  const normalized = String(handle || "").replace(/^@/, "");
  return `https://github.com/${normalized}`;
}

function linkedHandle(handle) {
  const safeHandle = escapeHtml(handle);
  const href = escapeHtml(handleToGithubUrl(handle));
  return `<a class="meta-link" href="${href}" target="_blank" rel="noopener noreferrer">${safeHandle}</a>`;
}

async function loadEntry(id) {
  const response = await fetch("./catalog/integrations.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load catalog: ${response.status}`);
  }
  const data = await response.json();
  return data.find((entry) => entry.id === id);
}

function renderEntry(entry) {
  const name = document.getElementById("name");
  const details = document.getElementById("details");
  name.textContent = entry.name;

  const readiness = readinessFor(entry);
  const isInactive = inactiveFor(entry);
  const targetBadges = (entry.integration_targets || []).map((target) => `<span class="badge">${escapeHtml(target)}</span>`).join(" ");
  const readinessText = readiness.ageDays === null ? "Unknown verification age" : `${readiness.ageDays} days since verification`;
  const inactiveBadge = isInactive ? '<span class="readiness-badge readiness-unknown">inactive 6m+</span>' : "";
  const forkBadge = entry.fork ? '<span class="readiness-badge readiness-fork">fork</span>' : "";
  const forkPanel = entry.fork
    ? `<div class="notice">
      Fork source: <a class="meta-link" href="https://github.com/${escapeHtml(entry.fork.upstream_repo)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.fork.upstream_repo)}</a> (${escapeHtml(entry.fork.upstream_branch)} -> ${escapeHtml(entry.fork.fork_branch)}). ${escapeHtml(entry.fork.note)}
    </div>`
    : "";

  details.innerHTML = `
    <h2>${escapeHtml(entry.name)}</h2>
    <p>${escapeHtml(entry.summary)}</p>
    <div class="notice">
      Support model: Best-effort and self-supported. No Forward field-team SLA.
    </div>

    <div class="readiness-row detail-readiness">
      <span class="readiness-badge ${readiness.className}">${escapeHtml(readiness.label)}</span>
      ${forkBadge}
      ${inactiveBadge}
      <span class="readiness-text">${escapeHtml(readinessText)}</span>
      <span class="readiness-text">Last verified: ${escapeHtml(entry.last_verified_date)}</span>
    </div>
    ${forkPanel}

    <div class="detail-grid">
      <div class="detail-item">
        <p>Category</p>
        <p>${escapeHtml(entry.category)}</p>
      </div>
      <div class="detail-item">
        <p>Maturity</p>
        <p>${escapeHtml(entry.maturity)}</p>
      </div>
      <div class="detail-item">
        <p>Support</p>
        <p>${escapeHtml(titleCase(entry.support_tier))}</p>
      </div>
      <div class="detail-item">
        <p>Owner Team</p>
        <p>${escapeHtml(entry.owner_team)}</p>
      </div>
      <div class="detail-item">
        <p>Verified By</p>
        <p>${linkedHandle(entry.verified_by)}</p>
      </div>
      <div class="detail-item">
        <p>Forward Minimum Version</p>
        <p>${escapeHtml(entry.compatibility.forward_min_version)}</p>
      </div>
      <div class="detail-item">
        <p>Tested Environments</p>
        <p>${(entry.compatibility.tested_environments || []).map(escapeHtml).join(", ")}</p>
      </div>
      <div class="detail-item">
        <p>License</p>
        <p>${escapeHtml(entry.license)}</p>
      </div>
      <div class="detail-item">
        <p>Last Release Date</p>
        <p>${escapeHtml(entry.last_release_date)}</p>
      </div>
      <div class="detail-item">
        <p>Maintainers</p>
        <p>${(entry.maintainers || []).map(linkedHandle).join(", ")}</p>
      </div>
    </div>

    <p><strong>Target Systems</strong></p>
    <div class="badges">${targetBadges}</div>

    <p><strong>Security Notes</strong></p>
    <p>${escapeHtml(entry.security_notes)}</p>

    <div class="actions">
      <a class="btn" href="${escapeHtml(entry.repo_url)}" target="_blank" rel="noopener noreferrer">Repository</a>
      <a class="btn" href="${escapeHtml(entry.docs_url)}" target="_blank" rel="noopener noreferrer">Documentation</a>
      <a class="btn" href="${escapeHtml(entry.issue_url)}" target="_blank" rel="noopener noreferrer">Open Issue</a>
    </div>
  `;
}

async function main() {
  const id = getId();
  if (!id) {
    throw new Error("Missing integration id in query parameter.");
  }

  const entry = await loadEntry(id);
  if (!entry) {
    throw new Error(`Integration '${id}' not found.`);
  }

  renderEntry(entry);
}

main().catch((error) => {
  const details = document.getElementById("details");
  details.innerHTML = `<h2>Unable to load integration</h2><p>${escapeHtml(String(error.message))}</p>`;
});
