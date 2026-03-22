import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { MAP_DATA, getSurfaceHeight, emitTracer } from "../map/mapData";

const MOVE_SPEED = 8.0;
const MOUSE_SENSITIVITY = 0.002;
const PITCH_LIMIT = Math.PI / 2 * 0.9;
const JUMP_VELOCITY = 8.0;
const GRAVITY = 20.0;
const SHOOT_COOLDOWN_MS = 150;
// Player AABB extents for collision (half-width and half-height)
const PLAYER_HW = 0.3;
const PLAYER_HH = 0.8;

interface Props {
  isLocked: boolean;
  sendMove: (pos: { x: number; y: number; z: number }, yaw: number, pitch: number) => void;
  sendShoot: (yaw: number, pitch: number) => void;
}

/** Returns true if the player center (px, py, pz) overlaps the box using Minkowski sum. */
function overlapsBox(px: number, py: number, pz: number, b: (typeof MAP_DATA.boxes)[number]): boolean {
  return (
    px >= b.cx - b.hw - PLAYER_HW && px <= b.cx + b.hw + PLAYER_HW &&
    py >= b.cy - b.hh - PLAYER_HH && py <= b.cy + b.hh + PLAYER_HH &&
    pz >= b.cz - b.hd - PLAYER_HW && pz <= b.cz + b.hd + PLAYER_HW
  );
}

export function useFPSController({ isLocked, sendMove, sendShoot }: Props) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const position = useRef(new THREE.Vector3(0, 1.0, 0));
  const verticalVelocity = useRef(0);
  const lastShotAt = useRef(0);
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      yaw.current -= e.movementX * MOUSE_SENSITIVITY;
      pitch.current -= e.movementY * MOUSE_SENSITIVITY;
      pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current));
    };
    // Clear all held keys when pointer lock is released so keys don't get stuck.
    // Browsers often skip keyup events during pointer lock state transitions.
    const onPointerLockChange = () => {
      if (!document.pointerLockElement) keys.current.clear();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!isLockedRef.current || e.button !== 0) return;
      const now = Date.now();
      if (now - lastShotAt.current < SHOOT_COOLDOWN_MS) return;
      lastShotAt.current = now;
      sendShoot(yaw.current, pitch.current);
      // Emit local tracer immediately (don't wait for server round-trip)
      const cosPitch = Math.cos(pitch.current);
      const dir = {
        x: -Math.sin(yaw.current) * cosPitch,
        y: Math.sin(pitch.current),
        z: -Math.cos(yaw.current) * cosPitch,
      };
      const origin = {
        x: position.current.x,
        y: position.current.y + 0.6,
        z: position.current.z,
      };
      emitTracer(origin, dir);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  }, [sendShoot]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // Apply pending respawn from server (triggered by a hit)
    const { pendingRespawn, setPendingRespawn } = useGameStore.getState();
    if (pendingRespawn) {
      position.current.set(pendingRespawn.x, pendingRespawn.y, pendingRespawn.z);
      verticalVelocity.current = 0;
      setPendingRespawn(null);
    }

    let dx = 0, dz = 0;
    if (isLockedRef.current) {
      const k = keys.current;
      const forward = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
      const right = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);

      if (forward !== 0 || right !== 0) {
        const len = Math.sqrt(forward * forward + right * right);
        const speed = MOVE_SPEED / len;
        const sin = Math.sin(yaw.current);
        const cos = Math.cos(yaw.current);
        dx = (forward * -sin + right * cos) * speed;
        dz = (forward * -cos - right * sin) * speed;
      }
    }

    const px = position.current.x;
    const py = position.current.y;
    const pz = position.current.z;

    // ── Horizontal collision (X and Z resolved independently for wall sliding) ──

    let newX = px + dx * dt;
    for (const b of MAP_DATA.boxes) {
      if (overlapsBox(newX, py, pz, b)) { newX = px; break; }
    }

    let newZ = pz + dz * dt;
    for (const b of MAP_DATA.boxes) {
      if (overlapsBox(newX, py, newZ, b)) { newZ = pz; break; }
    }

    position.current.x = newX;
    position.current.z = newZ;

    // ── Vertical: gravity, surface height, jump ────────────────────────────────

    const surfH = getSurfaceHeight(newX, newZ);
    const effectiveFloor = surfH + 1.0; // player Y when standing on surfH

    // Jump — only when on or very near the floor
    if (isLockedRef.current && keys.current.has("Space") && py <= effectiveFloor + 0.05) {
      verticalVelocity.current = JUMP_VELOCITY;
    }

    verticalVelocity.current -= GRAVITY * dt;
    const newY = py + verticalVelocity.current * dt;

    if (newY <= effectiveFloor) {
      position.current.y = effectiveFloor;
      verticalVelocity.current = 0;
    } else {
      position.current.y = newY;
    }

    // ── Sync camera ────────────────────────────────────────────────────────────
    camera.rotation.order = "YXZ";
    camera.position.set(position.current.x, position.current.y + 0.6, position.current.z);
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    if (isLockedRef.current) {
      const pos = { x: position.current.x, y: position.current.y, z: position.current.z };
      sendMove(pos, yaw.current, pitch.current);
    }
  });
}
