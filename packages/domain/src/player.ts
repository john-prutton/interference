import { Schema } from "effect";

export const Vec3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
});
export type Vec3 = Schema.Schema.Type<typeof Vec3Schema>;

export const PlayerStateSchema = Schema.Struct({
  id: Schema.String,
  position: Vec3Schema,
  yaw: Schema.Number,
  pitch: Schema.Number,
  color: Schema.String,
  hp: Schema.Number,
  kills: Schema.Number,
  deaths: Schema.Number,
});
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>;
