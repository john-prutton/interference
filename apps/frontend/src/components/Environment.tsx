import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MAP_DATA, type MapRamp } from "../map/mapData";

function RampMesh({ r }: { r: MapRamp }) {
  const slopeAngle = Math.atan2(r.y1 - r.y0, r.length);
  const centerY = (r.y0 + r.y1) / 2;
  const length3d = Math.sqrt(r.length * r.length + (r.y1 - r.y0) ** 2);

  // Rotation: ramps climbing in Z use X-axis rotation; ramps climbing in X use Z-axis rotation.
  // The box geometry's default "length" axis is Y, so we rotate around X or Z to lay it flat.
  let rotX = 0, rotZ = 0;
  if (r.facing === "pz") rotX = -slopeAngle;
  if (r.facing === "nz") rotX = slopeAngle;
  if (r.facing === "px") rotZ = slopeAngle;
  if (r.facing === "nx") rotZ = -slopeAngle;

  return (
    <mesh position={[r.cx, centerY, r.cz]} rotation={[rotX, 0, rotZ]}>
      <boxGeometry args={[
        r.facing === "pz" || r.facing === "nz" ? r.width : length3d,
        0.15,
        r.facing === "px" || r.facing === "nx" ? r.width : length3d,
      ]} />
      <meshStandardMaterial color={r.color} />
    </mesh>
  );
}

export function Environment() {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color("#1a1a2e");
    scene.fog = new THREE.Fog("#1a1a2e", 30, 90);
  }, [scene]);

  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>

      {/* Grid */}
      <gridHelper args={[60, 30, "#555555", "#333333"]} />

      {/* Map boxes */}
      {MAP_DATA.boxes.map((b, i) => (
        <mesh key={i} position={[b.cx, b.cy, b.cz]} castShadow receiveShadow>
          <boxGeometry args={[b.hw * 2, b.hh * 2, b.hd * 2]} />
          <meshStandardMaterial color={b.color} />
        </mesh>
      ))}

      {/* Ramps */}
      {MAP_DATA.ramps.map((r, i) => (
        <RampMesh key={i} r={r} />
      ))}

      {/* Lights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1.0} castShadow />
    </>
  );
}
