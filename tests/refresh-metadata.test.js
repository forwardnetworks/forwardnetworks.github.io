import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveRecentMaintainers,
  ensureGitHubSuccess,
  parseRepoSlug,
  toDateOnly
} from "../scripts/refresh-metadata.mjs";

test("parseRepoSlug extracts owner and repo", () => {
  assert.deepEqual(parseRepoSlug("https://github.com/forwardnetworks/intent-gen"), {
    owner: "forwardnetworks",
    repo: "intent-gen"
  });
});

test("toDateOnly normalizes valid timestamps", () => {
  assert.equal(toDateOnly("2026-02-26T14:20:33Z"), "2026-02-26");
  assert.equal(toDateOnly("invalid"), null);
});

test("ensureGitHubSuccess throws actionable API error", () => {
  assert.doesNotThrow(() => ensureGitHubSuccess(200, "Fetch metadata", { message: "ok" }));
  assert.throws(
    () => ensureGitHubSuccess(500, "Fetch metadata", { message: "server exploded" }),
    /Fetch metadata failed with status 500: server exploded/
  );
});

test("deriveRecentMaintainers keeps top org members only", async () => {
  const commits = [
    { author: { login: "alice" } },
    { author: { login: "alice" } },
    { author: { login: "bob" } },
    { author: { login: "outsider" } },
    { author: null }
  ];

  async function isOrgMember(login) {
    return login === "alice" || login === "bob";
  }

  const maintainers = await deriveRecentMaintainers(commits, isOrgMember, 5);
  assert.deepEqual(maintainers, ["@alice", "@bob"]);
});
