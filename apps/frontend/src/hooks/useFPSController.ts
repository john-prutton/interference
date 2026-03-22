import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";

const MOVE_SPEED = 8.0;
const MOUSE_SENSITIVITY = 0.002;
const PITCH_LIMIT = Math.PI / 2 * 0.9;

interface Props {
  isLocked: boolean;
  sendMove: (pos: { x: number; y: number; z: number }, yaw: number, pitch: number) => void;
}

export function useFPSController({ isLocked, sendMove }: Props) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const position = useRef(new THREE.Vector3(0, 1, 0));
  const lastTime = useRef<number | null>(null);
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  const setLocalPosition = useGameStore((s) => s.setLocalPosition);
  const setLocalRotation = useGameStore((s) => s.setLocalRotation);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      yaw.current -= e.movementX * MOUSE_SENSITIVITY;
      pitch.current -= e.movementY * MOUSE_SENSITIVITY;
      pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    if (isLockedRef.current) {
      const k = keys.current;
      const forward = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
      const right = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);

      if (forward !== 0 || right !== 0) {
        const speed = MOVE_SPEED * dt;
        const sin = Math.sin(yaw.current);
        const cos = Math.cos(yaw.current);
        position.current.x += (forward * -sin + right * cos) * speed;
        position.current.z += (forward * -cos - right * sin) * speed;
      }
    }

    // Sync camera
    camera.rotation.order = "YXZ";
    camera.position.set(position.current.x, position.current.y + 0.6, position.current.z);
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    // Sync store
    const pos = { x: position.current.x, y: position.current.y, z: position.current.z };
    setLocalPosition(pos);
    setLocalRotation(yaw.current, pitch.current);
    sendMove(pos, yaw.current, pitch.current);
  });
}
