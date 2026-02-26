import fs from "node:fs/promises";

const registryPath = new URL("../catalog/integrations.json", import.meta.url);

function withTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

async function checkUrl(url) {
  const { controller, timeout } = withTimeout(15000);
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal
      });
    }

    return { ok: response.status < 400, status: response.status };
  } catch (error) {
    return { ok: false, status: error.name === "AbortError" ? "timeout" : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const raw = await fs.readFile(registryPath, "utf8");
  const data = JSON.parse(raw);

  const targets = [];
  for (const entry of data) {
    targets.push({ id: entry.id, type: "repo_url", url: entry.repo_url });
    targets.push({ id: entry.id, type: "docs_url", url: entry.docs_url });
    targets.push({ id: entry.id, type: "issue_url", url: entry.issue_url });
  }

  const failures = [];

  for (const target of targets) {
    const result = await checkUrl(target.url);
    if (!result.ok) {
      failures.push(`${target.id} ${target.type} ${target.url} -> ${result.status}`);
    } else {
      console.log(`OK ${target.id} ${target.type} -> ${result.status}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nLink checks failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`\nLink checks passed: ${targets.length} URLs`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
