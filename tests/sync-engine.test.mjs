import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMoviePayload,
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

test("operator DNF and retired decisions are hard exclusions", () => {
  const dnf = record({
    id: "dnf-2020",
    operator: {
      watched: false, reviewed: true, dnf: { value: true },
      dnr: { value: false }, retired: { value: false },
    },
  });
  const retired = record({
    id: "retired-2020",
    operator: {
      watched: false, reviewed: true, dnf: { value: false },
      dnr: { value: false }, retired: { value: true },
    },
  });

  assert.equal(canonicalExclusionStatus(dnf), "DNF");
  assert.equal(canonicalExclusionStatus(retired), "RETIRED");
});

test("a Letterboxd URI alone never marks a reviewed film watched", () => {
  const reviewed = record({
    id: "reviewed-with-uri-2019",
    title: "Reviewed With URI",
    year: 2019,
    availability: {
      english_dub: "native", streaming: [], letterboxd_rating: 3.2,
      letterboxd_uri: "https://letterboxd.com/film/reviewed-with-uri/",
    },
  });

  assert.equal(canonicalExclusionStatus(reviewed), null);
  const exclusions = loadCanonicalExclusions([reviewed]);
  assert.equal(findCanonicalExclusion({ id: reviewed.id, title: reviewed.title, year: 2019 }, exclusions), null);
  assert.equal(findCanonicalExclusion({ title: reviewed.title, year: 2019 }, exclusions), null);

  const [movie] = engineToMovies([reviewed], new Set());
  assert.equal(movie.id, "reviewed-with-uri-2019");
  assert.equal(movie.csvStatus, "REVIEWED");
});

test("status precedence mirrors film_lib.derive_status, not URI heuristics", () => {
  const uri = { english_dub: "native", streaming: [], letterboxd_uri: "https://letterboxd.com/film/x/" };
  const retired = record({
    id: "retired-uri-2020", availability: uri, status: "retired",
    operator: {
      watched: false, reviewed: true, dnf: { value: false },
      dnr: { value: false }, retired: { value: true },
    },
  });
  const nullMedium = record({ id: "null-medium-2020", medium: null });

  assert.equal(canonicalExclusionStatus(retired), "RETIRED");
  assert.equal(canonicalExclusionStatus(nullMedium), "QUARANTINED");
  assert.equal(canonicalExclusionStatus(record({ id: "no-medium-2020", medium: undefined })), null);
});

test("sync refuses a store whose stored status disagrees with derived status", () => {
  const drifted = record({
    operator: {
      watched: true, reviewed: true, dnf: { value: false },
      dnr: { value: false }, retired: { value: false },
    },
  });
  assert.throws(() => parseCanonicalRecords(`${JSON.stringify(drifted)}\n`, "fixture"), /derived "watched"/);
});

test("stable ID beats a colliding alias on a different, watched record", () => {
  const reviewed = record({ id: "the-pack-2015", title: "The Pack", year: 2015 });
  const watched = record({
    id: "pack-original-2015", title: "La Meute", year: 2015, aliases: ["The Pack"], status: "watched",
    operator: {
      watched: true, reviewed: true, dnf: { value: false },
      dnr: { value: false }, retired: { value: false },
    },
  });
  const exclusions = loadCanonicalExclusions([reviewed, watched]);

  assert.equal(findCanonicalExclusion({ id: "the-pack-2015", title: "The Pack", year: 2015 }, exclusions), null);
  assert.equal(findCanonicalExclusion({ id: "pack-original-2015", title: "La Meute", year: 2015 }, exclusions), "WATCHED");
});

test("full pipeline: a colliding alias cannot graft another film's status or data", () => {
  const reviewed = record({ id: "the-pack-2015", title: "The Pack", year: 2015 });
  const watched = record({
    id: "wolf-pack-2015", title: "Wolf Pack", year: 2015, aliases: ["The Pack"], status: "watched",
    content: { synopsis: "The other film.", why: "Other rationale.", scare_type: "Other" },
    operator: {
      watched: true, reviewed: true, dnf: { value: false },
      dnr: { value: false }, retired: { value: false },
    },
  });

  const payload = buildMoviePayload([reviewed, watched]);
  assert.deepEqual(payload.map((movie) => movie.id), ["the-pack-2015"]);
  assert.equal(payload[0].csvStatus, "REVIEWED");
  assert.equal(payload[0].whyScary, "Canonical rationale.");
});

test("a record missing operator lifecycle fields fails closed, like derive_status", () => {
  const malformed = record({ id: "no-operator-2020", status: "eligible", operator: undefined });
  assert.throws(() => canonicalExclusionStatus(malformed), /operator lifecycle fields missing/);
  assert.throws(() => parseCanonicalRecords(`${JSON.stringify(malformed)}\n`, "fixture"), /operator lifecycle/);
  const quarantined = record({ id: "q-2020", status: "quarantined", quarantined: true, operator: undefined });
  assert.equal(canonicalExclusionStatus(quarantined), "QUARANTINED", "quarantine is decided before operator is read");
});

test("movie payload is generated only from supplied canonical records", () => {
  const canonical = [record(), record({ id: "second-2021", title: "Second", year: 2021 })];
  const movies = engineToMovies(canonical, new Set());
  assert.deepEqual(movies.map((movie) => movie.title), ["Example", "Second"]);
  assert.ok(movies.every((movie) => movie.description && movie.csvStatus === "REVIEWED"));
});
