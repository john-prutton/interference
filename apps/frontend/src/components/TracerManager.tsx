import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { onTracer, type TracerEvent } from "../map/mapData";

const TRACER_LIFETIME_MS = 150;
const TRACER_LENGTH = 80;
const POOL_SIZE = 20;

// Reusable objects to avoid per-frame allocations
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _mid = new THREE.Vector3();

interface TracerSlot {
  mesh: THREE.Mesh;
  event: TracerEvent | null;
}

export function TracerManager() {
  const poolRef = useRef<TracerSlot[]>([]);
  const pendingRef = useRef<TracerEvent[]>([]);

  // Build the pool imperatively — avoids R3F reconciler overhead on 60fps path
  useEffect(() => {
    const geo = new THREE.CylinderGeometry(0.04, 0.04, TRACER_LENGTH, 4);
    const slots: TracerSlot[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      slots.push({ mesh, event: null });
    }
    poolRef.current = slots;

    const unsub = onTracer((e) => pendingRef.current.push(e));
    return () => {
      unsub();
      geo.dispose();
      for (const s of slots) (s.mesh.material as THREE.Material).dispose();
    };
  }, []);

  useFrame(({ scene }) => {
    const slots = poolRef.current;
    const now = performance.now();

    // Assign pending events to free slots
    while (pendingRef.current.length > 0) {
      const e = pendingRef.current.shift()!;
      const free = slots.find((s) => s.event === null);
      if (!free) break; // pool exhausted — drop oldest would be better but rare
      free.event = e;
      free.mesh.visible = true;
      if (!free.mesh.parent) scene.add(free.mesh);

      // Orient mesh: cylinder default axis is Y; rotate to align with shot direction
      _dir.set(e.direction.x, e.direction.y, e.direction.z).normalize();
      if (Math.abs(_dir.dot(_up)) < 0.999) {
        _quat.setFromUnitVectors(_up, _dir);
      } else {
        _quat.set(0, 0, 0, 1); // already aligned or anti-aligned
      }
      free.mesh.quaternion.copy(_quat);

      // Position at midpoint of the tracer line
      _mid.set(
        e.origin.x + e.direction.x * (TRACER_LENGTH / 2),
        e.origin.y + e.direction.y * (TRACER_LENGTH / 2),
        e.origin.z + e.direction.z * (TRACER_LENGTH / 2),
      );
      free.mesh.position.copy(_mid);
    }

    // Update opacity / deactivate expired tracers
    for (const slot of slots) {
      if (!slot.event) continue;
      const age = now - slot.event.startTime;
      if (age >= TRACER_LIFETIME_MS) {
        slot.event = null;
        slot.mesh.visible = false;
        (slot.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
      } else {
        (slot.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - age / TRACER_LIFETIME_MS;
      }
    }
  });

  // Nothing to render via JSX — all meshes are added imperatively
  return null;
}
