import type { Vec3 } from "@interference/domain";

// ── Geometry types ────────────────────────────────────────────────────────────

export interface MapBox {
  cx: number; cy: number; cz: number; // center
  hw: number; hh: number; hd: number; // half-extents
  color: string;
}

export interface MapRamp {
  cx: number; cz: number;                        // center of footprint (XZ)
  facing: "px" | "nx" | "pz" | "nz";            // direction the ramp climbs toward
  width: number;                                  // extent perpendicular to climb
  length: number;                                 // horizontal run of slope
  y0: number; y1: number;                        // surface height at low / high end
  color: string;
}

export interface MapData {
  boxes: MapBox[];
  ramps: MapRamp[];
}

// ── "Crossroads" arena (60×60) ────────────────────────────────────────────────

export const MAP_DATA: MapData = {
  boxes: [
    // Central raised platform (top at Y=1.5)
    { cx: 0,   cy: 0.75, cz: 0,   hw: 7,   hh: 0.75, hd: 7,   color: "#4a4a5a" },

    // Mid-field cover walls
    { cx: 0,   cy: 0.75, cz: -18, hw: 3.0, hh: 0.75, hd: 0.4, color: "#404050" },
    { cx: 0,   cy: 0.75, cz:  18, hw: 3.0, hh: 0.75, hd: 0.4, color: "#404050" },
    { cx:  18, cy: 0.75, cz: 0,   hw: 0.4, hh: 0.75, hd: 3.0, color: "#404050" },
    { cx: -18, cy: 0.75, cz: 0,   hw: 0.4, hh: 0.75, hd: 3.0, color: "#404050" },

    // NE corner bunker
    { cx:  22, cy: 1.0, cz: -21, hw: 0.5, hh: 1.0, hd: 3.0, color: "#5a4030" },
    { cx:  20, cy: 1.0, cz: -24, hw: 2.0, hh: 1.0, hd: 0.5, color: "#5a4030" },
    // NW corner bunker
    { cx: -22, cy: 1.0, cz: -21, hw: 0.5, hh: 1.0, hd: 3.0, color: "#5a4030" },
    { cx: -20, cy: 1.0, cz: -24, hw: 2.0, hh: 1.0, hd: 0.5, color: "#5a4030" },
    // SE corner bunker
    { cx:  22, cy: 1.0, cz:  21, hw: 0.5, hh: 1.0, hd: 3.0, color: "#5a4030" },
    { cx:  20, cy: 1.0, cz:  24, hw: 2.0, hh: 1.0, hd: 0.5, color: "#5a4030" },
    // SW corner bunker
    { cx: -22, cy: 1.0, cz:  21, hw: 0.5, hh: 1.0, hd: 3.0, color: "#5a4030" },
    { cx: -20, cy: 1.0, cz:  24, hw: 2.0, hh: 1.0, hd: 0.5, color: "#5a4030" },
  ],
  ramps: [
    // North ramp: footprint Z ∈ [-13, -7], high end at Z=-7 (platform edge)
    { cx: 0,   cz: -10, facing: "nz", width: 4, length: 6, y0: 0, y1: 1.5, color: "#555566" },
    // South ramp: footprint Z ∈ [7, 13], high end at Z=7
    { cx: 0,   cz:  10, facing: "pz", width: 4, length: 6, y0: 0, y1: 1.5, color: "#555566" },
    // East ramp: footprint X ∈ [7, 13], high end at X=7
    { cx:  10, cz: 0,   facing: "px", width: 4, length: 6, y0: 0, y1: 1.5, color: "#555566" },
    // West ramp: footprint X ∈ [-13, -7], high end at X=-7
    { cx: -10, cz: 0,   facing: "nx", width: 4, length: 6, y0: 0, y1: 1.5, color: "#555566" },
  ],
};

// ── Collision helpers ─────────────────────────────────────────────────────────

/**
 * Returns the surface Y height directly below (px, pz), considering all boxes
 * and ramps. Player's effective floor = getSurfaceHeight(px, pz) + 1.0
 */
export function getSurfaceHeight(px: number, pz: number): number {
  let h = 0; // base floor at Y=0

  for (const b of MAP_DATA.boxes) {
    if (
      px >= b.cx - b.hw && px <= b.cx + b.hw &&
      pz >= b.cz - b.hd && pz <= b.cz + b.hd
    ) {
      h = Math.max(h, b.cy + b.hh);
    }
  }

  for (const r of MAP_DATA.ramps) {
    const rampHeight = getRampSurfaceHeight(px, pz, r);
    if (rampHeight !== null) {
      h = Math.max(h, rampHeight);
    }
  }

  return h;
}

/** Returns the ramp surface height at (px, pz), or null if outside the footprint. */
export function getRampSurfaceHeight(px: number, pz: number, r: MapRamp): number | null {
  const hw = r.facing === "px" || r.facing === "nx" ? r.length / 2 : r.width / 2;
  const hd = r.facing === "pz" || r.facing === "nz" ? r.length / 2 : r.width / 2;

  if (px < r.cx - hw || px > r.cx + hw || pz < r.cz - hd || pz > r.cz + hd) return null;

  // t = 0 at low end, 1 at high end
  let t: number;
  switch (r.facing) {
    case "px": // climbs toward +X; high end at cx + length/2
      t = (px - (r.cx - hw)) / r.length;
      break;
    case "nx": // climbs toward -X; high end at cx - length/2
      t = ((r.cx + hw) - px) / r.length;
      break;
    case "pz": // climbs toward +Z; high end at cz + length/2
      t = (pz - (r.cz - hd)) / r.length;
      break;
    case "nz": // climbs toward -Z; high end at cz - length/2
      t = ((r.cz + hd) - pz) / r.length;
      break;
  }

  return r.y0 + (r.y1 - r.y0) * Math.min(1, Math.max(0, t));
}

// ── Tracer pub/sub (module-level, no React/Zustand) ───────────────────────────

export interface TracerEvent {
  origin: Vec3;
  direction: Vec3;
  startTime: number; // performance.now()
}

type TracerListener = (e: TracerEvent) => void;
const tracerListeners: TracerListener[] = [];

export function onTracer(fn: TracerListener): () => void {
  tracerListeners.push(fn);
  return () => {
    const i = tracerListeners.indexOf(fn);
    if (i !== -1) tracerListeners.splice(i, 1);
  };
}

export function emitTracer(origin: Vec3, direction: Vec3): void {
  const e: TracerEvent = { origin, direction, startTime: performance.now() };
  for (const fn of tracerListeners) fn(e);
}
