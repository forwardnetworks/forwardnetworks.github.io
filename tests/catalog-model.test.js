import test from "node:test";
import assert from "node:assert/strict";

import {
  compareEntries,
  daysSince,
  inactiveFor,
  parseCatalogState,
  readinessFor,
  stateToSearchParams
} from "../site/catalog-model.js";

const FIXED_NOW = new Date("2026-02-26T12:00:00Z");

function dateDaysAgo(days) {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(FIXED_NOW.getTime() - ms).toISOString().slice(0, 10);
}

test("daysSince computes whole-day age", () => {
  assert.equal(daysSince("2026-02-26", FIXED_NOW), 0);
  assert.equal(daysSince("2026-02-25", FIXED_NOW), 1);
  assert.equal(daysSince("nope", FIXED_NOW), null);
});

test("readiness boundaries classify fresh/aging/stale", () => {
  assert.equal(readinessFor({ last_verified_date: dateDaysAgo(30) }, FIXED_NOW).label, "fresh");
  assert.equal(readinessFor({ last_verified_date: dateDaysAgo(31) }, FIXED_NOW).label, "aging");
  assert.equal(readinessFor({ last_verified_date: dateDaysAgo(90) }, FIXED_NOW).label, "aging");
  assert.equal(readinessFor({ last_verified_date: dateDaysAgo(91) }, FIXED_NOW).label, "stale");
});

test("inactive requires both repo and verification older than 180 days", () => {
  assert.equal(
    inactiveFor(
      {
        last_repo_commit_date: dateDaysAgo(181),
        last_verified_date: dateDaysAgo(181)
      },
      FIXED_NOW
    ),
    true
  );

  assert.equal(
    inactiveFor(
      {
        last_repo_commit_date: dateDaysAgo(181),
        last_verified_date: dateDaysAgo(30)
      },
      FIXED_NOW
    ),
    false
  );

  assert.equal(
    inactiveFor(
      {
        last_repo_commit_date: dateDaysAgo(180),
        last_verified_date: dateDaysAgo(181)
      },
      FIXED_NOW
    ),
    false
  );
});

test("catalog query state serializes and parses", () => {
  const original = {
    q: "netbox",
    target: "forward",
    status: "stale",
    sort: "recent",
    inactive: true
  };

  const params = stateToSearchParams(original);
  assert.equal(params.toString(), "q=netbox&target=forward&status=stale&sort=recent&inactive=1");

  const parsed = parseCatalogState(params);
  assert.deepEqual(parsed, original);
});

test("catalog query parser falls back for invalid values", () => {
  const params = new URLSearchParams("status=bad&sort=bad&inactive=0");
  const parsed = parseCatalogState(params);
  assert.equal(parsed.status, "all");
  assert.equal(parsed.sort, "trust");
  assert.equal(parsed.inactive, false);
});

test("trust sort puts healthier listings first", () => {
  const fresh = {
    name: "Fresh",
    last_verified_date: dateDaysAgo(1),
    last_repo_commit_date: dateDaysAgo(2)
  };
  const stale = {
    name: "Stale",
    last_verified_date: dateDaysAgo(95),
    last_repo_commit_date: dateDaysAgo(20)
  };

  const sorted = [stale, fresh].sort((a, b) => compareEntries(a, b, "trust", FIXED_NOW));
  assert.equal(sorted[0].name, "Fresh");
});
