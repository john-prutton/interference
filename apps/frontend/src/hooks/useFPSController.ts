import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const MOVE_SPEED = 8.0;
const MOUSE_SENSITIVITY = 0.002;
const PITCH_LIMIT = Math.PI / 2 * 0.9;
const JUMP_VELOCITY = 8.0;
const GRAVITY = 20.0;
const GROUND_Y = 1.0;

interface Props {
  isLocked: boolean;
  sendMove: (pos: { x: number; y: number; z: number }, yaw: number, pitch: number) => void;
}

export function useFPSController({ isLocked, sendMove }: Props) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const position = useRef(new THREE.Vector3(0, GROUND_Y, 0));
  const verticalVelocity = useRef(0);
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

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    if (isLockedRef.current) {
      const k = keys.current;
      const forward = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
      const right = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);

      if (forward !== 0 || right !== 0) {
        // Normalize so diagonal movement isn't faster
        const len = Math.sqrt(forward * forward + right * right);
        const speed = MOVE_SPEED * dt / len;
        const sin = Math.sin(yaw.current);
        const cos = Math.cos(yaw.current);
        position.current.x += (forward * -sin + right * cos) * speed;
        position.current.z += (forward * -cos - right * sin) * speed;
      }

      // Jump — only when on the ground
      if (k.has("Space") && position.current.y <= GROUND_Y) {
        verticalVelocity.current = JUMP_VELOCITY;
      }
    }

    // Gravity (always active so the player falls even if pointer lock drops mid-jump)
    verticalVelocity.current -= GRAVITY * dt;
    position.current.y += verticalVelocity.current * dt;
    if (position.current.y <= GROUND_Y) {
      position.current.y = GROUND_Y;
      verticalVelocity.current = 0;
    }

    // Sync camera
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
