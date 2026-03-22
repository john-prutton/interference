import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@interference/domain";
import { snapshotPushers, type PositionSnapshot } from "../store/gameStore";
import { clockOffsetRef } from "../hooks/useWebSocket";

const RENDER_DELAY_MS = 100;
const BUFFER_CAPACITY = 64;

interface Props {
  player: PlayerState;
}

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const bufferRef = useRef<PositionSnapshot[]>([]);

  // Register a snapshot push callback for this player id.
  // useWebSocket calls snapshotPushers.get(id) on every world_state.
  useEffect(() => {
    const push = (snap: PositionSnapshot) => {
      const buf = bufferRef.current;
      buf.push(snap);
      if (buf.length > BUFFER_CAPACITY) buf.shift();
    };
    snapshotPushers.set(player.id, push);
    return () => { snapshotPushers.delete(player.id); };
  }, [player.id]);

  useFrame(() => {
    if (!groupRef.current) return;
    const buf = bufferRef.current;

    // Before the buffer has any snapshots, fall back to the prop position
    if (buf.length === 0) {
      groupRef.current.position.set(player.position.x, player.position.y, player.position.z);
      groupRef.current.rotation.y = player.yaw;
      return;
    }

    const renderTime = Date.now() + clockOffsetRef.current - RENDER_DELAY_MS;
    const first = buf[0]!;
    const last = buf[buf.length - 1]!;

    // Render time is before (or at) the oldest snapshot — clamp to oldest
    if (renderTime <= first.serverTime) {
      groupRef.current.position.set(first.position.x, first.position.y, first.position.z);
      groupRef.current.rotation.y = first.yaw;
      return;
    }

    // Render time is at or past the newest snapshot — clamp to newest
    if (renderTime >= last.serverTime) {
      groupRef.current.position.set(last.position.x, last.position.y, last.position.z);
      groupRef.current.rotation.y = last.yaw;
      return;
    }

    // Binary search for the two snapshots bracketing renderTime
    let lo = 0, hi = buf.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((buf[mid]?.serverTime ?? 0) <= renderTime) lo = mid;
      else hi = mid;
    }
    const a = buf[lo]!, b = buf[hi]!;
    const t = (renderTime - a.serverTime) / (b.serverTime - a.serverTime);

    groupRef.current.position.set(
      a.position.x + (b.position.x - a.position.x) * t,
      a.position.y + (b.position.y - a.position.y) * t,
      a.position.z + (b.position.z - a.position.z) * t,
    );
    groupRef.current.rotation.y = a.yaw + (b.yaw - a.yaw) * t;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 1.6, 0.6]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      {/* Eye indicator (front face) */}
      <mesh position={[0, 1.1, -0.28]}>
        <boxGeometry args={[0.25, 0.15, 0.05]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  );
}
