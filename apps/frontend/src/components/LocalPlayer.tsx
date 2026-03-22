import { useFPSController } from "../hooks/useFPSController";

interface Props {
  isLocked: boolean;
  sendMove: (pos: { x: number; y: number; z: number }, yaw: number, pitch: number) => void;
  sendShoot: (yaw: number, pitch: number) => void;
}

export function LocalPlayer({ isLocked, sendMove, sendShoot }: Props) {
  useFPSController({ isLocked, sendMove, sendShoot });
  return null;
}
