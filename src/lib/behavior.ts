import type { Movie } from "./types";

// --- Interfaces ---

export interface MovieSignals {
  saved: boolean;
  skipped: boolean;
  seen: boolean;
  expandCount: number;
  firstInteracted: string; // ISO date
  lastInteracted: string; // ISO date
}

export interface BehaviorState {
  signals: Record<string, MovieSignals>; // keyed by stable canonical film ID
  lastUpdated: string; // ISO date
}

export interface RankedMovie {
  movie: Movie;
  score: number;
  isNew: boolean;
  isSaved: boolean;
  isSkipped: boolean;
  isSeen: boolean;
}

// --- Constants ---

const STORAGE_KEY = "movie-rec-behavior";
const FRESHNESS_DAYS = 7;

// --- Helpers ---

function createDefaultSignals(): MovieSignals {
  const now = new Date().toISOString();
  return {
    saved: false,
    skipped: false,
    seen: false,
    expandCount: 0,
    firstInteracted: now,
    lastInteracted: now,
  };
}

function createDefaultState(): BehaviorState {
  return {
    signals: {},
    lastUpdated: new Date().toISOString(),
  };
}

function getOrCreateSignals(
  state: BehaviorState,
  filmId: string
): MovieSignals {
  return state.signals[filmId] ?? createDefaultSignals();
}

// Keep the most recent toggle state; never lose expand history.
function mergeSignals(a: MovieSignals, b: MovieSignals): MovieSignals {
  const newer = a.lastInteracted >= b.lastInteracted ? a : b;
  return {
    ...newer,
    expandCount: Math.max(a.expandCount, b.expandCount),
    firstInteracted:
      a.firstInteracted <= b.firstInteracted ? a.firstInteracted : b.firstInteracted,
  };
}

function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

// --- Core API ---

/**
 * Initialize or load state from localStorage.
 * Safe to call during SSR (returns default state if localStorage unavailable).
 */
export function loadBehavior(): BehaviorState {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();

    const parsed = JSON.parse(raw) as BehaviorState;
    // Basic validation
    if (parsed && typeof parsed.signals === "object" && parsed.lastUpdated) {
      return parsed;
    }
    return createDefaultState();
  } catch {
    return createDefaultState();
  }
}

/**
 * Re-key legacy title-keyed signals to stable canonical film IDs.
 * A title migrates only when exactly one movie carries it; ambiguous or
 * unknown titles stay as-is (inert) rather than being guessed onto a film.
 * Returns the same object when nothing needs to change.
 */
export function migrateTitleKeys(
  state: BehaviorState,
  movies: Movie[]
): BehaviorState {
  const ids = new Set(movies.map((m) => m.id));
  const idsByTitle = new Map<string, string[]>();
  for (const m of movies) {
    idsByTitle.set(m.title, [...(idsByTitle.get(m.title) ?? []), m.id]);
  }

  let changed = false;
  const signals: Record<string, MovieSignals> = {};
  for (const [key, value] of Object.entries(state.signals)) {
    const matches = ids.has(key) ? [key] : idsByTitle.get(key) ?? [];
    const target = matches.length === 1 ? matches[0] : key;
    if (target !== key) changed = true;
    signals[target] = signals[target] ? mergeSignals(signals[target], value) : value;
  }

  return changed ? { ...state, signals } : state;
}

/**
 * Save state to localStorage.
 * No-op during SSR.
 */
export function saveBehavior(state: BehaviorState): void {
  if (typeof window === "undefined") return;

  try {
    const updated: BehaviorState = {
      ...state,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage full or unavailable -- fail silently
  }
}

/**
 * Record a signal for a movie. Returns a new state object (immutable).
 */
export function recordSignal(
  state: BehaviorState,
  filmId: string,
  signal: "save" | "skip" | "seen" | "expand"
): BehaviorState {
  const existing = getOrCreateSignals(state, filmId);
  const now = new Date().toISOString();

  let updated: MovieSignals;

  switch (signal) {
    case "save":
      updated = { ...existing, saved: true, lastInteracted: now };
      break;
    case "skip":
      updated = { ...existing, skipped: true, lastInteracted: now };
      break;
    case "seen":
      updated = { ...existing, seen: true, lastInteracted: now };
      break;
    case "expand":
      updated = {
        ...existing,
        expandCount: existing.expandCount + 1,
        lastInteracted: now,
      };
      break;
  }

  // If this is the first interaction, set firstInteracted
  if (!state.signals[filmId]) {
    updated.firstInteracted = now;
  }

  return {
    ...state,
    signals: {
      ...state.signals,
      [filmId]: updated,
    },
    lastUpdated: now,
  };
}

/**
 * Toggle a signal (for save/skip which can be undone). Returns a new state object.
 */
export function toggleSignal(
  state: BehaviorState,
  filmId: string,
  signal: "save" | "skip"
): BehaviorState {
  const existing = getOrCreateSignals(state, filmId);
  const now = new Date().toISOString();

  const updated: MovieSignals = {
    ...existing,
    [signal === "save" ? "saved" : "skipped"]:
      signal === "save" ? !existing.saved : !existing.skipped,
    lastInteracted: now,
  };

  if (!state.signals[filmId]) {
    updated.firstInteracted = now;
  }

  return {
    ...state,
    signals: {
      ...state.signals,
      [filmId]: updated,
    },
    lastUpdated: now,
  };
}

/**
 * Score and sort movies based on behavior state.
 * Movies with `seen: true` are filtered out entirely.
 * Movies with `skipped: true` drop to the bottom but still appear.
 */
export function rankMovies(
  movies: Movie[],
  state: BehaviorState,
  dials?: { scary: number; extreme: number; pace: number }
): RankedMovie[] {
  // Collect DNA tags from all saved movies for similarity boost
  const savedDnaTags = new Set<string>();
  for (const [filmId, signals] of Object.entries(state.signals)) {
    if (signals.saved) {
      const movie = movies.find((m) => m.id === filmId);
      if (movie) {
        movie.dna.forEach((tag) => savedDnaTags.add(tag));
      }
    }
  }

  const ranked: RankedMovie[] = [];

  for (const movie of movies) {
    const signals = state.signals[movie.id];
    const isSeen = signals?.seen ?? false;
    const isSaved = signals?.saved ?? false;
    const isSkipped = signals?.skipped ?? false;

    // Filter out seen movies entirely
    if (isSeen) continue;

    // Dial filtering
    if (dials) {
      if (dials.scary > 1 && movie.scary != null && movie.scary < dials.scary) continue;
      if (dials.extreme < 10 && movie.extreme != null && movie.extreme > dials.extreme) continue;
      if (dials.pace > 0) {
        const paceMap: Record<string, number> = { slow: 1, medium: 2, fast: 3 };
        const moviePace = movie.pace ? paceMap[movie.pace] || 0 : 0;
        if (moviePace > 0 && moviePace !== dials.pace) continue;
      }
    }

    // Calculate score
    let score = 100;

    if (isSaved) score += 50;

    if (signals) {
      const expandBonus = Math.min(signals.expandCount * 10, 30);
      score += expandBonus;
    }

    if (isSkipped) score -= 100;

    // DNA similarity boost: +20 for each DNA tag shared with any saved movie
    // (but don't boost with the movie's own tags if it's the saved one)
    if (!isSaved) {
      for (const tag of movie.dna) {
        if (savedDnaTags.has(tag)) {
          score += 20;
        }
      }
    }

    // Freshness boost
    const addedDate = (movie as Movie & { addedDate?: string }).addedDate;
    const isFresh = isWithinDays(addedDate, FRESHNESS_DAYS);
    if (isFresh) score += 30;

    // "New" badge: added in last 7 days OR no interaction at all
    const hasNoInteraction = !signals;
    const isNew = isFresh || hasNoInteraction;

    ranked.push({
      movie,
      score,
      isNew,
      isSaved,
      isSkipped,
      isSeen: false, // seen movies are already filtered out
    });
  }

  // Sort: score descending, ties broken by rating descending
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.movie.rating - a.movie.rating;
  });

  return ranked;
}
