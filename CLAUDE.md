# Movie Recommendation App v2 — Node Operating Manual

## Project Overview
Movie Recommendation App v2 based on The Divide (2011). Curated deep-cut movies from real human sources — not algorithmic slop. Elite iOS-quality design with real motion. Continuous discovery pipeline that never stops feeding new movies.

**Repo:** disp-leg/movie-rec-v2
**Deploy:** Netlify (auto on push)
**CI/CD from day one.**

---

## Agent Team

The node session acts as **Project Manager**. It coordinates these agents:

### Design Researcher (opus)
- Studies spottedinprod.com reference apps: Retro MP3 (cover flow), Bop (mix it), Pool (swipe the duck)
- Extracts interaction patterns, motion principles, visual language, color, typography
- Must have **TASTE** — design literacy, knows Dribbble/Awwwards/iOS HIG, can distinguish elite from generic
- Tools: Firecrawl, Playwright, screenshot tools, web search

### Content Researcher (opus) — CONTINUOUS ROLE
- Deep dives Reddit (r/horror, r/moviesuggestions, r/TrueFilm, r/obscuremedia), Letterboxd, horror TikTok, X, YouTube, blogs
- Must have **DEEP FILM KNOWLEDGE** — horror/thriller subgenres, cult communities, Letterboxd culture
- Knows The Divide (2011) and why it works: survival, isolation, claustrophobia, societal collapse, psychological horror, bleak tone
- This is **NOT a one-time task** — it's a continuous pipeline feeding new movies over time
- Tools: Firecrawl, web search, last30days skill

### UX Designer (opus)
- Generates screen ideas, creates draw.io mockups, defines interaction specs
- Works from Design Researcher output
- MOBILE-FIRST always
- Tools: draw.io generation, frontend-design skill

### Builder (opus)
- Implements from approved spec + mockup
- Stack: Next.js (App Router), GSAP, Lottie, Three.js (if needed), Tailwind, PostgreSQL (for Railway), Drizzle ORM
- Real motion design — not CSS transitions
- Tools: Context7 for latest docs, TMDB API for posters

### QA/Test Agent (sonnet)
- Active during build phase, **NOT just at the end**
- Tests every checkpoint alongside Builder
- Runs app, verifies interactions, flags bugs in real time
- Tools: Playwright for interaction testing, all build tools

### Review Agent (sonnet)
- Final polish: code review, visual QA, motion QA, performance audit
- Tools: Playwright, Lighthouse

---

## Phases

**Phase 1 + 2 run in PARALLEL:**

### Phase 1: Content Research
Content Researcher finds first batch of 15-20 movies. Continuous pipeline after that.

### Phase 2: Design Research → Mockups
Design Researcher studies reference apps → UX Designer creates draw.io mockups.

### Phase 3: Merge
Merge approved movie list + approved mockup into PB&J spec.

### Phase 4: Build
Builder + QA build the app. Netlify dev deploy at checkpoints.

### Phase 5: Review + Ship
Review Agent + operator final approval → Railway production deploy.

---

## Gates — NOTHING advances without operator approval via Telegram

| Gate | Deliverable |
|------|-------------|
| Phase 1 | 10 random movies + source list, screenshot from GitHub |
| Phase 2 | Draw.io mockup screenshots |
| Phase 4 | Netlify preview URL |
| Phase 5 | Railway production URL |

---

## Hard NOs

- **No AI slop** (black/purple gradients, neon, generic dark mode)
- **No terracotta or amber**
- **No corny UI**
- **No mainstream/obvious movie picks**
- **No code before mockup approval**
- **No cards of any kind** — no swipe cards, no stacked cards, no card-based UI. Rejected by operator.
- **No horror/movie theming on the UI** — the app is clean and premium, not a themed experience
- **No generic fonts** — elite only
- **No desktop-first** — MOBILE-FIRST always

---

## Communication

- Report to the operator directly in the session at each gate
- If blocked, ask the operator

---

## Behavior-Based Recommendations

Track user signals: save, skip, watch, favorite.

| Signal | Effect |
|--------|--------|
| Save | Surface more like this |
| Skip | Surface less like this |
| Favorited + watched | Strong signal |

- Reorder feed based on accumulated behavior
- **Not ML** — simple weighted filtering

---

## Movie Constraints

- **2000 or newer**
- **English audio only**
- **Deep cuts only** — nothing a Google search surfaces
- Must share DNA with The Divide: survival, isolation, claustrophobia, post-apocalyptic, psychological horror, bleak

---

## Deployment

| Environment | Platform | Trigger |
|-------------|----------|---------|
| Production | GitHub Pages | Auto on push to main |

- Repo: `disp-leg/movie-rec-v2`
- CI/CD from day one

---

## Design References

### Retro MP3
https://www.spottedinprod.com/apps/retrompthree/823
3D, cover art, flip, scrub, skeuomorphism

### Bop
https://www.spottedinprod.com/apps/bop/753
Cover art, create, discovery, scroll, skeuomorphism

### Pool
https://www.spottedinprod.com/apps/pool/744
Keypad, shader, skeuomorphism, swipe, throw

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Animation:** GSAP, Lottie, Three.js (if needed)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (Railway)
- **ORM:** Drizzle ORM
- **Posters:** TMDB API
- **Design:** Mobile-first, elite typography, real motion

---

## Required Plugins

- Firecrawl (scraping)
- Playwright (screenshots + QA testing)
- Context7 (latest library docs)
- GitHub MCP (push to disp-leg/movie-rec-v2)

---

## Completion Criteria

- App runs locally without errors
- All phases gated and approved by operators
- Continuous content pipeline operational
- Behavior-based recommendation engine working
- Deployed to Railway production
- Clean git history
- This CLAUDE.md updated with lessons learned

---

## Assumptions

<!-- Log every assumption. Tag each: [VERIFIED], [UNVERIFIED], or [INVALID] -->

## Approval Scope

**You decide (Level 1):** Implementation approach, animation choices, component structure, test strategy
**Ask the operator (Level 2):** Additional agents, scope changes, timeline extensions >25%
**Operator approval (Level 3):** Phase gate approvals, completion, abort

## Pre-Graduation Self-Review

- [ ] Does the deliverable match what was asked?
- [ ] Does the app build without errors?
- [ ] Were all tests run and passing?
- [ ] Is the `## Assumptions` section up to date?
- [ ] Are lessons learned documented?
- [ ] Is the deliverable statement written?

## Lessons Learned

## Deliverable
