import { Schema } from "effect";
import { Vec3Schema, PlayerStateSchema } from "./player.js";

// ── Client messages ───────────────────────────────────────────────────────────

const ClientJoinSchema = Schema.Struct({
  type: Schema.Literal("join"),
});

const ClientMoveSchema = Schema.Struct({
  type: Schema.Literal("move"),
  position: Vec3Schema,
  yaw: Schema.Number,
  pitch: Schema.Number,
});

const ClientShootSchema = Schema.Struct({
  type: Schema.Literal("shoot"),
  yaw: Schema.Number,
  pitch: Schema.Number,
  /** Client's best estimate of server time when the shot was fired (Date.now() + clockOffset). */
  shootTime: Schema.Number,
});

const ClientPingSchema = Schema.Struct({
  type: Schema.Literal("ping"),
  clientTime: Schema.Number,
});

export const ClientMessageSchema = Schema.Union(
  ClientJoinSchema,
  ClientMoveSchema,
  ClientShootSchema,
  ClientPingSchema,
);
export type ClientMessage = Schema.Schema.Type<typeof ClientMessageSchema>;

export type ClientJoinMessage = Schema.Schema.Type<typeof ClientJoinSchema>;
export type ClientMoveMessage = Schema.Schema.Type<typeof ClientMoveSchema>;
export type ClientShootMessage = Schema.Schema.Type<typeof ClientShootSchema>;
export type ClientPingMessage = Schema.Schema.Type<typeof ClientPingSchema>;

// ── Server messages ───────────────────────────────────────────────────────────

const ServerWelcomeSchema = Schema.Struct({
  type: Schema.Literal("welcome"),
  yourId: Schema.String,
  yourColor: Schema.String,
  players: Schema.Array(PlayerStateSchema),
});

const ServerPlayerJoinedSchema = Schema.Struct({
  type: Schema.Literal("player_joined"),
  player: PlayerStateSchema,
});

const ServerPlayerLeftSchema = Schema.Struct({
  type: Schema.Literal("player_left"),
  playerId: Schema.String,
});

const ServerWorldStateSchema = Schema.Struct({
  type: Schema.Literal("world_state"),
  players: Schema.Array(PlayerStateSchema),
  serverTime: Schema.Number,
});

const ServerHitSchema = Schema.Struct({
  type: Schema.Literal("hit"),
  shooterId: Schema.String,
  victimId: Schema.String,
  newPosition: Vec3Schema,
});

const ServerPongSchema = Schema.Struct({
  type: Schema.Literal("pong"),
  clientTime: Schema.Number,
  serverTime: Schema.Number,
});

const ServerShotFiredSchema = Schema.Struct({
  type: Schema.Literal("shot_fired"),
  shooterId: Schema.String,
  origin: Vec3Schema,
  direction: Vec3Schema,
});

const ServerDamagedSchema = Schema.Struct({
  type: Schema.Literal("damaged"),
  shooterId: Schema.String,
  victimId: Schema.String,
  damage: Schema.Number,
});

const ServerMatchEndSchema = Schema.Struct({
  type: Schema.Literal("match_end"),
  winnerId: Schema.String,
  winnerKills: Schema.Number,
});

export const ServerMessageSchema = Schema.Union(
  ServerWelcomeSchema,
  ServerPlayerJoinedSchema,
  ServerPlayerLeftSchema,
  ServerWorldStateSchema,
  ServerHitSchema,
  ServerPongSchema,
  ServerShotFiredSchema,
  ServerDamagedSchema,
  ServerMatchEndSchema,
);
export type ServerMessage = Schema.Schema.Type<typeof ServerMessageSchema>;

export type ServerWelcomeMessage = Schema.Schema.Type<typeof ServerWelcomeSchema>;
export type ServerPlayerJoinedMessage = Schema.Schema.Type<typeof ServerPlayerJoinedSchema>;
export type ServerPlayerLeftMessage = Schema.Schema.Type<typeof ServerPlayerLeftSchema>;
export type ServerWorldStateMessage = Schema.Schema.Type<typeof ServerWorldStateSchema>;
export type ServerHitMessage = Schema.Schema.Type<typeof ServerHitSchema>;
export type ServerPongMessage = Schema.Schema.Type<typeof ServerPongSchema>;
export type ServerShotFiredMessage = Schema.Schema.Type<typeof ServerShotFiredSchema>;
export type ServerDamagedMessage = Schema.Schema.Type<typeof ServerDamagedSchema>;
export type ServerMatchEndMessage = Schema.Schema.Type<typeof ServerMatchEndSchema>;

// ── Decoders ──────────────────────────────────────────────────────────────────

export const decodeClientMessage = Schema.decodeUnknown(ClientMessageSchema);
export const decodeServerMessage = Schema.decodeUnknown(ServerMessageSchema);
