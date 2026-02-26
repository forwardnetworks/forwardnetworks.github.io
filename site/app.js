function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cardTemplate(entry, index) {
  const targets = entry.integration_targets.map((target) => `<span class="badge">${escapeHtml(target)}</span>`).join(" ");
  const delay = Math.min(index * 60, 420);

  return `
    <article class="card" style="animation-delay:${delay}ms">
      <h3>${escapeHtml(entry.name)}</h3>
      <p>${escapeHtml(entry.summary)}</p>
      <p class="meta">${escapeHtml(entry.category)} | ${escapeHtml(entry.maturity)} | ${escapeHtml(entry.support_tier)}</p>
      <div class="badges">${targets}</div>
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

function filterEntries(entries, query, category) {
  const needle = query.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesCategory = category === "all" || entry.category === category;
    if (!matchesCategory) {
      return false;
    }

    if (!needle) {
      return true;
    }

    const searchable = [
      entry.id,
      entry.name,
      entry.summary,
      entry.category,
      entry.maturity,
      entry.support_tier,
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

function renderCategoryFilters(entries, onChange) {
  const categories = ["all", ...new Set(entries.map((entry) => entry.category))];
  const container = document.getElementById("category-filters");
  container.innerHTML = categories
    .map(
      (category, index) =>
        `<button class="chip${index === 0 ? " active" : ""}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`
    )
    .join("\n");

  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) {
      return;
    }

    for (const chip of container.querySelectorAll(".chip")) {
      chip.classList.remove("active");
    }

    button.classList.add("active");
    onChange(button.dataset.category || "all");
  });
}

function renderResultCount(count) {
  document.getElementById("result-count").textContent = `${count} shown`;
}

async function main() {
  const data = await loadData();
  const searchInput = document.getElementById("search");

  let currentCategory = "all";

  const rerender = () => {
    const filtered = filterEntries(data, searchInput.value, currentCategory);
    renderCards(filtered);
    renderResultCount(filtered.length);
  };

  renderMetrics(data);
  renderCategoryFilters(data, (newCategory) => {
    currentCategory = newCategory;
    rerender();
  });
  rerender();

  searchInput.addEventListener("input", rerender);
}

main().catch((error) => {
  const container = document.getElementById("cards");
  container.innerHTML = `<article class="card"><h3>Catalog unavailable</h3><p>${escapeHtml(String(error.message))}</p></article>`;
});
