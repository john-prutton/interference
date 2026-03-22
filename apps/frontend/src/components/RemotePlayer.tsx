import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerState } from "@interference/domain";

interface Props {
  player: PlayerState;
}

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));

  useFrame(() => {
    if (!groupRef.current) return;
    targetPos.current.set(player.position.x, player.position.y, player.position.z);
    groupRef.current.position.lerp(targetPos.current, 0.3);
    groupRef.current.rotation.y = player.yaw;
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
