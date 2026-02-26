function escapeHtml(value) {
  return value
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

  details.innerHTML = `
    <h2>${escapeHtml(entry.name)}</h2>
    <p>${escapeHtml(entry.summary)}</p>
    <p><strong>Category:</strong> ${escapeHtml(entry.category)}</p>
    <p><strong>Maturity:</strong> ${escapeHtml(entry.maturity)}</p>
    <p><strong>Support:</strong> Best effort and self-supported</p>
    <p><strong>Targets:</strong> ${entry.integration_targets.map(escapeHtml).join(", ")}</p>
    <p><strong>Maintainers:</strong> ${entry.maintainers.map(escapeHtml).join(", ")}</p>
    <p><strong>Forward Minimum Version:</strong> ${escapeHtml(entry.compatibility.forward_min_version)}</p>
    <p><strong>Tested Environments:</strong> ${entry.compatibility.tested_environments.map(escapeHtml).join(", ")}</p>
    <p><strong>License:</strong> ${escapeHtml(entry.license)}</p>
    <p><strong>Last Release Date:</strong> ${escapeHtml(entry.last_release_date)}</p>
    <p><strong>Security Notes:</strong> ${escapeHtml(entry.security_notes)}</p>
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
