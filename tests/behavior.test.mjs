import assert from "node:assert/strict";
import test from "node:test";

import {
  migrateTitleKeys,
  rankMovies,
  recordSignal,
  toggleSignal,
} from "../src/lib/behavior.ts";

// Two distinct canonical films that share a display title (as in the live payload).
function movie(id, title, year, dna = ["isolation"]) {
  return { id, title, year, rating: 5, dna, categories: ["survival"] };
}

const packA = movie("the-pack-2015", "The Pack", 2015, ["survival"]);
const packB = movie("the-pack-2020", "The Pack", 2020, ["siege"]);
const divide = movie("the-divide-2011", "The Divide", 2011, ["survival"]);
const movies = [packA, packB, divide];

function emptyState() {
  return { signals: {}, lastUpdated: "2026-11-08T00:00:00.000Z" };
}

function signals(overrides = {}) {
  return {
    saved: false, skipped: false, seen: false, expandCount: 0,
    firstInteracted: "2026-11-01T00:00:00.000Z",
    lastInteracted: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

test("saving one of two same-title films saves only that film", () => {
  const state = toggleSignal(emptyState(), packA.id, "save");
  const ranked = rankMovies(movies, state);
  const byId = Object.fromEntries(ranked.map((rm) => [rm.movie.id, rm]));

  assert.equal(byId[packA.id].isSaved, true);
  assert.equal(byId[packB.id].isSaved, false);
  assert.equal(ranked[0].movie.id, packA.id, "saved film ranks first");
});

test("seen and skip are keyed by stable ID, not title", () => {
  let state = recordSignal(emptyState(), packB.id, "seen");
  state = toggleSignal(state, packA.id, "skip");
  const ranked = rankMovies(movies, state);

  assert.deepEqual(ranked.map((rm) => rm.movie.id).sort(), [divide.id, packA.id].sort());
  assert.equal(ranked.at(-1).movie.id, packA.id, "skipped film drops to the bottom");
});

test("expand counts accrue per film ID", () => {
  let state = recordSignal(emptyState(), packA.id, "expand");
  state = recordSignal(state, packA.id, "expand");
  assert.equal(state.signals[packA.id].expandCount, 2);
  assert.equal(state.signals[packB.id], undefined);
  assert.equal(state.signals["The Pack"], undefined);
});

test("DNA boost follows the saved film's ID", () => {
  const state = toggleSignal(emptyState(), packA.id, "save");
  const ranked = rankMovies(movies, state);
  const divideScore = ranked.find((rm) => rm.movie.id === divide.id).score;
  const packBScore = ranked.find((rm) => rm.movie.id === packB.id).score;
  assert.ok(divideScore > packBScore, "shared 'survival' DNA with the saved film boosts The Divide");
});

test("legacy title keys migrate to IDs only when the title is unambiguous", () => {
  const legacy = {
    ...emptyState(),
    signals: {
      "The Divide": signals({ saved: true, expandCount: 2 }),
      "The Pack": signals({ seen: true }),
      "Not In Payload": signals({ skipped: true }),
    },
  };
  const migrated = migrateTitleKeys(legacy, movies);

  assert.equal(migrated.signals[divide.id].saved, true);
  assert.equal(migrated.signals[divide.id].expandCount, 2);
  assert.equal(migrated.signals["The Divide"], undefined);
  assert.deepEqual(migrated.signals["The Pack"], legacy.signals["The Pack"], "ambiguous title is preserved, not guessed");
  assert.deepEqual(migrated.signals["Not In Payload"], legacy.signals["Not In Payload"]);
  assert.equal(migrated.signals[packA.id], undefined);
  assert.equal(migrated.signals[packB.id], undefined);

  const ranked = rankMovies(movies, migrated);
  assert.equal(ranked.length, 3, "an ambiguous legacy 'seen' hides neither Pack film");
});

test("migration merges a legacy title entry into an existing ID entry", () => {
  const mixed = {
    ...emptyState(),
    signals: {
      [divide.id]: signals({ saved: false, expandCount: 1, lastInteracted: "2026-11-07T00:00:00.000Z" }),
      "The Divide": signals({ saved: true, expandCount: 3, firstInteracted: "2026-10-01T00:00:00.000Z" }),
    },
  };
  const merged = migrateTitleKeys(mixed, movies).signals[divide.id];

  assert.equal(merged.saved, false, "most recent toggle wins");
  assert.equal(merged.expandCount, 3);
  assert.equal(merged.firstInteracted, "2026-10-01T00:00:00.000Z");
  assert.equal(Object.keys(migrateTitleKeys(mixed, movies).signals).length, 1);
});

test("migration is a no-op for ID-keyed state", () => {
  const state = toggleSignal(emptyState(), packA.id, "save");
  assert.equal(migrateTitleKeys(state, movies), state);
});
