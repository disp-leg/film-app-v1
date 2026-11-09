import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalExclusionStatus,
  engineToMovies,
  findCanonicalExclusion,
  loadCanonicalExclusions,
  parseCanonicalRecords,
} from "../scripts/sync-engine.mjs";

function record(overrides = {}) {
  return {
    id: "example-2020",
    title: "Example",
    year: 2020,
    original_title: null,
    aliases: [],
    medium: "film",
    quarantined: false,
    status: "reviewed",
    intrinsic: { genre: "Horror", sub_genre: "Psychological", director: "Director" },
    availability: { english_dub: "native", streaming: ["Shudder"], letterboxd_rating: 3.5 },
    scores: { dread: 8, intensity: 7, production: 8, pace: 7 },
    content: { synopsis: "A canonical synopsis.", why: "Canonical rationale.", scare_type: "Dread" },
    operator: {
      watched: false, reviewed: true, dnf: { value: false },
      dnr: { value: false }, retired: { value: false },
    },
    dates: { date_added: "2026-11-08" },
    surfaced_in: ["canonical-test"],
    external_ids: { imdb: null, tmdb: null },
    tags: ["isolation"],
    ...overrides,
  };
}

test("canonical parser fails closed on malformed, empty, and duplicate input", () => {
  assert.throws(() => parseCanonicalRecords("", "fixture"), /empty/);
  assert.throws(() => parseCanonicalRecords("{bad}\n", "fixture"), /Invalid JSON/);
  const line = JSON.stringify(record());
  assert.throws(() => parseCanonicalRecords(`${line}\n${line}\n`, "fixture"), /duplicate id/);
});

test("alias matching enforces canonical exclusions", () => {
  const watched = record({
    aliases: ["Alternate Name"],
    status: "watched",
    operator: {
      watched: true, reviewed: true, dnf: { value: false },
      dnr: { value: false }, retired: { value: false },
    },
  });
  const exclusions = loadCanonicalExclusions([watched]);
  assert.equal(findCanonicalExclusion({ title: "Alternate Name", year: 2020 }, exclusions), "WATCHED");
  assert.equal(canonicalExclusionStatus(watched), "WATCHED");
});

test("movie payload is generated only from supplied canonical records", () => {
  const canonical = [record(), record({ id: "second-2021", title: "Second", year: 2021 })];
  const movies = engineToMovies(canonical, new Set());
  assert.deepEqual(movies.map((movie) => movie.title), ["Example", "Second"]);
  assert.ok(movies.every((movie) => movie.description && movie.csvStatus === "REVIEWED"));
});
