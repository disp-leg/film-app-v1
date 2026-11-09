"use client";

import { useState, useEffect, useMemo } from "react";
import HeroSection from "@/components/HeroSection";
import BrowseRows from "@/components/BrowseRows";
import TabBar from "@/components/TabBar";
import DetailOverlay from "@/components/DetailOverlay";
import WatchedLedger from "@/components/WatchedLedger";
import IntensityDials from "@/components/IntensityDials";
import { movies } from "@/lib/movies";
import { useBehavior } from "@/hooks/useBehavior";
import { Movie } from "@/lib/types";
import { DialState, DEFAULT_DIALS } from "@/lib/engine-types";
import { loadDials, saveDials } from "@/lib/dials";

export default function Home() {
  const { rankedMovies, hydrated, save, markSeen, recordExpand } = useBehavior(movies);
  const rankedFeed = useMemo(() => rankedMovies.map((rm) => rm.movie), [rankedMovies]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [activeTab, setActiveTab] = useState<string>("home");
  const [dials, setDials] = useState<DialState>(DEFAULT_DIALS);
  const [showDials, setShowDials] = useState(false);

  useEffect(() => {
    setDials(loadDials());
  }, []);

  const handleDialChange = (newDials: DialState) => {
    setDials(newDials);
    saveDials(newDials);
  };

  return (
    <div style={{ background: "#000", minHeight: "100vh", paddingBottom: 80 }}>
      <HeroSection onSelect={setSelectedMovie} />

      {/* Dials toggle */}
      <button
        onClick={() => setShowDials(!showDials)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          margin: "16px 20px 0",
          padding: "8px 14px",
          background: showDials ? "#2C2C2E" : "transparent",
          border: "1px solid #38383A",
          borderRadius: 20,
          color: "#8E8E93",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          transition: "background 0.2s ease",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
        Intensity
      </button>

      {showDials && <IntensityDials dials={dials} onChange={handleDialChange} />}

      {/* Remount once personalized ranking loads: mandatory scroll-snap would
          otherwise re-snap each row to the tile that was first before ranking. */}
      <BrowseRows
        key={hydrated ? "ranked" : "pre-hydration"}
        movies={rankedFeed}
        dials={dials}
        onSelect={(movie) => {
          setSelectedMovie(movie);
          recordExpand(movie.id);
        }}
      />
      <WatchedLedger
        movies={movies}
        onSelect={(movie) => {
          setSelectedMovie(movie);
          recordExpand(movie.id);
        }}
      />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      {selectedMovie && (
        <DetailOverlay
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onSave={() => save(selectedMovie.id)}
          onMarkSeen={() => markSeen(selectedMovie.id)}
          isSaved={
            rankedMovies.find((rm) => rm.movie.id === selectedMovie.id)
              ?.isSaved || false
          }
        />
      )}
    </div>
  );
}
