const template = {
  id: "example-integration",
  name: "Example Integration",
  summary: "One-line operational summary under 200 characters.",
  repo_url: "https://github.com/forwardnetworks/example-integration",
  docs_url: "https://github.com/forwardnetworks/example-integration",
  category: "automation",
  integration_targets: ["forward", "aws"],
  maturity: "incubating",
  support_tier: "best_effort",
  maintainers: ["@your-github-handle"],
  maintainer_source: "manual",
  verified_by: "@your-github-handle",
  issue_url: "https://github.com/forwardnetworks/example-integration/issues",
  license: "Apache-2.0",
  last_release_date: "2026-02-26",
  last_repo_commit_date: "2026-02-26",
  last_verified_date: "2026-02-26",
  compatibility: {
    forward_min_version: "24.1",
    tested_environments: ["aws"]
  },
  security_notes: "Document secret handling, access boundaries, and cert expectations."
  // Optional fork metadata:
  // fork: {
  //   upstream_repo: "upstream-org/upstream-repo",
  //   upstream_branch: "main",
  //   fork_branch: "forward-enterprise",
  //   note: "Forked integration. Maintainers listed here are fork-specific contributors."
  // }
};

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const area = document.createElement("textarea");
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
  return Promise.resolve();
}

async function main() {
  const button = document.getElementById("copy-template");
  const preview = document.getElementById("template-preview");
  const status = document.getElementById("template-status");

  const json = JSON.stringify(template, null, 2);
  preview.textContent = json;

  button.addEventListener("click", async () => {
    await copyText(json);
    status.textContent = "Template copied to clipboard.";
  });
}

main().catch(() => {
  const status = document.getElementById("template-status");
  status.textContent = "Template copy unavailable in this browser.";
});
