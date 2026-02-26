function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cardTemplate(entry) {
  const targets = entry.integration_targets.map((target) => `<span class="badge">${escapeHtml(target)}</span>`).join(" ");

  return `
    <article class="card">
      <h3>${escapeHtml(entry.name)}</h3>
      <p>${escapeHtml(entry.summary)}</p>
      <p class="meta">Category: ${escapeHtml(entry.category)} | Maturity: ${escapeHtml(entry.maturity)}</p>
      <div class="badges">${targets}</div>
      <div class="actions">
        <a class="btn" href="./integration.html?id=${encodeURIComponent(entry.id)}">Details</a>
        <a class="btn" href="${escapeHtml(entry.repo_url)}" target="_blank" rel="noopener noreferrer">Repository</a>
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
  container.innerHTML = entries.map(cardTemplate).join("\n");
}

function filterEntries(entries, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return entries;
  }

  return entries.filter((entry) => {
    const searchable = [
      entry.id,
      entry.name,
      entry.summary,
      entry.category,
      entry.maturity,
      ...(entry.integration_targets || [])
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(needle);
  });
}

async function main() {
  const data = await loadData();
  const searchInput = document.getElementById("search");

  renderCards(data);

  searchInput.addEventListener("input", () => {
    renderCards(filterEntries(data, searchInput.value));
  });
}

main().catch((error) => {
  const container = document.getElementById("cards");
  container.innerHTML = `<article class="card"><h3>Catalog unavailable</h3><p>${escapeHtml(String(error.message))}</p></article>`;
});
