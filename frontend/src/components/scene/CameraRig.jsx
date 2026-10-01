import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BILLBOARD_Z, PANEL_W, panelWorld } from "./layout";

const canHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/**
 * Camera director. Every mode produces a (position, lookAt) goal; the camera is
 * critically damped toward it, so mode switches, orientation changes and panel
 * focus are always continuous — no jumps, no fighting with OrbitControls (which
 * is only mounted while the user is actually orbiting).
 */
export function CameraRig({ layout, cameraMode, zoomStep, selectedIndex, resetTick, reducedMotion, ready }) {
  const camera = useThree((s) => s.camera);
  const look = useRef(new THREE.Vector3(...layout.cam.look));
  const goal = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), v: new THREE.Vector3() }), []);
  const clock = useRef(0);
  const wasOrbiting = useRef(false);
  const intro = useRef(reducedMotion ? 10 : 0); // seconds since the scene was revealed
  const orbiting = cameraMode === "orbit" && selectedIndex < 0;

  useEffect(() => {
    clock.current = 0;
  }, [cameraMode, resetTick]);

  // Lens follows the layout (portrait needs a wider lens to hold the board).
  useEffect(() => {
    camera.fov = layout.fov;
    camera.near = 0.25;
    camera.far = 1600;
    camera.updateProjectionMatrix();
  }, [camera, layout.fov]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    clock.current += delta;
    const t = clock.current;
    const motion = reducedMotion ? 0 : 1;
    let lambda = 2.6;

    // Establishing shot: hold high and wide until the scene is revealed, then
    // crane down into the chase position with a slow ease.
    if (!ready && intro.current < 10) {
      camera.position.set(layout.cam.pos[0], layout.cam.pos[1] + 7, layout.cam.pos[2] + 16);
      look.current.set(0, layout.bb.y, -28);
      camera.lookAt(look.current);
      return;
    }
    intro.current += delta;

    if (selectedIndex >= 0) {
      // Frame the chosen panel, leaving room for the inspector card.
      const [px, py, pz] = panelWorld(selectedIndex, layout);
      const vfov = THREE.MathUtils.degToRad(camera.fov);
      const tanH = Math.tan(vfov / 2) * camera.aspect;
      const dist = (PANEL_W * layout.bb.s) / 2 / (tanH * layout.focusFill);
      goal.pos.set(px * 0.72, py - dist * 0.08, pz + dist);
      goal.look.set(
        px + layout.focusShift[0] * dist * tanH,
        py + layout.focusShift[1] * dist * Math.tan(vfov / 2),
        pz
      );
      lambda = 2.2;
    } else if (orbiting) {
      wasOrbiting.current = true;
      return; // OrbitControls owns the camera
    } else if (cameraMode === "sweep") {
      // Slow crane arc in front of the board, like a drone establishing shot.
      const a = Math.sin(t * 0.16) * 0.95;
      const r = layout.sweep.radius + 10;
      goal.pos.set(Math.sin(a) * r, layout.sweep.y + Math.sin(t * 0.23) * 1.4 + 1.2, BILLBOARD_Z + Math.cos(a) * r);
      goal.look.set(0, layout.sweep.lookY, BILLBOARD_Z);
      lambda = 1.6;
    } else {
      // Cinematic chase: locked behind the car with a breathing handheld drift.
      const [cx, cy, cz] = layout.cam.pos;
      const [lx, ly, lz] = layout.cam.look;
      goal.pos.set(
        cx + Math.sin(t * 0.21) * 0.12 * motion,
        cy + Math.sin(t * 0.33) * 0.05 * motion,
        cz
      );
      goal.look.set(lx + Math.sin(t * 0.17) * 0.2 * motion, ly, lz);

      // Subtle parallax toward the pointer on desktop.
      if (canHover && motion) {
        goal.pos.x += state.pointer.x * 0.55;
        goal.pos.y += state.pointer.y * 0.22;
      }
      // Zoom: 1 = push in toward the board, 2 = pull wide.
      if (zoomStep) {
        goal.v.subVectors(goal.look, goal.pos);
        const k = zoomStep === 1 ? 0.3 : -0.22;
        goal.pos.addScaledVector(goal.v.normalize(), k * (lz < 0 ? Math.abs(cz - lz) : 20));
        if (zoomStep === 1) goal.pos.y += 0.9;
      }
    }

    if (intro.current < 4) lambda = Math.min(lambda, 0.6 + intro.current * 0.55);

    if (wasOrbiting.current) {
      // Resume from wherever the user left the camera, without a snap.
      wasOrbiting.current = false;
      camera.getWorldDirection(goal.v);
      look.current.copy(camera.position).addScaledVector(goal.v, camera.position.distanceTo(goal.look));
    }

    camera.position.x = THREE.MathUtils.damp(camera.position.x, goal.pos.x, lambda, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, goal.pos.y, lambda, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, goal.pos.z, lambda, delta);
    look.current.x = THREE.MathUtils.damp(look.current.x, goal.look.x, lambda, delta);
    look.current.y = THREE.MathUtils.damp(look.current.y, goal.look.y, lambda, delta);
    look.current.z = THREE.MathUtils.damp(look.current.z, goal.look.z, lambda, delta);
    camera.lookAt(look.current);
  });

  if (!orbiting) return null;
  return (
    <OrbitControls
      makeDefault={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={canHover ? 0.7 : 0.55}
      zoomSpeed={0.7}
      minDistance={layout.orbit.min}
      maxDistance={layout.orbit.max}
      minPolarAngle={0.9}
      maxPolarAngle={1.9}
      minAzimuthAngle={-1.15}
      maxAzimuthAngle={1.15}
      target={layout.orbit.target}
      onChange={(e) => {
        // keep the camera above the tarmac at any polar angle / distance
        const cam = e?.target?.object;
        if (cam && cam.position.y < 1.1) cam.position.y = 1.1;
      }}
    />
  );
}
