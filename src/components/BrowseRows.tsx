"use client";

import { Movie } from "@/lib/types";
import { getPosterUrl } from "@/lib/posters";
import { getTitleColor } from "@/lib/poster";
import FreshStrip from "@/components/FreshStrip";
import { DialState } from "@/lib/engine-types";

interface BrowseRowsProps {
  movies: Movie[];
  dials?: DialState;
  onSelect: (movie: Movie) => void;
}

const ROWS = [
  { label: "Survival", filter: "survival" },
  { label: "Bunker Films", filter: "bunker" },
  { label: "Psychological", filter: "psychological" },
  { label: "Post-Apocalyptic", filter: "post-apocalyptic" },
  { label: "Group Dynamics", filter: "group-dynamics" },
];

function PosterCard({ movie, onSelect }: { movie: Movie; onSelect: (m: Movie) => void }) {
  const posterUrl = getPosterUrl(movie.title);
  const { from, to } = getTitleColor(movie.title);

  return (
    <button
      onClick={() => onSelect(movie)}
      style={{
        flexShrink: 0,
        width: 150,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "none",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        padding: 0,
      }}
    >
      <div
        style={{
          width: 150,
          height: 225,
          borderRadius: 8,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(145deg, ${from}, ${to})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 14,
                fontWeight: 600,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {movie.title}
            </span>
          </div>
        )}
      </div>
      <div style={{ paddingLeft: 2 }}>
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: 146,
          }}
        >
          {movie.title}
        </div>
        <div
          style={{
            color: "#8E8E93",
            fontSize: 12,
            fontWeight: 400,
            marginTop: 2,
          }}
        >
          {movie.year}
        </div>
      </div>
    </button>
  );
}

function passesDialFilter(m: Movie, dials?: DialState): boolean {
  if (!dials) return true;
  if (dials.scary > 1 && m.scary != null && m.scary < dials.scary) return false;
  if (dials.extreme < 10 && m.extreme != null && m.extreme > dials.extreme) return false;
  if (dials.pace > 0) {
    const paceMap: Record<string, number> = { slow: 1, medium: 2, fast: 3 };
    const moviePace = m.pace ? paceMap[m.pace] || 0 : 0;
    if (moviePace > 0 && moviePace !== dials.pace) return false;
  }
  return true;
}

export default function BrowseRows({ movies, dials, onSelect }: BrowseRowsProps) {
  return (
    <div>
      <FreshStrip movies={movies} onSelect={onSelect} />
      {ROWS.map((row) => {
        const filtered = movies.filter(
          (m) =>
            !m.watchedByRia &&
            passesDialFilter(m, dials) &&
            m.categories.some((c) => c.toLowerCase() === row.filter.toLowerCase())
        );
        if (filtered.length === 0) return null;

        return (
          <div key={row.filter}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#FFFFFF",
                padding: "0 20px",
                marginTop: 32,
                marginBottom: 16,
                letterSpacing: "-0.01em",
              }}
            >
              {row.label}
            </h2>
            <div
              className="hide-scrollbar"
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                paddingLeft: 20,
                paddingRight: 20,
                scrollSnapType: "x mandatory",
              }}
            >
              {filtered.map((movie) => (
                <div key={movie.id} style={{ scrollSnapAlign: "start" }}>
                  <PosterCard movie={movie} onSelect={onSelect} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
