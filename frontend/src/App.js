import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Preload } from "@react-three/drei";
import * as THREE from "three";
import HeroScene from "@/components/HeroScene";
import LiveActivity from "@/components/LiveActivity";
import ClaimSpotModal from "@/components/ClaimSpotModal";
import { SPOTS, getLinkIcon } from "@/components/spotData";
import { fetchLiveSpots } from "@/lib/api";
import "@/App.css";

const navItems = ["THE BOARD", "EXPLORE", "LIVE", "HOW IT WORKS"];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 800px)").matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 800px)");
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function App() {
  const [cameraMode, setCameraMode] = useState("cinematic");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [resetTick, setResetTick] = useState(0);
  const [spotsList, setSpotsList] = useState(SPOTS);
  const [claimModalSpot, setClaimModalSpot] = useState(null);
  const isMobile = useIsMobile();

  // Load dynamic spots from backend API & poll periodically
  useEffect(() => {
    const loadSpots = () => {
      fetchLiveSpots().then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setSpotsList(data);
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
    ? { position: [0, 2.4, 18.0], fov: 58, near: 0.1, far: 250 }
    : { position: [0, 1.85, 7.8], fov: 68, near: 0.1, far: 250 };

  const handleZoom = () => setZoomStep((s) => (s + 1) % 3);
  const handleReset = () => {
    setSelectedId(null);
    setZoomStep(0);
    setCameraMode("cinematic");
    setResetTick((t) => t + 1);
  };
  const handleEnterBoardCam = () => {
    setCameraMode("orbit");
    setSelectedId(null);
  };

  const handleSelect = (id) => {
    const spot = spotsList.find((s) => s.id === id);
    if (spot && !spot.claimed) {
      setClaimModalSpot(spot);
    } else {
      setSelectedId(id);
      setCameraMode("cinematic");
    }
  };

  const handleOpenClaimFirstAvailable = () => {
    const avail = spotsList.find((s) => !s.claimed) || spotsList[0];
    setClaimModalSpot(avail);
  };

  const handleClaimSuccess = (updatedSpot) => {
    setSpotsList((prev) =>
      prev.map((s) => (s.id === updatedSpot.id ? { ...s, ...updatedSpot } : s))
    );
    setSelectedId(updatedSpot.id);
  };

  const handleCloseSpot = () => setSelectedId(null);

  const handleVisitLink = (url) => {
    if (!url) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <main className={`board-app ${isMobile ? "is-mobile" : ""}`} data-testid="board-experience">
      <div className="canvas-stage" data-testid="hero-3d-canvas">
        <Canvas
          dpr={isMobile ? [1, 1.35] : [1, 1.65]}
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
          <div className="brand" data-testid="brand-mark">THE BOARD <span>•</span></div>
          <nav aria-label="Main navigation">
            {navItems.map((item, index) => (
              <button
                key={item}
                className={`nav-item ${index === 0 ? "active" : ""}`}
                data-testid={`nav-${item.toLowerCase().replaceAll(" ", "-")}`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="live-readout" data-testid="live-status">
            <i /> LIVE <strong>{stats.claimed} / {stats.total}</strong> CLAIMED
          </div>
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
              {navItems.map((item, index) => (
                <button
                  key={item}
                  className={`drawer-item ${index === 0 ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`drawer-${item.toLowerCase().replaceAll(" ", "-")}`}
                >{item}</button>
              ))}
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
          <p className="hero-subtitle" data-testid="hero-subtitle">Own a billboard spot for your brand.One-time purchase. Lifetime ownership.</p>
          <div className="hero-meta" data-testid="hero-meta">
            {stats.total} SPOTS <b>·</b> {stats.claimed} CLAIMED <b>·</b> <strong style={{ color: "#00c48c" }}>{stats.available} AVAILABLE</strong> <b>·</b> FROM ${stats.minPrice}
          </div>
          {stats.available > 0 ? (
            <button className="primary-cta" onClick={handleOpenClaimFirstAvailable} data-testid="board-cam-button">
              CLAIM LIFETIME SPOT <span>↗</span>
            </button>
          ) : (
            <button className="primary-cta soldout" onClick={() => alert("Billboard #1 is 100% Sold Out! Board #2 Launching Soon.")} data-testid="board-cam-button">
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
                    VISIT LINK {getLinkIcon(selectedSpot.link_type)} ↗
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

        {/* Claim Spot Form & Razorpay Payment Modal */}
        {claimModalSpot && (
          <ClaimSpotModal
            spot={claimModalSpot}
            onClose={() => setClaimModalSpot(null)}
            onClaimSuccess={handleClaimSuccess}
          />
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
          >CINEMATIC</button>
          <button
            className={cameraMode === "sweep" && selectedId == null ? "selected" : ""}
            onClick={() => { setCameraMode("sweep"); setSelectedId(null); }}
            data-testid="sweep-control"
          >360° SWEEP ✈️</button>
          <button onClick={handleZoom} data-testid="zoom-control">
            ZOOM {zoomStep > 0 ? `x${zoomStep + 1}` : "⊕"}
          </button>
          <button onClick={handleReset} data-testid="reset-control">RESET</button>
        </div>
      </div>
    </main>
  );
}
