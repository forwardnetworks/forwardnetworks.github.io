function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badgeClass(type) {
  if (type === "added") return "readiness-fresh";
  if (type === "deprecated") return "readiness-stale";
  if (type === "updated") return "readiness-aging";
  return "readiness-unknown";
}

async function main() {
  const response = await fetch("./catalog/changelog.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load changelog: ${response.status}`);
  }

  const data = await response.json();
  const meta = document.getElementById("changelog-meta");
  const list = document.getElementById("changelog-list");

  meta.textContent = `Generated ${data.generated_at} | current ${data.current_commit ?? "n/a"} | baseline ${data.baseline_commit ?? "n/a"}`;

  if (!Array.isArray(data.changes) || data.changes.length === 0) {
    list.innerHTML = `<p class="notice">No registry changes detected against baseline.</p>`;
    return;
  }

  list.innerHTML = data.changes
    .map(
      (change) => `
      <article class="detail-item changelog-item">
        <div class="readiness-row">
          <span class="readiness-badge ${badgeClass(change.type)}">${escapeHtml(change.type)}</span>
          <strong>${escapeHtml(change.name)} (${escapeHtml(change.id)})</strong>
        </div>
        <p class="meta">${(change.details || []).map(escapeHtml).join(", ")}</p>
      </article>
    `
    )
    .join("\n");
}

main().catch((error) => {
  const meta = document.getElementById("changelog-meta");
  const list = document.getElementById("changelog-list");
  meta.textContent = "Changelog unavailable";
  list.innerHTML = `<p>${escapeHtml(String(error.message))}</p>`;
});
