# Movie Rec v2

Curated movie recommendations based on [The Divide (2011)](https://letterboxd.com/film/the-divide-2011/). 26 deep-cut survival, isolation, and psychological horror films sourced from Reddit, Letterboxd, horror TikTok, YouTube, X, and blogs. Not algorithmic — human-sourced, validator-checked, and filtered against a specific user's watch history.

**Live:** [Netlify deploy](https://scintillating-centaur-277ce3.netlify.app)
**Repo:** [disp-leg/movie-rec-v2](https://github.com/disp-leg/movie-rec-v2)

---

## Tech Stack

- **Framework:** Next.js 15 (App Router, static export)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + inline styles for iOS-native proportions
- **Animation:** GSAP (scroll-driven), CSS transitions
- **Fonts:** Inter (400/600/700/800 via next/font)
- **Posters:** TMDB image API (`image.tmdb.org/t/p/w500/`)
- **Data:** Static JSON (26 movies with full metadata)
- **Deploy:** Netlify (static site, no server functions)

## Setup

```bash
git clone https://github.com/disp-leg/movie-rec-v2.git
cd movie-rec-v2
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build & Deploy

```bash
npm run build        # Static export to out/
npx netlify-cli deploy --dir=out --allow-anonymous
```

Or connect the repo on [netlify.com](https://netlify.com) for auto-deploy on push.

---

## Architecture

### UI Structure

Single-page continuous scroll with five sections:

1. **Hero** — Full-bleed featured movie poster with dark gradient overlay, title, tagline
2. **Featured Pick** — The top recommendation with large poster, full description, Letterboxd quotes
3. **Category Rows** — Horizontal scroll rows grouped by theme (Survival, Bunker, Psychological, Post-Apocalyptic, Confined, Group Dynamics). App Store / Apple TV style.
4. **Full Collection** — All 26 films as a vertical list with thumbnail posters. Tap to expand inline detail view with description, reviews, streaming info, and actions.
5. **Footer** — Attribution

### Behavior Engine

`src/lib/behavior.ts` + `src/hooks/useBehavior.ts`

Tracks user signals per movie via localStorage:

| Signal | Effect on Score |
|--------|----------------|
| **Save** | +50 |
| **Expand** (tap to read) | +10 per expand (max +30) |
| **Skip** ("Not for me") | -100 (drops to bottom, still visible) |
| **Seen** ("Already seen") | -200 (filtered out entirely) |

Additional scoring:

- **DNA similarity boost:** +20 for each DNA tag shared with any saved movie. If you save a bunker film, other bunker films rise.
- **Freshness boost:** +30 for movies added in the last 7 days.
- **Tie-breaking:** Rating descending.

Skipped movies can be un-skipped. Seen movies are hidden. State persists in localStorage under `movie-rec-behavior`.

On first visit, movies come from the generated `src/data/engine-movies.json` payload (base score 100).

### Content Pipeline

Movies are sourced from real human recommendations, not algorithms.

**Sources searched:**
- Reddit: r/horror, r/moviesuggestions, r/TrueFilm, r/obscuremedia
- Letterboxd: lists, similar films, reviews
- Horror TikTok, YouTube channels, X/Film Twitter
- Horror blogs: HorrorNews.net, Bloody Disgusting, Scariest Things, Creepy Catalog
- IMDB curated lists

**Constraints (every movie must pass):**
- Released 2000 or later
- English audio (original language, not dubbed)
- Deep cut — not surfaced by a casual Google search, no A-list leads with wide theatrical release
- Shares at least 2 DNA traits with The Divide: survival, isolation, claustrophobia, post-apocalyptic, psychological horror, bleak tone, bunker/confined setting, group dynamics, societal collapse, power dynamics

**Validation:** Two-pass automated validation (Data Validator agent) checks year, language, mainstream visibility, thematic DNA match, and data completeness. Films that fail are removed.

**User filter:** Cross-referenced against Letterboxd user Riamont's watched list (scraped via pagination). Any film she's already seen is excluded.

**Each movie entry includes:**
- Title, year, director, rating
- Genre tags and DNA tags
- Description explaining specifically why it's similar to The Divide
- Letterboxd quotes (top positive + top negative review)
- Streaming availability (SVOD, VOD, free platforms)
- Source URLs for attribution
- TMDB poster path

### Poster Images

Poster paths originate in the canonical content-engine `data/films.jsonl` records. The `src/lib/posters.ts` module builds full TMDB URLs:

```
https://image.tmdb.org/t/p/w500/{posterPath}
```

`MoviePoster` component handles rendering with a gradient fallback when no poster is available.

---

## Data Files

| File | Contents |
|------|----------|
| `src/data/engine-movies.json` | Generated app payload; `npm run sync` rebuilds it from canonical content-engine `data/films.jsonl` |
| `data/design-research.md` | Reference app analysis (Retro MP3, Bop, Pool) |
| `data/ux-spec.md` | UX specification |
| `data/mockup.drawio` | draw.io wireframe mockup |
| `data/validation-report.md` | Batch 1 validation results |
| `data/validation-report-batch2.md` | Batch 2 validation results |
| `data/riamont-watched.json` | Scraped Letterboxd watch history |
| `data/riamont-filter-report.md` | Cross-reference results |

---

## Design

- **Mode:** Light (white surface, #F5F5F7 secondary)
- **Accent:** #0496FF (poly blue)
- **Text:** #1D1D1F primary, #6E6E73 secondary
- **Font:** Inter only — no serifs
- **Proportions:** iOS-native (20px page padding, 8/12px border radius, Apple type scale)
- **Inspiration:** poly.app landing page, Apple TV app, App Store editorial

---

## License

Not licensed for redistribution. Movie data is sourced from public community recommendations. Poster images served via TMDB's image API.
