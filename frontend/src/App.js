import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Preload } from "@react-three/drei";
import HeroScene from "@/components/HeroScene";
import LiveActivity from "@/components/LiveActivity";
import { SPOTS } from "@/components/spotData";
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
  const [cinematic, setCinematic] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [resetTick, setResetTick] = useState(0);
  const isMobile = useIsMobile();

  const stats = useMemo(() => {
    const claimed = SPOTS.filter((s) => s.claimed).length;
    const available = SPOTS.length - claimed;
    const minPrice = Math.min(...SPOTS.filter((s) => !s.claimed).map((s) => s.price));
    return { total: SPOTS.length, claimed, available, minPrice };
  }, []);

  const hoveredSpot = hoveredId != null ? SPOTS.find((s) => s.id === hoveredId) : null;
  const selectedSpot = selectedId != null ? SPOTS.find((s) => s.id === selectedId) : null;

  const cameraConfig = isMobile
    ? { position: [0, 3.5, 22], fov: 50, near: 0.1, far: 200 }
    : { position: [0, 3.0, 18], fov: 52, near: 0.1, far: 200 };

  const handleZoom = () => setZoomStep((s) => (s + 1) % 3);
  const handleReset = () => {
    setSelectedId(null);
    setZoomStep(0);
    setCinematic(true);
    setResetTick((t) => t + 1);
  };
  const handleEnterBoardCam = () => {
    setCinematic(false);
    setSelectedId(null);
  };
  const handleSelect = (id) => {
    setSelectedId(id);
    setCinematic(true); // suspend cinematic sway; SceneCamera prioritises focus flight
  };
  const handleCloseSpot = () => setSelectedId(null);

  return (
    <main className={`board-app ${isMobile ? "is-mobile" : ""}`} data-testid="board-experience">
      <div className="canvas-stage" data-testid="hero-3d-canvas">
        <Canvas
          dpr={isMobile ? [1, 1.4] : [1, 1.65]}
          gl={{ antialias: true, toneMappingExposure: 1.12 }}
          shadows={!isMobile}
          camera={cameraConfig}
        >
          <color attach="background" args={["#03060b"]} />
          <fog attach="fog" args={["#08131e", 28, isMobile ? 110 : 125]} />
          <Suspense fallback={null}>
            <HeroScene
              cinematic={cinematic}
              isMobile={isMobile}
              zoomStep={zoomStep}
              hoveredId={hoveredId}
              selectedId={selectedId}
              onHover={setHoveredId}
              onSelect={handleSelect}
              resetTick={resetTick}
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
                onClick={() => { setMobileMenuOpen(false); handleEnterBoardCam(); }}
                data-testid="drawer-get-spot"
              >GET YOUR SPOT ↗</button>
              <div className="drawer-meta">
                {stats.total} SPOTS · {stats.claimed} CLAIMED · FROM ${stats.minPrice}
              </div>
            </div>
          </div>
        )}

        <section className={`hero-copy ${selectedSpot ? "hero-copy--dim" : ""}`} data-testid="hero-copy">
          <p className="eyebrow">DIGITAL TWIN · 04.18.26</p>
          <h1 data-testid="hero-title">THE INTERNET’S<br /><em>BILLBOARD.</em></h1>
          <p className="hero-subtitle" data-testid="hero-subtitle">Put yourself on a real billboard.</p>
          <div className="hero-meta" data-testid="hero-meta">
            {stats.total} SPOTS <b>·</b> {stats.claimed} CLAIMED <b>·</b> {stats.available} AVAILABLE <b>·</b> FROM ${stats.minPrice}
          </div>
          <button className="primary-cta" onClick={handleEnterBoardCam} data-testid="board-cam-button">
            ENTER BOARD CAM <span>↗</span>
          </button>
        </section>

        {/* Hover tooltip — HTML overlay so it reads sharply on mobile too. */}
        {hoveredSpot && !selectedSpot && (
          <div className="hover-badge" data-testid="hover-badge">
            <div className="hb-num">SPOT #{String(hoveredSpot.id).padStart(2, "0")}</div>
            <div className="hb-state">
              {hoveredSpot.claimed ? hoveredSpot.handle : "AVAILABLE"}
            </div>
            {!hoveredSpot.claimed && <div className="hb-price">${hoveredSpot.price}</div>}
            {hoveredSpot.claimed && hoveredSpot.category && (
              <div className="hb-cat">{hoveredSpot.category}</div>
            )}
            <div className="hb-hint">{hoveredSpot.claimed ? "TAP TO INSPECT" : "TAP TO CLAIM"}</div>
          </div>
        )}

        {/* Selected spot detail card */}
        {selectedSpot && (
          <div className="spot-card" data-testid="spot-card">
            <button className="spot-card-close" onClick={handleCloseSpot} data-testid="spot-card-close" aria-label="Close">✕</button>
            <div className="spot-card-tag">SPOT #{String(selectedSpot.id).padStart(2, "0")}</div>
            {selectedSpot.claimed ? (
              <>
                <div className="spot-card-badge" style={{ background: selectedSpot.color }} />
                <h2 className="spot-card-title">{selectedSpot.handle}</h2>
                <p className="spot-card-sub">{selectedSpot.category} · claimed</p>
                <div className="spot-card-row"><span>STATUS</span><b>CLAIMED</b></div>
                <div className="spot-card-row"><span>OWNER</span><b>{selectedSpot.handle}</b></div>
                <button className="spot-card-cta secondary" onClick={handleCloseSpot} data-testid="spot-card-back">
                  BACK TO THE BOARD
                </button>
              </>
            ) : (
              <>
                <div className="spot-card-avail">AVAILABLE</div>
                <div className="spot-card-price">${selectedSpot.price}</div>
                <div className="spot-card-row"><span>STATUS</span><b>OPEN FOR CLAIM</b></div>
                <div className="spot-card-row"><span>POSITION</span><b>ROW {Math.floor((selectedSpot.id - 1) / 6) + 1}, COL {((selectedSpot.id - 1) % 6) + 1}</b></div>
                <button className="spot-card-cta" data-testid="spot-card-claim">
                  CLAIM YOUR SPOT →
                </button>
                <p className="spot-card-note">Checkout unlocks in Phase 5. Demo experience only.</p>
              </>
            )}
          </div>
        )}

        <LiveActivity onFocusSpot={setSelectedId} />

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
            className={!cinematic && selectedId == null ? "selected" : ""}
            onClick={handleEnterBoardCam}
            data-testid="orbit-control"
          >ORBIT</button>
          <button
            className={cinematic && selectedId == null ? "selected" : ""}
            onClick={() => { setSelectedId(null); setCinematic(true); }}
            data-testid="cinematic-control"
          >CINEMATIC</button>
          <button
            className={zoomStep !== 0 ? "selected" : ""}
            onClick={handleZoom}
            data-testid="zoom-control"
          >ZOOM <span>◎</span></button>
          <button className="reset" onClick={handleReset} data-testid="reset-camera-control">RESET</button>
        </div>
        <div className="scroll-cue" data-testid="scroll-cue">SCROLL <span>⌁</span></div>
      </div>
    </main>
  );
}
