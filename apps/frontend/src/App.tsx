import { Canvas } from "@react-three/fiber";
import { usePointerLock } from "./hooks/usePointerLock";
import { useWebSocket } from "./hooks/useWebSocket";
import { Scene } from "./components/Scene";
import { HUD } from "./components/HUD";

export default function App() {
  const { isLocked, requestLock } = usePointerLock();
  const { connected, sendMove, sendShoot } = useWebSocket();

  return (
    <>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 1.6, 0] }}
        style={{ width: "100vw", height: "100vh" }}
      >
        <Scene isLocked={isLocked} sendMove={sendMove} sendShoot={sendShoot} />
      </Canvas>
      <HUD isLocked={isLocked} requestLock={requestLock} connected={connected} />
    </>
  );
}
