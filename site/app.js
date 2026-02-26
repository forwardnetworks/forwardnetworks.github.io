import {
  DEFAULT_CATALOG_STATE,
  compareEntries,
  escapeHtml,
  inactiveFor,
  linkedHandle,
  maintainerSourceLabel,
  parseCatalogState,
  readinessFor,
  stateToSearchParams,
  titleCase,
  toRelativeLabel
} from "./catalog-model.js";

function matchesStatus(entry, status, now = new Date()) {
  if (status === "all") {
    return true;
  }

  if (status === "inactive") {
    return inactiveFor(entry, now);
  }

  return readinessFor(entry, now).label === status;
}

function cardTemplate(entry, index, now = new Date()) {
  const targets = entry.integration_targets.map((target) => `<span class="badge">${escapeHtml(target)}</span>`).join(" ");
  const delay = Math.min(index * 60, 420);
  const readiness = readinessFor(entry, now);
  const repoActivityLabel = toRelativeLabel(entry.last_repo_commit_date, now);
  const verifiedLabel = toRelativeLabel(entry.last_verified_date, now);
  const inactiveBadge = inactiveFor(entry, now) ? '<span class="readiness-badge readiness-unknown">inactive 6m+</span>' : "";
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
        <span class="readiness-text">Catalog verified: ${escapeHtml(entry.last_verified_date)} (${escapeHtml(verifiedLabel)})</span>
        <span class="readiness-text">Last repo activity: ${escapeHtml(entry.last_repo_commit_date)} (${escapeHtml(repoActivityLabel)})</span>
      </div>
      <p class="meta microcopy">Confidence signal: catalog freshness + repo activity.</p>
      ${forkMeta}
      <p class="meta">Verified by: ${linkedHandle(entry.verified_by)}</p>
      <p class="meta">Maintainers: ${(entry.maintainers || []).map(linkedHandle).join(", ")}</p>
      <p class="meta">Attribution: ${escapeHtml(maintainerSourceLabel(entry))}</p>
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

function filterEntries(entries, state, now = new Date()) {
  const needle = state.q.trim().toLowerCase();

  return entries.filter((entry) => {
    const isInactive = inactiveFor(entry, now);

    const matchesTarget = state.target === "all" || entry.integration_targets.includes(state.target);
    if (!matchesTarget) {
      return false;
    }

    if (!state.inactive && state.status !== "inactive" && isInactive) {
      return false;
    }

    if (!matchesStatus(entry, state.status, now)) {
      return false;
    }

    if (!needle) {
      return true;
    }

    const readiness = readinessFor(entry, now).label;
    const searchable = [
      entry.id,
      entry.name,
      entry.summary,
      entry.category,
      entry.maturity,
      entry.support_tier,
      entry.last_verified_date,
      entry.last_repo_commit_date,
      entry.verified_by,
      entry.maintainer_source || "",
      readiness,
      isInactive ? "inactive" : "",
      ...(entry.integration_targets || [])
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(needle);
  });
}

function renderCards(entries) {
  const now = new Date();
  const container = document.getElementById("cards");
  container.innerHTML = entries.map((entry, index) => cardTemplate(entry, index, now)).join("\n");
}

function renderMetrics(entries) {
  const active = entries.filter((entry) => entry.maturity === "active").length;
  const targets = new Set(entries.flatMap((entry) => entry.integration_targets || [])).size;

  document.getElementById("metric-total").textContent = String(entries.length);
  document.getElementById("metric-active").textContent = String(active);
  document.getElementById("metric-targets").textContent = String(targets);
}

function renderResultCount(count) {
  document.getElementById("result-count").textContent = `${count} shown`;
}

function syncUrl(state) {
  const params = stateToSearchParams(state);
  const query = params.toString();
  const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, "", next);
}

function renderTargetFilters(entries, activeTarget, onChange) {
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
    `<button class="chip ${activeTarget === "all" ? "active" : ""}" data-target="all" type="button">all (${allCount})</button>`,
    ...sortedTargets.map(
      ([target, count]) =>
        `<button class="chip ${activeTarget === target ? "active" : ""}" data-target="${escapeHtml(target)}" type="button">${escapeHtml(target)} (${count})</button>`
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

function validTarget(entries, target) {
  if (target === "all") {
    return true;
  }

  return entries.some((entry) => entry.integration_targets.includes(target));
}

async function main() {
  const data = await loadData();

  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sort");
  const statusSelect = document.getElementById("status");
  const inactiveToggle = document.getElementById("show-inactive");

  const initial = parseCatalogState(new URLSearchParams(window.location.search));
  const state = {
    ...DEFAULT_CATALOG_STATE,
    ...initial,
    target: validTarget(data, initial.target) ? initial.target : "all"
  };

  searchInput.value = state.q;
  sortSelect.value = state.sort;
  statusSelect.value = state.status;
  inactiveToggle.checked = state.inactive;

  const rerender = () => {
    const now = new Date();
    const filtered = filterEntries(data, state, now).sort((a, b) => compareEntries(a, b, state.sort, now));

    renderCards(filtered);
    renderResultCount(filtered.length);
    syncUrl(state);
  };

  renderMetrics(data);
  renderTargetFilters(data, state.target, (newTarget) => {
    state.target = newTarget;
    rerender();
  });

  rerender();

  searchInput.addEventListener("input", () => {
    state.q = searchInput.value;
    rerender();
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    rerender();
  });

  statusSelect.addEventListener("change", () => {
    state.status = statusSelect.value;
    rerender();
  });

  inactiveToggle.addEventListener("change", () => {
    state.inactive = inactiveToggle.checked;
    rerender();
  });
}

main().catch((error) => {
  const container = document.getElementById("cards");
  container.innerHTML = `<article class="card"><h3>Catalog unavailable</h3><p>${escapeHtml(String(error.message))}</p></article>`;
});
