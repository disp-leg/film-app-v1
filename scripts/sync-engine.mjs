#!/usr/bin/env node
/**
 * sync-engine.mjs
 * Reads canonical content-engine films.jsonl and emits a single
 * src/data/engine-movies.json matching the Movie type.
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
const FILMS_JSONL_PATH = resolve(ENGINE_ROOT, "data/films.jsonl");
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

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function paceLabel(value) {
  const score = numeric(value);
  if (score == null) return undefined;
  if (score >= 7) return "fast";
  if (score <= 3) return "slow";
  return "medium";
}

function defaultVisible(record) {
  const intrinsic = record.intrinsic || {};
  const englishDub = record.availability?.english_dub;
  const language = String(intrinsic.language || "").trim().toLowerCase();

  if (intrinsic.is_english === true || language === "english") return true;
  if (englishDub === "native" || englishDub === "dub_available") return true;
  if (englishDub === "subs_only" || intrinsic.is_english === false) return false;
  return true;
}

function compositeScore(record) {
  const scores = record.scores || {};
  const scary = numeric(scores.dread);
  const extreme = numeric(scores.intensity);
  const production = numeric(scores.production);
  const pace = numeric(scores.pace);
  if ([scary, extreme, production, pace].some((value) => value == null)) return null;

  const paceBonus = pace >= 7 ? 5 : pace <= 3 ? 0 : 3;
  const mpaaBonus = ["r", "unrated_or_adult"].includes(record.availability?.mpaa_ladder)
    ? 0.5
    : 0;
  return Math.round(
    (scary * 0.5 + extreme * 0.15 + production * 0.25 + paceBonus * 0.1 + mpaaBonus) * 100
  ) / 100;
}

function canonicalStatus(record) {
  return canonicalExclusionStatus(record) ||
    (String(record.status || "").toUpperCase() === "REVIEWED" ? "REVIEWED" : "ELIGIBLE");
}

function hasRecommendationData(record) {
  const scores = record.scores || {};
  return (
    [scores.dread, scores.intensity, scores.production, scores.pace].some(
      (value) => numeric(value) != null
    ) ||
    Boolean(record.content?.synopsis || record.content?.why) ||
    Boolean(record.content?.scare_type || record.intrinsic?.sub_genre)
  );
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

// --- Load the single canonical film store ---
function loadCanonicalRecords() {
  if (!existsSync(FILMS_JSONL_PATH)) {
    throw new Error(`Canonical film store not found: ${FILMS_JSONL_PATH}`);
  }

  const source = readFileSync(FILMS_JSONL_PATH, "utf-8");
  return parseCanonicalRecords(source, FILMS_JSONL_PATH);
}

function parseCanonicalRecords(source, sourceName = "films.jsonl") {
  if (!source.trim()) {
    throw new Error(`Canonical film store is empty: ${sourceName}`);
  }
  const records = [];
  const ids = new Set();
  for (const [index, line] of source.split("\n").entries()) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON in ${sourceName}:${index + 1}`, { cause: error });
    }
    if (!record || typeof record.title !== "string" || !record.title.trim()) {
      throw new Error(`Missing title in ${sourceName}:${index + 1}`);
    }
    if (!Number.isInteger(record.year)) {
      throw new Error(`Invalid year in ${sourceName}:${index + 1}`);
    }
    if (typeof record.id !== "string" || !record.id || ids.has(record.id)) {
      throw new Error(`Missing or duplicate id in ${sourceName}:${index + 1}`);
    }
    ids.add(record.id);
    records.push(record);
  }

  console.log(`Loaded ${records.length} records from canonical films.jsonl`);
  return records;
}

// --- Index canonical hard exclusions ---
function loadCanonicalExclusions(records) {
  const exclusions = {
    byTitleYear: new Map(),
    byTmdbId: new Map(),
    byImdbId: new Map(),
  };
  for (const record of records) {
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
        for (const alias of record.aliases || []) {
          exclusions.byTitleYear.set(makeKey(alias, record.year), status);
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

// --- Merge canonical engine data onto movies ---
function enrichWithEngine(movies, canonicalRecords, canonicalExclusions) {
  const engineByKey = new Map();
  for (const record of canonicalRecords) {
    engineByKey.set(makeKey(record.title, record.year), record);
    if (record.original_title) {
      engineByKey.set(makeKey(record.original_title, record.year), record);
    }
    for (const alias of record.aliases || []) {
      engineByKey.set(makeKey(alias, record.year), record);
    }
  }

  const buildDate = new Date().toISOString().split("T")[0];

  for (const movie of movies) {
    const key = makeKey(movie.title, movie.year);

    // Engine enrichment
    const record = engineByKey.get(key);
    if (record && hasRecommendationData(record)) {
      const scores = record.scores || {};
      movie.scary = numeric(scores.dread) ?? movie.scary;
      movie.production = numeric(scores.production) ?? movie.production;
      movie.extreme = numeric(scores.intensity) ?? movie.extreme;
      movie.paceScore = numeric(scores.pace) ?? movie.paceScore;
      movie.pace = paceLabel(scores.pace) ?? movie.pace;
      movie.whyScary = record.content?.why || movie.whyScary;
      movie.scareType = record.content?.scare_type || record.intrinsic?.sub_genre || movie.scareType;
      movie.subGenre = record.intrinsic?.sub_genre || movie.subGenre;
      movie.wave = record.surfaced_in?.at(-1) || movie.wave;
      movie.compositeScore = compositeScore(record) ?? movie.compositeScore;
      movie.defaultVisible = defaultVisible(record);
      movie.csvStatus = canonicalStatus(record);
      movie.addedDate = movie.addedDate || record.dates?.date_added || buildDate;
      movie.posterPath = record.availability?.poster_path || movie.posterPath;
      movie.tmdbId = normalizeExternalId(
        record.tmdb_id ?? record.external_ids?.tmdb
      ) || movie.tmdbId;
      const streaming = record.availability?.streaming || [];
      if (streaming.length && !movie.whereToWatch?.svod?.length) {
        movie.whereToWatch = {
          svod: streaming,
          vod: movie.whereToWatch?.vod || [],
          free: movie.whereToWatch?.free || [],
        };
      }
      if (record.content?.synopsis && (!movie.description || movie.description.length < 20)) {
        movie.description = record.content.synopsis;
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

function deriveCategories(record) {
  const source = [
    record.intrinsic?.sub_genre,
    record.content?.scare_type,
    ...(record.tags || []),
  ].filter(Boolean).join(" ").toLowerCase();
  const categories = [];
  if (source.includes("found footage")) categories.push("confined");
  if (source.includes("possession") || source.includes("haunted")) categories.push("psychological");
  if (source.includes("survival")) categories.push("survival");
  if (source.includes("isolation") || source.includes("bunker")) categories.push("bunker");
  if (source.includes("apocal")) categories.push("post-apocalyptic");
  return categories.length ? categories : ["psychological"];
}

function fallbackRating(record) {
  const composite = compositeScore(record);
  if (composite != null) return composite;

  const letterboxd = numeric(record.availability?.letterboxd_rating);
  if (letterboxd != null) return Math.round(letterboxd * 2 * 10) / 10;

  const scored = [
    record.scores?.dread,
    record.scores?.intensity,
    record.scores?.production,
    record.scores?.pace,
  ].map(numeric).filter((value) => value != null);
  return scored.length
    ? Math.round((scored.reduce((sum, value) => sum + value, 0) / scored.length) * 100) / 100
    : 5.0;
}

// --- Convert canonical records to Movie shape ---
function engineToMovies(canonicalRecords, existingKeys) {
  const buildDate = new Date().toISOString().split("T")[0];
  const newMovies = [];

  for (const record of canonicalRecords) {
    const key = makeKey(record.title, record.year);
    if (existingKeys.has(key)) continue; // already in app

    const scores = record.scores || {};
    const subGenre = record.intrinsic?.sub_genre;
    const scareType = record.content?.scare_type || subGenre;
    const dna = [...new Set([scareType, subGenre, ...(record.tags || [])].filter(Boolean))];
    const composite = compositeScore(record);

    newMovies.push({
      title: record.title,
      year: record.year,
      director: record.intrinsic?.director || "",
      rating: fallbackRating(record),
      genres: [record.intrinsic?.genre || subGenre || "Horror"],
      categories: deriveCategories(record),
      dna: dna.length ? dna : ["horror"],
      description: record.content?.synopsis || record.content?.one_line || record.content?.premise || "",
      letterboxd: { top_positive: "", top_negative: "" },
      whereToWatch: {
        svod: record.availability?.streaming || [],
        vod: [],
        free: [],
      },
      sources: [],
      tmdbId: normalizeExternalId(record.tmdb_id ?? record.external_ids?.tmdb),
      scary: numeric(scores.dread) ?? undefined,
      production: numeric(scores.production) ?? undefined,
      extreme: numeric(scores.intensity) ?? undefined,
      paceScore: numeric(scores.pace) ?? undefined,
      pace: paceLabel(scores.pace),
      whyScary: record.content?.why || undefined,
      scareType: scareType || undefined,
      subGenre: subGenre || undefined,
      wave: record.surfaced_in?.at(-1),
      addedDate: record.dates?.date_added || buildDate,
      compositeScore: composite ?? undefined,
      defaultVisible: defaultVisible(record),
      csvStatus: canonicalStatus(record),
      posterPath: record.availability?.poster_path || undefined,
    });
  }

  console.log(`${newMovies.length} new movies from canonical engine data (not in existing batches)`);
  return newMovies;
}

// --- Main ---
function main() {
  const canonicalRecords = loadCanonicalRecords();
  const canonicalExclusions = loadCanonicalExclusions(canonicalRecords);
  const recommendationRecords = canonicalRecords.filter(
    (record) => !canonicalExclusionStatus(record) && hasRecommendationData(record)
  );
  let allMovies = engineToMovies(recommendationRecords, new Set());

  // Enrich ALL movies with engine data + canonical exclusion status.
  allMovies = enrichWithEngine(allMovies, canonicalRecords, canonicalExclusions);

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export {
  canonicalExclusionStatus,
  engineToMovies,
  findCanonicalExclusion,
  loadCanonicalExclusions,
  parseCanonicalRecords,
};
