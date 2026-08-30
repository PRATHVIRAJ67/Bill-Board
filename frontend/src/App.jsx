import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Preload } from "@react-three/drei";
import * as THREE from "three";
import HeroScene from "@/components/HeroScene";
import LiveActivity from "@/components/LiveActivity";
import ClaimSpotModal from "@/components/ClaimSpotModal";
import SponsorsPage from "./components/SponsorsPage";
import FaqSection from "./components/FaqSection";
import ContactSection from "./components/ContactSection";
import { SPOTS, getLinkIcon } from "@/components/spotData";
import { fetchLiveSpots } from "@/lib/api";
import { audioManager } from "@/lib/audioManager";
import "@/App.css";


function useScreenState() {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return { isMobile: false, isPortrait: true };
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMobile = w <= 860 || (h <= 500 && w <= 1000);
    const isPortrait = h >= w;
    return { isMobile, isPortrait };
  });

  useEffect(() => {
    const handleCheck = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isMobile = w <= 860 || (h <= 500 && w <= 1000);
      const isPortrait = h >= w;
      setState({ isMobile, isPortrait });
    };
    window.addEventListener("resize", handleCheck);
    window.addEventListener("orientationchange", handleCheck);
    return () => {
      window.removeEventListener("resize", handleCheck);
      window.removeEventListener("orientationchange", handleCheck);
    };
  }, []);

  return state;
}

export default function App() {
  const [currentView, setCurrentView] = useState("board"); // 'board' | 'sponsors'
  const [cameraMode, setCameraMode] = useState("cinematic");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [soundActive, setSoundActive] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [resetTick, setResetTick] = useState(0);
  const [spotsList, setSpotsList] = useState(SPOTS);
  const [claimModalSpot, setClaimModalSpot] = useState(null);
  const { isMobile, isPortrait } = useScreenState();

  // Global listener to unlock & resume AudioContext on first tap/click
  useEffect(() => {
    const handleFirstInteraction = () => {
      audioManager.init().then((success) => {
        if (success) {
          setSoundActive(true);
        }
      });
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };

    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  const handleToggleSound = (e) => {
    e?.stopPropagation();
    const active = audioManager.toggleMute();
    setSoundActive(active);
  };

  // Load dynamic spots from backend API & poll periodically
  useEffect(() => {
    const loadSpots = () => {
      fetchLiveSpots().then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          const merged = SPOTS.map((defaultSpot) => {
            const dbSpot = data.find((s) => s.id === defaultSpot.id);
            if (dbSpot && dbSpot.claimed && dbSpot.handle && dbSpot.handle !== "AVAILABLE") {
              return { ...defaultSpot, ...dbSpot };
            }
            return defaultSpot;
          });
          setSpotsList(merged);
        }
      });
    };

    loadSpots();
    const timer = setInterval(loadSpots, 5000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const claimed = spotsList.filter((s) => s.claimed).length;
    const available = spotsList.length - claimed;
    const unclimedSpots = spotsList.filter((s) => !s.claimed);
    const minPrice = unclimedSpots.length > 0 ? Math.min(...unclimedSpots.map((s) => s.price || 25)) : 25;
    return { total: spotsList.length, claimed, available, minPrice };
  }, [spotsList]);

  const hoveredSpot = hoveredId != null ? spotsList.find((s) => s.id === hoveredId) : null;
  const selectedSpot = selectedId != null ? spotsList.find((s) => s.id === selectedId) : null;

  const cameraConfig = isMobile
    ? isPortrait
      ? { position: [0, 2.0, 10.2], fov: 65, near: 0.1, far: 250 }
      : { position: [0, 1.4, 5.6], fov: 56, near: 0.1, far: 250 }
    : { position: [0, 1.85, 7.8], fov: 68, near: 0.1, far: 250 };

  const handleZoom = () => {
    audioManager.playAction();
    setZoomStep((s) => (s + 1) % 3);
  };
  const handleReset = () => {
    audioManager.playAction();
    setSelectedId(null);
    setZoomStep(0);
    setCameraMode("cinematic");
    setResetTick((t) => t + 1);
  };
  const handleEnterBoardCam = () => {
    audioManager.playAction();
    setCameraMode("orbit");
    setSelectedId(null);
  };

  const handleSelect = (id) => {
    const spot = spotsList.find((s) => s.id === id);
    setSelectedId(id);
    if (spot && !spot.claimed) {
      setClaimModalSpot(spot);
    } else {
      setCameraMode("cinematic");
    }
  };

  const handleOpenClaimFirstAvailable = () => {
    audioManager.playAction();
    const avail = spotsList.find((s) => !s.claimed) || spotsList[0];
    if (avail) {
      setSelectedId(avail.id);
      setClaimModalSpot(avail);
    }
  };

  const handleClaimSuccess = (updatedSpot) => {
    audioManager.playSelect();
    setSpotsList((prev) =>
      prev.map((s) => (s.id === updatedSpot.id ? { ...s, ...updatedSpot } : s))
    );
    setSelectedId(updatedSpot.id);
  };

  const handleCloseSpot = () => {
    audioManager.playAction();
    setSelectedId(null);
  };

  const topSponsor = useMemo(() => {
    // 1. Claimed spots ordered by highest price, then lowest id
    const claimedSpots = spotsList.filter((s) => s.claimed);
    if (claimedSpots.length > 0) {
      return [...claimedSpots].sort((a, b) => ((b.price || 0) - (a.price || 0)) || (a.id - b.id))[0];
    }
    // 2. Fallback to Spot 1 (Highest Amount Spot)
    return spotsList.find((s) => s.id === 1) || spotsList[0];
  }, [spotsList]);

  const handleVisitTopSponsor = (e) => {
    e?.stopPropagation();
    audioManager.playSelect();
    if (topSponsor?.claimed && topSponsor?.link_url) {
      const finalUrl = topSponsor.link_url.startsWith("http")
        ? topSponsor.link_url
        : `https://${topSponsor.link_url}`;
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } else if (topSponsor?.claimed) {
      setSelectedId(topSponsor.id);
      setCameraMode("cinematic");
    } else {
      setSelectedId(topSponsor?.id || 8);
      setClaimModalSpot(topSponsor || spotsList[7]);
    }
  };

  const handleVisitLink = (url) => {
    if (!url) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  };

  const scrollToSection = (id) => {
    audioManager.playAction();
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <main className={`board-app app ${isMobile ? "is-mobile" : ""} ${isPortrait ? "is-portrait" : "is-landscape"}`} data-testid="main-app">
      {/* SECTION 1: 3D BILLBOARD HERO VIEWPORT */}
      <section id="board" className="hero-viewport-section" data-testid="board-section">
        <div className="canvas-wrapper">
          <Canvas
            dpr={[1, 2]}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.28 }}
            shadows={!isMobile}
            camera={cameraConfig}
          >
            <color attach="background" args={["#03060b"]} />
            <fog attach="fog" args={["#081420", 28, isMobile ? 110 : 125]} />
            <Suspense fallback={null}>
              <HeroScene
                cameraMode={cameraMode}
                isMobile={isMobile}
                isPortrait={isPortrait}
                zoomStep={zoomStep}
                hoveredId={hoveredId}
                selectedId={selectedId}
                onHover={setHoveredId}
                onSelect={handleSelect}
                resetTick={resetTick}
                spots={spotsList}
              />
              <Preload all />
            </Suspense>
          </Canvas>
        </div>

        <div className="hud" data-testid="experience-hud">
          <header className="topbar" data-testid="top-navigation">
            <div className="brand" onClick={() => scrollToSection("board")} style={{ cursor: "pointer" }} data-testid="brand-mark">
              THE BOARD <span>•</span>
            </div>
            <nav aria-label="Main navigation">
              <button
                className="nav-item active"
                onClick={() => scrollToSection("board")}
                data-testid="nav-the-board"
              >
                THE BOARD
              </button>

              <button
                className="nav-item"
                onClick={() => scrollToSection("sponsors")}
                data-testid="nav-sponsors"
              >
                SPONSORS
              </button>

              <button
                className="nav-item"
                onClick={() => scrollToSection("faq")}
                data-testid="nav-faq"
              >
                FAQ
              </button>

              <button
                className="nav-item"
                onClick={() => scrollToSection("contact")}
                data-testid="nav-contact"
              >
                CONTACT
              </button>

              <button
                className="nav-item highlight-cta"
                onClick={handleOpenClaimFirstAvailable}
                data-testid="nav-get-spot"
              >
                GET A SPOT
              </button>
            </nav>
            <div className="live-readout" data-testid="live-status">
              <i /> LIVE <strong>{stats.claimed} / {stats.total}</strong> CLAIMED
            </div>
            <button
              className={`sound-toggle ${soundActive ? "active" : ""}`}
              onClick={handleToggleSound}
              aria-label={soundActive ? "Mute ambient audio" : "Unmute ambient audio"}
              title={soundActive ? "Ambient Chill Soundscape: ACTIVE (Click to mute)" : "Ambient Audio: MUTED (Click to activate)"}
              data-testid="sound-toggle-button"
            >
              <div className={`sound-eq-bars ${soundActive ? "active" : ""}`}>
                <span /><span /><span />
              </div>
              {soundActive ? "AMBIENT ON" : "AUDIO OFF"}
            </button>
            <button
              className={`menu-button ${mobileMenuOpen ? "open" : ""}`}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              data-testid="menu-button"
            ><span /><span /><span /></button>
          </header>

          {isMobile && mobileMenuOpen && (
            <div className="mobile-drawer" data-testid="mobile-drawer" onClick={() => setMobileMenuOpen(false)}>
              <div className="mobile-drawer-panel" onClick={(e) => e.stopPropagation()}>
                <button
                  className="drawer-item"
                  onClick={() => scrollToSection("board")}
                  data-testid="drawer-the-board"
                >
                  THE BOARD 3D
                </button>

                <button
                  className="drawer-item"
                  onClick={() => scrollToSection("sponsors")}
                  data-testid="drawer-sponsors"
                >
                  🏆 SPONSORS (RANKED)
                </button>

                <button
                  className="drawer-item"
                  onClick={() => scrollToSection("faq")}
                  data-testid="drawer-faq"
                >
                  ❓ FAQ
                </button>

                <button
                  className="drawer-item"
                  onClick={() => scrollToSection("contact")}
                  data-testid="drawer-contact"
                >
                  ✉️ CONTACT
                </button>

                <button
                  className="drawer-cta"
                  onClick={() => { setMobileMenuOpen(false); handleOpenClaimFirstAvailable(); }}
                  data-testid="drawer-get-spot"
                >GET YOUR SPOT ↗</button>
                <div className="drawer-meta">
                  {stats.total} SPOTS · {stats.claimed} CLAIMED · FROM ${stats.minPrice}
                </div>
              </div>
            </div>
          )}

          <section className={`hero-copy ${selectedSpot ? "hero-copy--dim" : ""}`} data-testid="hero-copy">
            <p className="eyebrow">LIMITED EDITION #1 · 20 LIFETIME SPOTS</p>
            <h1 data-testid="hero-title">THE INTERNET’S<br /><em>BILLBOARD.</em></h1>
            <p className="hero-subtitle" data-testid="hero-subtitle">Own a billboard spot for your brand. One-time purchase. Lifetime ownership.</p>
            <div className="hero-meta" data-testid="hero-meta">
              {stats.total} SPOTS <b>·</b> {stats.claimed} CLAIMED <b>·</b> <strong style={{ color: "#00c48c" }}>{stats.available} AVAILABLE</strong> <b>·</b> FROM ${stats.minPrice}
            </div>
            {stats.available > 0 ? (
              <button className="primary-cta" onClick={handleOpenClaimFirstAvailable} data-testid="board-cam-button">
                CLAIM LIFETIME SPOT <span>↗</span>
              </button>
            ) : (
              <button
                className="primary-cta soldout"
                onClick={() => {
                  audioManager.playAction();
                  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
                }}
                data-testid="board-cam-button"
              >
                🎉 BOARD #1 SOLD OUT · JOIN BOARD #2 WAITLIST <span>↗</span>
              </button>
            )}
          </section>

          {/* Hover tooltip */}
          {hoveredSpot && !selectedSpot && (
            <div className="hover-badge" data-testid="hover-badge">
              <div className="hb-num">SPOT #{String(hoveredSpot.id).padStart(2, "0")}</div>
              <div className="hb-state">
                {hoveredSpot.claimed ? hoveredSpot.handle : "AVAILABLE"}
              </div>
              {!hoveredSpot.claimed && <div className="hb-price">${hoveredSpot.price}</div>}
              {hoveredSpot.claimed && hoveredSpot.category && (
                <div className="hb-cat">{getLinkIcon(hoveredSpot.link_type)} {hoveredSpot.category}</div>
              )}
              <div className="hb-hint">{hoveredSpot.claimed ? "TAP TO INSPECT / VISIT" : "TAP TO CLAIM WITH RAZORPAY"}</div>
            </div>
          )}

          {/* Selected spot detail inspector card */}
          {selectedSpot && (
            <div className="spot-card" data-testid="spot-card">
              <button
                type="button"
                className="spot-card-close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseSpot();
                }}
                aria-label="Close"
              >
                ✕
              </button>
              <div className="spot-card-tag">SPOT #{String(selectedSpot.id).padStart(2, "0")}</div>
              {selectedSpot.claimed ? (
                <>
                  <div className="spot-card-badge" style={{ background: selectedSpot.color || "#00c48c" }} />
                  <h2 className="spot-card-title">{selectedSpot.handle}</h2>
                  <p className="spot-card-sub">{getLinkIcon(selectedSpot.link_type)} {selectedSpot.category} · CLAIMED</p>
                  <div className="spot-card-row"><span>STATUS</span><b>CLAIMED & LIVE</b></div>
                  <div className="spot-card-row"><span>OWNER</span><b>{selectedSpot.handle}</b></div>
                  {selectedSpot.link_url && (
                    <div className="spot-card-row"><span>DESTINATION</span><b className="link-preview-txt">{selectedSpot.link_url}</b></div>
                  )}
                  {selectedSpot.link_url ? (
                    <button className="spot-card-cta" onClick={() => handleVisitLink(selectedSpot.link_url)} data-testid="spot-card-visit">
                      VISIT WEBSITE {getLinkIcon(selectedSpot.link_type)} ↗
                    </button>
                  ) : (
                    <button className="spot-card-cta secondary" onClick={handleCloseSpot} data-testid="spot-card-back">
                      BACK TO THE BOARD
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="spot-card-avail">AVAILABLE</div>
                  <div className="spot-card-price">${selectedSpot.price}</div>
                  <div className="spot-card-row"><span>STATUS</span><b>OPEN FOR CLAIM</b></div>
                  <div className="spot-card-row"><span>POSITION</span><b>ROW {Math.floor((selectedSpot.id - 1) / 5) + 1}, COL {((selectedSpot.id - 1) % 5) + 1}</b></div>
                  <button className="spot-card-cta" onClick={() => setClaimModalSpot(selectedSpot)} data-testid="spot-card-claim">
                    CLAIM WITH RAZORPAY →
                  </button>
                  <p className="spot-card-note">Instant 3D Board update powered by Supabase & Razorpay.</p>
                </>
              )}
            </div>
          )}

          {!isMobile && <LiveActivity onFocusSpot={setSelectedId} />}

          <div className="scene-note" data-testid="scene-note">
            <span className="pulse-dot" /> LIVE SCENE
            <small>THE DIGITAL BOARD IS MOVING</small>
          </div>

          <div className="board-stats" data-testid="board-stats">
            <div className="bs-row"><span>{stats.total}</span> SPOTS</div>
            <div className="bs-row"><span>{stats.claimed}</span> CLAIMED</div>
            <div className="bs-row available"><span>{stats.available}</span> AVAILABLE</div>
            <div className="bs-row"><span>${stats.minPrice}</span> FROM</div>
          </div>

          <div className="camera-dock" data-testid="camera-dock">
            <span className="dock-label">BOARD CAM <b>●</b></span>
            <button
              className={cameraMode === "orbit" && selectedId == null ? "selected" : ""}
              onClick={handleEnterBoardCam}
              data-testid="orbit-control"
            >ORBIT</button>
            <button
              className={cameraMode === "cinematic" && selectedId == null ? "selected" : ""}
              onClick={() => { setCameraMode("cinematic"); setSelectedId(null); }}
              data-testid="cinematic-control"
            >{isMobile ? "CINEMA" : "CINEMATIC"}</button>
            <button
              className={cameraMode === "sweep" && selectedId == null ? "selected" : ""}
              onClick={() => { setCameraMode("sweep"); setSelectedId(null); }}
              data-testid="sweep-control"
            >{isMobile ? "SWEEP 360°" : "360° SWEEP ✈️"}</button>
            <button onClick={handleZoom} data-testid="zoom-control">
              ZOOM {zoomStep > 0 ? `x${zoomStep + 1}` : "⊕"}
            </button>
            <button onClick={handleReset} data-testid="reset-control">RESET</button>
          </div>
        </div>
      </section>

      {/* SECTION 2: SPONSORS RANKED LEADERBOARD */}
      <SponsorsPage
        spots={spotsList}
        onBackToBoard={() => scrollToSection("board")}
        onClaimSpot={(spot) => {
          setSelectedId(spot.id);
          setClaimModalSpot(spot);
        }}
        onInspectSpot={(spotId) => {
          setSelectedId(spotId);
          setCameraMode("cinematic");
          scrollToSection("board");
        }}
      />

      {/* SECTION 3: FAQ */}
      <FaqSection />

      {/* SECTION 4: CONTACT ME */}
      <ContactSection />

      {/* FOOTER */}
      <footer className="site-footer" data-testid="site-footer">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-brand">
              <h3>THE BOARD <span>•</span></h3>
              <p>The Internet's Billboard — Premium Lifetime 3D Advertising Space.</p>
            </div>
            <div className="footer-nav">
              <button onClick={() => scrollToSection("board")}>The Board</button>
              <button onClick={() => scrollToSection("sponsors")}>Sponsors</button>
              <button onClick={() => scrollToSection("faq")}>FAQ</button>
              <button onClick={() => scrollToSection("contact")}>Contact</button>
              <button onClick={handleOpenClaimFirstAvailable} className="footer-claim-link">Claim Spot ↗</button>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} The Internet's Billboard. All rights reserved. 20 Lifetime Spots.</p>
            <button className="back-to-top-btn" onClick={() => scrollToSection("board")}>
              ↑ BACK TO TOP
            </button>
          </div>
        </div>
      </footer>

      {/* Claim Spot Form & Razorpay Payment Modal (Top Level) */}
      {claimModalSpot && (
        <ClaimSpotModal
          spot={claimModalSpot}
          onClose={() => setClaimModalSpot(null)}
          onClaimSuccess={handleClaimSuccess}
        />
      )}
    </main>
  );
}
