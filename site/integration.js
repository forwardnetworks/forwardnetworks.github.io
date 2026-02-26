import {
  escapeHtml,
  inactiveFor,
  linkedHandle,
  maintainerSourceLabel,
  readinessFor,
  titleCase,
  toRelativeLabel
} from "./catalog-model.js";

function getId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
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
  const now = new Date();
  const name = document.getElementById("name");
  const details = document.getElementById("details");
  name.textContent = entry.name;

  const readiness = readinessFor(entry, now);
  const isInactive = inactiveFor(entry, now);
  const targetBadges = (entry.integration_targets || []).map((target) => `<span class="badge">${escapeHtml(target)}</span>`).join(" ");

  const repoActivityRelative = toRelativeLabel(entry.last_repo_commit_date, now);
  const verifiedRelative = toRelativeLabel(entry.last_verified_date, now);

  const inactiveBadge = isInactive ? '<span class="readiness-badge readiness-unknown">inactive 6m+</span>' : "";
  const forkBadge = entry.fork ? '<span class="readiness-badge readiness-fork">fork</span>' : "";

  const forkPanel = entry.fork
    ? `<div class="notice">
      Fork source: <a class="meta-link" href="https://github.com/${escapeHtml(entry.fork.upstream_repo)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.fork.upstream_repo)}</a> (${escapeHtml(entry.fork.upstream_branch)} -> ${escapeHtml(entry.fork.fork_branch)}). ${escapeHtml(entry.fork.note)}
    </div>`
    : "";

  const maintainerSource = maintainerSourceLabel(entry);

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
      <span class="readiness-text">Catalog verified: ${escapeHtml(entry.last_verified_date)} (${escapeHtml(verifiedRelative)})</span>
      <span class="readiness-text">Last repo activity: ${escapeHtml(entry.last_repo_commit_date)} (${escapeHtml(repoActivityRelative)})</span>
    </div>
    <p class="meta microcopy">Confidence signal: catalog freshness + repo activity are tracked separately.</p>
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
        <p>Last Repo Commit Date</p>
        <p>${escapeHtml(entry.last_repo_commit_date)}</p>
      </div>
      <div class="detail-item">
        <p>Catalog Last Verified</p>
        <p>${escapeHtml(entry.last_verified_date)}</p>
      </div>
      <div class="detail-item">
        <p>Last Release Date</p>
        <p>${escapeHtml(entry.last_release_date)}</p>
      </div>
      <div class="detail-item">
        <p>Maintainers</p>
        <p>${(entry.maintainers || []).map(linkedHandle).join(", ")}</p>
      </div>
      <div class="detail-item">
        <p>Maintainer Attribution</p>
        <p>${escapeHtml(maintainerSource)}</p>
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
