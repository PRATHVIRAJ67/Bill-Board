import { useState, useMemo } from "react";
import { getLinkIcon } from "@/components/spotData";
import { audioManager } from "@/lib/audioManager";

export default function SponsorsPage({ spots = [], onBackToBoard, onClaimSpot, onInspectSpot }) {
  const [filter, setFilter] = useState("all"); // 'all' | 'claimed' | 'available'
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Sort spots strictly by highest amount (price) descending, then by spot id
  const rankedSpots = useMemo(() => {
    const list = [...spots];
    list.sort((a, b) => {
      const priceDiff = (b.price || 0) - (a.price || 0);
      if (priceDiff !== 0) return priceDiff;
      return a.id - b.id;
    });

    return list.map((spot, index) => ({
      ...spot,
      rank: index + 1,
    }));
  }, [spots]);

  // Filter & Search
  const filteredSpots = useMemo(() => {
    return rankedSpots.filter((s) => {
      if (filter === "claimed" && !s.claimed) return false;
      if (filter === "available" && s.claimed) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const handleMatch = s.handle?.toLowerCase().includes(q);
        const catMatch = s.category?.toLowerCase().includes(q);
        const urlMatch = s.link_url?.toLowerCase().includes(q);
        const rankMatch = String(s.rank).includes(q) || String(s.id).includes(q);
        return handleMatch || catMatch || urlMatch || rankMatch;
      }
      return true;
    });
  }, [rankedSpots, filter, searchQuery]);

  const stats = useMemo(() => {
    const claimedCount = spots.filter((s) => s.claimed).length;
    const totalCount = spots.length;
    const topClaimed = rankedSpots.find((s) => s.claimed);
    return {
      claimedCount,
      totalCount,
      availableCount: totalCount - claimedCount,
      topClaimed,
    };
  }, [spots, rankedSpots]);

  const handleVisitWebsite = (e, url) => {
    if (e) e.stopPropagation();
    audioManager.playSelect();
    if (!url) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = (e, spotId, url) => {
    if (e) e.stopPropagation();
    if (!url) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    navigator.clipboard.writeText(finalUrl).then(() => {
      setCopiedId(spotId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCardClick = (spot) => {
    if (spot.claimed) {
      if (spot.link_url) {
        handleVisitWebsite(null, spot.link_url);
      } else if (onInspectSpot) {
        onInspectSpot(spot.id);
      }
    } else if (onClaimSpot) {
      onClaimSpot(spot);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return { icon: "👑", label: "#1 PRIME", class: "rank-gold" };
    if (rank === 2) return { icon: "🥈", label: "#2 PRIME", class: "rank-silver" };
    if (rank === 3) return { icon: "🥉", label: "#3 INNER", class: "rank-bronze" };
    if (rank <= 6) return { icon: "⭐", label: `#${rank} INNER`, class: "rank-inner" };
    return { icon: "◈", label: `#${rank}`, class: "rank-standard" };
  };

  return (
    <section id="sponsors" className="sponsors-page" data-testid="sponsors-page">
      <div className="sponsors-container">
        {/* Top Header */}
        <header className="sponsors-header">
          <div className="sponsors-header-left">
            <button
              className="back-btn"
              onClick={() => {
                audioManager.playAction();
                if (onBackToBoard) onBackToBoard();
                else document.getElementById("board")?.scrollIntoView({ behavior: "smooth" });
              }}
              data-testid="back-to-board-btn"
            >
              ↑ <span>3D BOARD</span>
            </button>
            <h2 className="sponsors-title">
              SPONSORS <em>LEADERBOARD</em>
            </h2>
          </div>

          <div className="sponsors-stats-pill">
            <div className="s-stat">
              <span>{stats.claimedCount} / {stats.totalCount}</span> CLAIMED
            </div>
            <div className="s-stat highlight">
              <span>{stats.availableCount}</span> OPEN
            </div>
          </div>
        </header>

        {/* Featured #1 Sponsor Hero Banner if claimed */}
        {stats.topClaimed && (
          <div
            className="top-sponsor-spotlight"
            onClick={() => handleCardClick(stats.topClaimed)}
            style={{ cursor: "pointer" }}
            data-testid="top-sponsor-spotlight"
          >
            <div className="spotlight-badge">👑 #1 RANKED SPONSOR SPOTLIGHT</div>
            <div className="spotlight-content">
              <div
                className="spotlight-avatar"
                style={{ background: stats.topClaimed.color || "#00d9ff" }}
              >
                {getLinkIcon(stats.topClaimed.link_type)}
              </div>
              <div className="spotlight-info">
                <h2>{stats.topClaimed.handle}</h2>
                <p>
                  {stats.topClaimed.category} · Spot #{String(stats.topClaimed.id).padStart(2, "0")} (Tier: Prime Center)
                </p>
                {stats.topClaimed.link_url && (
                  <span className="spotlight-url">{stats.topClaimed.link_url}</span>
                )}
              </div>
              <div className="spotlight-actions">
                {stats.topClaimed.link_url ? (
                  <button
                    className="spotlight-visit-btn"
                    onClick={(e) => handleVisitWebsite(e, stats.topClaimed.link_url)}
                    data-testid="top-sponsor-visit-btn"
                  >
                    VISIT WEBSITE ↗
                  </button>
                ) : (
                  <button
                    className="spotlight-inspect-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onInspectSpot) onInspectSpot(stats.topClaimed.id);
                    }}
                  >
                    INSPECT ON BOARD ↗
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls: Search and Filters */}
        <div className="sponsors-controls">
          <div className="sponsors-filters">
            <button
              className={`filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => { audioManager.playAction(); setFilter("all"); }}
            >
              ALL SPOTS ({rankedSpots.length})
            </button>
            <button
              className={`filter-btn ${filter === "claimed" ? "active" : ""}`}
              onClick={() => { audioManager.playAction(); setFilter("claimed"); }}
            >
              👑 CLAIMED BRANDS ({stats.claimedCount})
            </button>
            <button
              className={`filter-btn ${filter === "available" ? "active" : ""}`}
              onClick={() => { audioManager.playAction(); setFilter("available"); }}
            >
              ⚡ AVAILABLE ({stats.availableCount})
            </button>
          </div>

          <div className="sponsors-search">
            <input
              type="text"
              placeholder="Search sponsor brand, category, URL, or rank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery("")}>✕</button>
            )}
          </div>
        </div>

        {/* Ranked Sponsors Grid */}
        <div className="sponsors-grid">
          {filteredSpots.map((spot) => {
            const badge = getRankBadge(spot.rank);
            const isPrime = spot.price === 125;
            const isClaimed = spot.claimed;

            return (
              <div
                key={spot.id}
                className={`sponsor-card ${isClaimed ? "is-claimed" : "is-available"} ${isPrime ? "is-prime" : ""}`}
                onClick={() => handleCardClick(spot)}
                data-testid={`sponsor-row-${spot.rank}`}
              >
                {/* Rank Badge */}
                <div className={`rank-badge ${badge.class}`}>
                  <span className="rank-icon">{badge.icon}</span>
                  <span className="rank-num">RANK #{spot.rank}</span>
                  {isPrime && <span className="prime-tag">PRIME $125</span>}
                </div>

                {/* Spot Brand & Identity */}
                <div className="sponsor-main">
                  <div
                    className="sponsor-dot"
                    style={{ background: isClaimed ? (spot.color || "#00c48c") : "rgba(0, 217, 255, 0.25)" }}
                  />
                  <div className="sponsor-details">
                    <div className="sponsor-header-line">
                      <h3 className="sponsor-handle">
                        {isClaimed ? spot.handle : `Spot #${String(spot.id).padStart(2, "0")} (Open)`}
                      </h3>
                      {isClaimed && (
                        <span className="verified-badge">✓ VERIFIED SPONSOR</span>
                      )}
                    </div>
                    <div className="sponsor-meta-row">
                      <span className="spot-num-tag">SPOT #{String(spot.id).padStart(2, "0")}</span>
                      <span className="spot-category-tag">
                        {getLinkIcon(spot.link_type)} {isClaimed ? spot.category : "Available Spot"}
                      </span>
                      <span className="spot-price-tag">${spot.price}</span>
                      {spot.link_url && (
                        <span className="spot-url-preview" title={spot.link_url}>
                          🌐 {spot.link_url.replace(/^https?:\/\/(www\.)?/, '')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions & Buttons */}
                <div className="sponsor-actions" onClick={(e) => e.stopPropagation()}>
                  {isClaimed ? (
                    <>
                      {spot.link_url ? (
                        <>
                          <button
                            className="visit-site-btn"
                            onClick={(e) => handleVisitWebsite(e, spot.link_url)}
                            title={`Directly visit ${spot.link_url}`}
                            data-testid={`visit-sponsor-${spot.id}`}
                          >
                            VISIT WEBSITE <span>↗</span>
                          </button>
                          <button
                            className="copy-link-btn"
                            onClick={(e) => handleCopyLink(e, spot.id, spot.link_url)}
                            title="Copy link to clipboard"
                          >
                            {copiedId === spot.id ? "COPIED ✓" : "COPY 📋"}
                          </button>
                        </>
                      ) : (
                        <span className="no-link-badge">LIVE ON BOARD</span>
                      )}
                      <button
                        className="inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInspectSpot) onInspectSpot(spot.id);
                        }}
                        title="View in 3D Billboard"
                      >
                        3D VIEW ↗
                      </button>
                    </>
                  ) : (
                    <button
                      className="claim-spot-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onClaimSpot) onClaimSpot(spot);
                      }}
                      data-testid={`claim-sponsor-${spot.id}`}
                    >
                      CLAIM FOR ${spot.price} <span>→</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredSpots.length === 0 && (
            <div className="sponsors-empty">
              <p>No sponsors match your search.</p>
              <button onClick={() => { setFilter("all"); setSearchQuery(""); }}>
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
