import { useGameStore } from "../store/gameStore";
import { Environment } from "./Environment";
import { LocalPlayer } from "./LocalPlayer";
import { RemotePlayer } from "./RemotePlayer";
import { TracerManager } from "./TracerManager";

interface Props {
  isLocked: boolean;
  sendMove: (pos: { x: number; y: number; z: number }, yaw: number, pitch: number) => void;
  sendShoot: (yaw: number, pitch: number) => void;
}

export function Scene({ isLocked, sendMove, sendShoot }: Props) {
  const remotePlayers = useGameStore((s) => s.remotePlayers);

  return (
    <>
      <Environment />
      <LocalPlayer isLocked={isLocked} sendMove={sendMove} sendShoot={sendShoot} />
      {Array.from(remotePlayers.values()).map((player) => (
        <RemotePlayer key={player.id} player={player} />
      ))}
      <TracerManager />
    </>
  );
}
