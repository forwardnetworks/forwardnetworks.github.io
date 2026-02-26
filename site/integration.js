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

  const targetBadges = (entry.integration_targets || []).map((target) => `<span class="badge">${escapeHtml(target)}</span>`).join(" ");

  details.innerHTML = `
    <h2>${escapeHtml(entry.name)}</h2>
    <p>${escapeHtml(entry.summary)}</p>
    <div class="notice">
      Support model: Best-effort and self-supported. No Forward field-team SLA.
    </div>

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
        <p>${escapeHtml(entry.support_tier)}</p>
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
        <p>${(entry.maintainers || []).map(escapeHtml).join(", ")}</p>
      </div>
    </div>

    <p><strong>Targets</strong></p>
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
