import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export function Environment() {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color("#1a1a2e");
    scene.fog = new THREE.Fog("#1a1a2e", 20, 80);
  }, [scene]);

  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>

      {/* Grid */}
      <gridHelper args={[100, 50, "#555555", "#333333"]} />

      {/* Obstacle boxes */}
      <mesh position={[5, 1, -5]} castShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#5a3010" />
      </mesh>
      <mesh position={[-8, 1.5, 3]} castShadow>
        <boxGeometry args={[3, 3, 3]} />
        <meshStandardMaterial color="#505050" />
      </mesh>
      <mesh position={[0, 1, -15]} castShadow>
        <boxGeometry args={[6, 2, 1]} />
        <meshStandardMaterial color="#404060" />
      </mesh>

      {/* Lights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1.0} castShadow />
    </>
  );
}
