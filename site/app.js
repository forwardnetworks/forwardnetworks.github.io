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
  const releaseAge = daysSince(entry.last_repo_commit_date);
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

function cardTemplate(entry, index) {
  const targets = entry.integration_targets.map((target) => `<span class="badge">${escapeHtml(target)}</span>`).join(" ");
  const delay = Math.min(index * 60, 420);
  const readiness = readinessFor(entry);
  const verifiedText = readiness.ageDays === null ? "Catalog verified: unknown" : `Catalog verified: ${readiness.ageDays}d ago`;
  const repoActivityDays = daysSince(entry.last_repo_commit_date);
  const repoActivityText =
    repoActivityDays === null ? "Last repo activity: unknown" : `Last repo activity: ${entry.last_repo_commit_date} (${repoActivityDays}d ago)`;
  const inactiveBadge = inactiveFor(entry) ? '<span class="readiness-badge readiness-unknown">inactive 6m+</span>' : "";
  const forkBadge = entry.fork ? '<span class="readiness-badge readiness-fork">fork</span>' : "";
  const forkMeta = entry.fork
    ? `<p class="meta">Fork source: <a class="meta-link" href="https://github.com/${escapeHtml(entry.fork.upstream_repo)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.fork.upstream_repo)}</a></p>`
    : "";

  return `
    <article class="card" style="animation-delay:${delay}ms">
      <h3>${escapeHtml(entry.name)}</h3>
      <p>${escapeHtml(entry.summary)}</p>
      <p class="meta">${escapeHtml(entry.category)} | ${escapeHtml(entry.maturity)} | ${escapeHtml(titleCase(entry.support_tier))}</p>
      <div class="badges">${targets}</div>
      <div class="readiness-row">
        <span class="readiness-badge ${readiness.className}">${escapeHtml(readiness.label)}</span>
        ${forkBadge}
        ${inactiveBadge}
        <span class="readiness-text">${escapeHtml(verifiedText)}</span>
        <span class="readiness-text">${escapeHtml(repoActivityText)}</span>
      </div>
      ${forkMeta}
      <p class="meta">Owner: ${escapeHtml(entry.owner_team)} | Verified by: ${linkedHandle(entry.verified_by)}</p>
      <p class="meta">Maintainers: ${(entry.maintainers || []).map(linkedHandle).join(", ")}</p>
      <div class="actions">
        <a class="btn" href="./integration.html?id=${encodeURIComponent(entry.id)}">Details</a>
        <a class="btn" href="${escapeHtml(entry.repo_url)}" target="_blank" rel="noopener noreferrer">Repository</a>
        <a class="card-link" href="${escapeHtml(entry.issue_url)}" target="_blank" rel="noopener noreferrer">Issues</a>
      </div>
    </article>
  `;
}

async function loadData() {
  const response = await fetch("./catalog/integrations.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load catalog: ${response.status}`);
  }
  return response.json();
}

function renderCards(entries) {
  const container = document.getElementById("cards");
  container.innerHTML = entries.map((entry, index) => cardTemplate(entry, index)).join("\n");
}

function filterEntries(entries, query, targetFilter) {
  const needle = query.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesTarget = targetFilter === "all" || entry.integration_targets.includes(targetFilter);
    if (!matchesTarget) {
      return false;
    }

    if (!needle) {
      return true;
    }

    const readiness = readinessFor(entry);
    const inactive = inactiveFor(entry) ? "inactive" : "";

    const searchable = [
      entry.id,
      entry.name,
      entry.summary,
      entry.category,
      entry.maturity,
      entry.support_tier,
      entry.last_verified_date,
      entry.last_repo_commit_date,
      entry.owner_team,
      entry.verified_by,
      readiness.label,
      inactive,
      ...(entry.integration_targets || [])
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(needle);
  });
}

function renderMetrics(entries) {
  const active = entries.filter((entry) => entry.maturity === "active").length;
  const targets = new Set(entries.flatMap((entry) => entry.integration_targets || [])).size;

  document.getElementById("metric-total").textContent = String(entries.length);
  document.getElementById("metric-active").textContent = String(active);
  document.getElementById("metric-targets").textContent = String(targets);
}

function renderTargetFilters(entries, onChange) {
  const counts = new Map();
  for (const entry of entries) {
    for (const target of entry.integration_targets) {
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }

  const sortedTargets = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const container = document.getElementById("target-filters");
  const allCount = entries.length;
  container.innerHTML = [
    `<button class="chip active" data-target="all" type="button">all (${allCount})</button>`,
    ...sortedTargets.map(
      ([target, count]) =>
        `<button class="chip" data-target="${escapeHtml(target)}" type="button">${escapeHtml(target)} (${count})</button>`
    )
  ].join("\n");

  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-target]");
    if (!button) {
      return;
    }

    for (const chip of container.querySelectorAll(".chip")) {
      chip.classList.remove("active");
    }

    button.classList.add("active");
    onChange(button.dataset.target || "all");
  });
}

function renderResultCount(count) {
  document.getElementById("result-count").textContent = `${count} shown`;
}

async function main() {
  const data = await loadData();
  const searchInput = document.getElementById("search");

  let currentTarget = "all";

  const rerender = () => {
    const filtered = filterEntries(data, searchInput.value, currentTarget);
    renderCards(filtered);
    renderResultCount(filtered.length);
  };

  renderMetrics(data);
  renderTargetFilters(data, (newTarget) => {
    currentTarget = newTarget;
    rerender();
  });
  rerender();

  searchInput.addEventListener("input", rerender);
}

main().catch((error) => {
  const container = document.getElementById("cards");
  container.innerHTML = `<article class="card"><h3>Catalog unavailable</h3><p>${escapeHtml(String(error.message))}</p></article>`;
});
