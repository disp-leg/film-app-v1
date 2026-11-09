#!/usr/bin/env node
/**
 * sync-engine.mjs
 * Reads content-engine horror-100.json + canonical films.jsonl + existing movie batches,
 * merges into a single src/data/engine-movies.json matching the Movie type.
 *
 * Run: node scripts/sync-engine.mjs
 * Or:  npm run sync
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const ENGINE_ROOT = resolve(PROJECT_ROOT, "../content-engine");

// --- Paths ---
const HORROR_100_PATH = resolve(ENGINE_ROOT, "horror-100.json");
const FILMS_JSONL_PATH = resolve(ENGINE_ROOT, "data/films.jsonl");
const BATCH2_PATH = resolve(PROJECT_ROOT, "data/movies-batch2.json");
const MOVIES_JSON_PATH = resolve(PROJECT_ROOT, "data/movies.json");
const OUTPUT_PATH = resolve(PROJECT_ROOT, "src/data/engine-movies.json");

// --- Helpers ---
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeKey(title, year) {
  return `${normalizeTitle(title)}:${year}`;
}

function normalizeExternalId(value) {
  return value == null || value === "" ? null : String(value).toLowerCase();
}

const HARD_EXCLUSION_STATUSES = new Set([
  "WATCHED",
  "DNF",
  "DNR",
  "QUARANTINED",
  "RETIRED",
]);

function canonicalExclusionStatus(record) {
  const operator = record.operator || {};
  if (record.quarantined || (record.medium && record.medium !== "film")) return "QUARANTINED";
  if (operator.dnr?.value) return "DNR";
  if (operator.dnf?.value) return "DNF";
  if (operator.watched || record.availability?.letterboxd_uri) return "WATCHED";
  if (operator.retired?.value) return "RETIRED";

  const storedStatus = String(record.status || "").toUpperCase();
  return HARD_EXCLUSION_STATUSES.has(storedStatus) ? storedStatus : null;
}

function findCanonicalExclusion(movie, exclusions) {
  const tmdbId = normalizeExternalId(
    movie.tmdbId ?? movie.tmdb_id ?? movie.external_ids?.tmdb
  );
  if (tmdbId && exclusions.byTmdbId.has(tmdbId)) {
    return exclusions.byTmdbId.get(tmdbId);
  }

  const imdbId = normalizeExternalId(
    movie.imdbId ?? movie.imdb_id ?? movie.external_ids?.imdb
  );
  if (imdbId && exclusions.byImdbId.has(imdbId)) {
    return exclusions.byImdbId.get(imdbId);
  }

  if (!movie.title || !movie.year) return null;
  return exclusions.byTitleYear.get(makeKey(movie.title, movie.year)) || null;
}

// --- Load canonical hard exclusions ---
function loadCanonicalExclusions() {
  if (!existsSync(FILMS_JSONL_PATH)) {
    throw new Error(`Canonical film store not found: ${FILMS_JSONL_PATH}`);
  }

  const exclusions = {
    byTitleYear: new Map(),
    byTmdbId: new Map(),
    byImdbId: new Map(),
  };
  const lines = readFileSync(FILMS_JSONL_PATH, "utf-8").split("\n");
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON in ${FILMS_JSONL_PATH}:${index + 1}`, { cause: error });
    }

    const status = canonicalExclusionStatus(record);
    if (status) {
      const tmdbId = normalizeExternalId(record.tmdb_id ?? record.external_ids?.tmdb);
      if (tmdbId) exclusions.byTmdbId.set(tmdbId, status);

      const imdbId = normalizeExternalId(record.imdb_id ?? record.external_ids?.imdb);
      if (imdbId) exclusions.byImdbId.set(imdbId, status);

      if (record.title && record.year) {
        exclusions.byTitleYear.set(makeKey(record.title, record.year), status);
        if (record.original_title) {
          exclusions.byTitleYear.set(makeKey(record.original_title, record.year), status);
        }
      }
    }
  }

  console.log(
    `Loaded ${exclusions.byTitleYear.size} title/year, ` +
    `${exclusions.byTmdbId.size} TMDB ID, and ` +
    `${exclusions.byImdbId.size} IMDb ID hard exclusions from canonical films.jsonl`
  );
  return exclusions;
}

// --- Load engine entries ---
function loadEngineEntries() {
  if (!existsSync(HORROR_100_PATH)) {
    console.warn("WARN: horror-100.json not found at", HORROR_100_PATH);
    return [];
  }
  const raw = JSON.parse(readFileSync(HORROR_100_PATH, "utf-8"));
  const entries = raw.entries || [];
  console.log(`Loaded ${entries.length} entries from horror-100.json`);
  return entries;
}

// --- Load existing batch movies (already in Movie shape) ---
function loadBatchMovies() {
  const movies = [];
  if (existsSync(BATCH2_PATH)) {
    const batch2 = JSON.parse(readFileSync(BATCH2_PATH, "utf-8"));
    if (Array.isArray(batch2)) movies.push(...batch2);
    console.log(`Loaded ${batch2.length} movies from movies-batch2.json`);
  }
  return movies;
}

// --- Load seed batch (nested structure) ---
function loadSeedBatch() {
  if (!existsSync(MOVIES_JSON_PATH)) return [];
  const raw = JSON.parse(readFileSync(MOVIES_JSON_PATH, "utf-8"));
  const seedMovies = raw.movies || [];
  console.log(`Loaded ${seedMovies.length} movies from seed batch`);
  return seedMovies.map((m) => ({
    title: m.title,
    year: m.year,
    director: m.director,
    rating: m.letterboxd_rating ? Math.round(m.letterboxd_rating * 2.5 * 10) / 10 : 5.0,
    genres: m.genre_tags || [],
    categories: (m.dna || []).filter((d) =>
      ["survival", "bunker", "psychological", "post-apocalyptic", "confined", "group-dynamics", "societal-collapse"].includes(d)
    ),
    dna: m.dna || [],
    description: m.why_similar || "",
    letterboxd: { top_positive: "", top_negative: "" },
    whereToWatch: {
      svod: m.streaming?.svod || [],
      vod: [],
      free: m.streaming?.avod || [],
    },
    sources: [],
    tmdbId: null,
  }));
}

// --- Merge engine data onto movies ---
function enrichWithEngine(movies, engineEntries, canonicalExclusions) {
  const engineByKey = new Map();
  for (const entry of engineEntries) {
    engineByKey.set(makeKey(entry.title, entry.year), entry);
  }

  const buildDate = new Date().toISOString().split("T")[0];

  for (const movie of movies) {
    const key = makeKey(movie.title, movie.year);

    // Engine enrichment
    const eng = engineByKey.get(key);
    if (eng) {
      movie.scary = eng.scary;
      movie.production = eng.production;
      movie.extreme = eng.extreme;
      movie.paceScore = eng.pace_score;
      movie.pace = eng.pace;
      movie.whyScary = eng.why_scary;
      movie.scareType = eng.scare_type;
      movie.subGenre = eng.sub_genre;
      movie.wave = eng.wave;
      movie.compositeScore = eng.composite_scare_weighted ?? eng.composite_current;
      movie.defaultVisible = eng.default_visible;
      movie.csvStatus = eng.csv_status;
      movie.addedDate = movie.addedDate || buildDate;
      if (eng.synopsis && (!movie.description || movie.description.length < 20)) {
        movie.description = eng.synopsis;
      }
    }

    const exclusionStatus = findCanonicalExclusion(movie, canonicalExclusions);
    if (exclusionStatus) {
      movie.csvStatus = exclusionStatus;
      movie.watchedByRia = exclusionStatus === "WATCHED";
    }
  }

  return movies;
}

// --- Deduplicate by title+year ---
function deduplicate(movies) {
  const seen = new Map();
  for (const movie of movies) {
    const key = makeKey(movie.title, movie.year);
    if (!seen.has(key)) {
      seen.set(key, movie);
    } else {
      const existing = seen.get(key);
      const countFields = (m) => Object.values(m).filter((v) => v != null && v !== "").length;
      if (countFields(movie) > countFields(existing)) {
        seen.set(key, { ...existing, ...movie });
      } else {
        seen.set(key, { ...movie, ...existing });
      }
    }
  }
  return Array.from(seen.values());
}

// --- Convert engine entries to Movie shape ---
function engineToMovies(engineEntries, existingKeys) {
  const buildDate = new Date().toISOString().split("T")[0];
  const newMovies = [];

  for (const eng of engineEntries) {
    const key = makeKey(eng.title, eng.year);
    if (existingKeys.has(key)) continue; // already in app

    // Derive categories from sub_genre and scare_type
    const cats = [];
    const sg = (eng.sub_genre || "").toLowerCase();
    if (sg.includes("found footage")) cats.push("confined");
    if (sg.includes("possession") || sg.includes("haunted")) cats.push("psychological");
    if (sg.includes("survival")) cats.push("survival");
    if (sg.includes("isolation") || sg.includes("bunker")) cats.push("bunker");
    if (sg.includes("apocal")) cats.push("post-apocalyptic");
    if (cats.length === 0) cats.push("psychological"); // default bucket

    newMovies.push({
      title: eng.title,
      year: eng.year,
      director: eng.director,
      rating: eng.composite_scare_weighted ?? eng.composite_current ?? 5.0,
      genres: [eng.sub_genre || "Horror"],
      categories: cats,
      dna: [eng.scare_type || "horror", eng.sub_genre || ""].filter(Boolean),
      description: eng.synopsis || "",
      letterboxd: { top_positive: "", top_negative: "" },
      whereToWatch: {
        svod: eng.streaming ? [eng.streaming] : [],
        vod: [],
        free: [],
      },
      sources: [],
      tmdbId: null,
      scary: eng.scary,
      production: eng.production,
      extreme: eng.extreme,
      paceScore: eng.pace_score,
      pace: eng.pace,
      whyScary: eng.why_scary,
      scareType: eng.scare_type,
      subGenre: eng.sub_genre,
      wave: eng.wave,
      addedDate: buildDate,
      compositeScore: eng.composite_scare_weighted ?? eng.composite_current,
      defaultVisible: eng.default_visible,
      csvStatus: eng.csv_status,
    });
  }

  console.log(`${newMovies.length} new movies from engine (not in existing batches)`);
  return newMovies;
}

// --- Main ---
function main() {
  const canonicalExclusions = loadCanonicalExclusions();
  const engineEntries = loadEngineEntries();
  const seedMovies = loadSeedBatch();
  const batchMovies = loadBatchMovies();

  // Combine: batch movies first (better shape), then seed
  let allMovies = deduplicate([...batchMovies, ...seedMovies]);
  console.log(`${allMovies.length} unique movies after dedup`);

  // Add engine-only entries as new movies
  const existingKeys = new Set(allMovies.map((m) => makeKey(m.title, m.year)));
  const engineMovies = engineToMovies(engineEntries, existingKeys);
  allMovies = [...allMovies, ...engineMovies];

  // Enrich ALL movies with engine data + canonical exclusion status.
  allMovies = enrichWithEngine(allMovies, engineEntries, canonicalExclusions);

  // Filter out default_visible=false from engine (subtitle-only)
  allMovies = allMovies.filter((m) => m.defaultVisible !== false);

  // Fail closed: watched, DNF, DNR, quarantined, and retired films must never
  // enter the static recommendation payload, regardless of which source added them.
  const beforeExclusions = allMovies.length;
  allMovies = allMovies.filter((movie) => {
    const legacyStatus = String(movie.csvStatus || "").toUpperCase();
    return (
      !findCanonicalExclusion(movie, canonicalExclusions) &&
      !HARD_EXCLUSION_STATUSES.has(legacyStatus)
    );
  });

  console.log(`${beforeExclusions - allMovies.length} hard-excluded movies removed`);
  console.log(`${allMovies.length} movies after visibility and exclusion filters`);

  // Ensure output directory exists
  const outputDir = dirname(OUTPUT_PATH);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(allMovies, null, 2));
  console.log(`Wrote ${allMovies.length} movies to ${OUTPUT_PATH}`);
}

main();
