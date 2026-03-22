export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  position: Vec3;
  yaw: number;
  pitch: number;
  color: string;
}
