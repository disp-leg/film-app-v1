"use client";

import { Movie } from "@/lib/types";
import { getPosterUrl } from "@/lib/posters";
import { getTitleColor } from "@/lib/poster";

interface FreshStripProps {
  movies: Movie[];
  onSelect: (movie: Movie) => void;
}

function isRecent(movie: Movie, days: number): boolean {
  if (!movie.addedDate) return false;
  const added = new Date(movie.addedDate);
  const now = new Date();
  const diffMs = now.getTime() - added.getTime();
  return diffMs / (1000 * 60 * 60 * 24) <= days;
}

export default function FreshStrip({ movies, onSelect }: FreshStripProps) {
  const freshMovies = movies.filter(
    (m) => !m.watchedByRia && isRecent(m, 14)
  );

  if (freshMovies.length === 0) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 20px",
          marginTop: 32,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#FFFFFF",
            letterSpacing: "-0.01em",
          }}
        >
          Fresh from the crypt
        </h2>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#FF453A",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            animation: "pulse-new 2s ease-in-out infinite",
          }}
        >
          NEW
        </span>
      </div>

      <style>{`
        @keyframes pulse-new {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

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
        {freshMovies.map((movie) => {
          const posterUrl = getPosterUrl(movie.title);
          const { from, to } = getTitleColor(movie.title);

          return (
            <button
              key={movie.id}
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
                scrollSnapAlign: "start",
              }}
            >
              <div
                style={{
                  width: 150,
                  height: 225,
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "0 0 0 1px rgba(255, 69, 58, 0.3)",
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
                {/* NEW badge */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    background: "#FF453A",
                    color: "#FFFFFF",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "3px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.05em",
                  }}
                >
                  NEW
                </div>
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
        })}
      </div>
    </div>
  );
}
