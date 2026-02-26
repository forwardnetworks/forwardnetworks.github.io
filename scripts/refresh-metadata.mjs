import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const catalogPath = path.join(root, "catalog", "integrations.json");
const ORG = "forwardnetworks";
const WINDOW_DAYS = 365;
const MAX_MAINTAINERS = 5;

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run")
  };
}

function getToken() {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    return process.env.GITHUB_TOKEN.trim();
  }

  try {
    const token = execFileSync("gh", ["auth", "token"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();

    return token || null;
  } catch {
    return null;
  }
}

export function parseRepoSlug(repoUrl) {
  const url = new URL(repoUrl);
  if (url.hostname !== "github.com") {
    throw new Error(`Unsupported repo host for ${repoUrl}`);
  }

  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid GitHub repo URL: ${repoUrl}`);
  }

  return {
    owner: parts[0],
    repo: parts[1].replace(/\.git$/i, "")
  };
}

export function toDateOnly(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function ensureGitHubSuccess(status, context, payload) {
  if (status >= 200 && status < 300) {
    return;
  }

  const message = payload && typeof payload === "object" && typeof payload.message === "string" ? `: ${payload.message}` : "";
  throw new Error(`${context} failed with status ${status}${message}`);
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

async function requestGitHub(apiPath, token) {
  const { controller, timeout } = withTimeout(30000);
  try {
    const response = await fetch(`https://api.github.com${apiPath}`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
        "User-Agent": "forward-integrations-catalog-refresh"
      },
      signal: controller.signal
    });

    if (response.status === 204) {
      return {
        status: response.status,
        data: null,
        headers: response.headers
      };
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text.slice(0, 200) };
      }
    }

    return {
      status: response.status,
      data,
      headers: response.headers
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sinceIso(now = new Date()) {
  const threshold = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return threshold.toISOString();
}

function sortByCountDescending(left, right) {
  if (left[1] !== right[1]) {
    return right[1] - left[1];
  }

  return left[0].localeCompare(right[0]);
}

export async function deriveRecentMaintainers(commits, isOrgMember, maxMaintainers = MAX_MAINTAINERS) {
  const counts = new Map();

  for (const commit of commits) {
    const login = commit?.author?.login;
    if (!login || typeof login !== "string") {
      continue;
    }

    counts.set(login, (counts.get(login) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort(sortByCountDescending);
  const maintainers = [];

  for (const [login] of sorted) {
    if (!(await isOrgMember(login))) {
      continue;
    }

    maintainers.push(`@${login}`);
    if (maintainers.length >= maxMaintainers) {
      break;
    }
  }

  return maintainers;
}

async function fetchAllRecentCommits(owner, repo, defaultBranch, token, since) {
  const commits = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      sha: defaultBranch,
      since,
      per_page: "100",
      page: String(page)
    });

    const result = await requestGitHub(`/repos/${owner}/${repo}/commits?${params.toString()}`, token);
    ensureGitHubSuccess(result.status, `Fetch commits for ${owner}/${repo}`, result.data);

    const pageItems = Array.isArray(result.data) ? result.data : [];
    commits.push(...pageItems);

    if (pageItems.length < 100) {
      break;
    }

    page += 1;
  }

  return commits;
}

async function fetchLatestCommitDate(owner, repo, defaultBranch, token) {
  const params = new URLSearchParams({ sha: defaultBranch, per_page: "1" });
  const result = await requestGitHub(`/repos/${owner}/${repo}/commits?${params.toString()}`, token);
  ensureGitHubSuccess(result.status, `Fetch latest commit for ${owner}/${repo}`, result.data);

  const [latest] = Array.isArray(result.data) ? result.data : [];
  const dateValue = latest?.commit?.committer?.date || latest?.commit?.author?.date || null;

  return toDateOnly(dateValue);
}

async function fetchLatestReleaseDate(owner, repo, token) {
  const result = await requestGitHub(`/repos/${owner}/${repo}/releases/latest`, token);

  if (result.status === 404) {
    return null;
  }

  ensureGitHubSuccess(result.status, `Fetch latest release for ${owner}/${repo}`, result.data);

  const releaseDate = result.data?.published_at || result.data?.created_at || null;
  return toDateOnly(releaseDate);
}

async function fetchDefaultBranch(owner, repo, token) {
  const result = await requestGitHub(`/repos/${owner}/${repo}`, token);
  ensureGitHubSuccess(result.status, `Fetch repository metadata for ${owner}/${repo}`, result.data);

  if (!result.data?.default_branch) {
    throw new Error(`Repository ${owner}/${repo} is missing default_branch`);
  }

  return result.data.default_branch;
}

function toToday() {
  return new Date().toISOString().slice(0, 10);
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let idx = 0; idx < left.length; idx += 1) {
    if (left[idx] !== right[idx]) {
      return false;
    }
  }

  return true;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = getToken();
  if (!token) {
    throw new Error("Missing GitHub token. Set GITHUB_TOKEN or authenticate with `gh auth login`.");
  }

  const raw = await fs.readFile(catalogPath, "utf8");
  const catalog = JSON.parse(raw);

  if (!Array.isArray(catalog)) {
    throw new Error("catalog/integrations.json must contain a top-level array");
  }

  const since = sinceIso();
  const today = toToday();
  const memberCache = new Map();

  async function isOrgMember(login) {
    if (memberCache.has(login)) {
      return memberCache.get(login);
    }

    const result = await requestGitHub(`/orgs/${ORG}/members/${login}`, token);
    if (result.status === 204) {
      memberCache.set(login, true);
      return true;
    }

    if (result.status === 404) {
      memberCache.set(login, false);
      return false;
    }

    ensureGitHubSuccess(result.status, `Check org membership for ${login}`, result.data);
    memberCache.set(login, false);
    return false;
  }

  let changed = 0;

  for (const entry of catalog) {
    const { owner, repo } = parseRepoSlug(entry.repo_url);
    const defaultBranch = await fetchDefaultBranch(owner, repo, token);

    const [latestCommitDate, latestReleaseDate, recentCommits] = await Promise.all([
      fetchLatestCommitDate(owner, repo, defaultBranch, token),
      fetchLatestReleaseDate(owner, repo, token),
      fetchAllRecentCommits(owner, repo, defaultBranch, token, since)
    ]);

    const nextMaintainers = await deriveRecentMaintainers(recentCommits, isOrgMember, MAX_MAINTAINERS);

    const prevSnapshot = JSON.stringify({
      last_repo_commit_date: entry.last_repo_commit_date,
      last_release_date: entry.last_release_date,
      maintainers: entry.maintainers,
      maintainer_source: entry.maintainer_source,
      maintainer_last_derived_date: entry.maintainer_last_derived_date
    });

    if (latestCommitDate) {
      entry.last_repo_commit_date = latestCommitDate;
    }

    if (latestReleaseDate) {
      entry.last_release_date = latestReleaseDate;
    }

    if (nextMaintainers.length > 0) {
      if (!arraysEqual(entry.maintainers || [], nextMaintainers)) {
        entry.maintainers = nextMaintainers;
      }

      entry.maintainer_source = "derived_recent_contributors";
      entry.maintainer_last_derived_date = today;
    } else {
      if (!entry.maintainer_source) {
        entry.maintainer_source = "manual";
      }

      if (entry.maintainer_source === "manual") {
        delete entry.maintainer_last_derived_date;
      }

      console.warn(`WARN ${entry.id}: no qualifying org contributors in the last 12 months; keeping existing maintainers`);
    }

    const nextSnapshot = JSON.stringify({
      last_repo_commit_date: entry.last_repo_commit_date,
      last_release_date: entry.last_release_date,
      maintainers: entry.maintainers,
      maintainer_source: entry.maintainer_source,
      maintainer_last_derived_date: entry.maintainer_last_derived_date
    });

    if (prevSnapshot !== nextSnapshot) {
      changed += 1;
      console.log(`UPDATED ${entry.id}`);
    } else {
      console.log(`OK ${entry.id}`);
    }
  }

  if (options.dryRun) {
    console.log(`Dry run complete: ${changed} entries would change.`);
    return;
  }

  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Metadata refresh complete: ${changed} entries changed.`);
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
