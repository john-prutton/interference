import type { PlayerState, Vec3 } from "./player";

export interface ClientJoinMessage {
  type: "join";
}

export interface ClientMoveMessage {
  type: "move";
  position: PlayerState["position"];
  yaw: PlayerState["yaw"];
  pitch: PlayerState["pitch"];
}

export interface ClientShootMessage {
  type: "shoot";
  yaw: number;
  pitch: number;
  /** Client's best estimate of server time when the shot was fired (Date.now() + clockOffset). */
  shootTime: number;
}

export interface ClientPingMessage {
  type: "ping";
  clientTime: number;
}

export type ClientMessage =
  | ClientJoinMessage
  | ClientMoveMessage
  | ClientShootMessage
  | ClientPingMessage;

export interface ServerWelcomeMessage {
  type: "welcome";
  yourId: string;
  yourColor: string;
  players: PlayerState[];
}

export interface ServerPlayerJoinedMessage {
  type: "player_joined";
  player: PlayerState;
}

export interface ServerPlayerLeftMessage {
  type: "player_left";
  playerId: string;
}

export interface ServerWorldStateMessage {
  type: "world_state";
  players: PlayerState[];
  serverTime: number;
}

export interface ServerHitMessage {
  type: "hit";
  shooterId: string;
  victimId: string;
  newPosition: Vec3;
}

export interface ServerPongMessage {
  type: "pong";
  clientTime: number;
  serverTime: number;
}

export interface ServerShotFiredMessage {
  type: "shot_fired";
  shooterId: string;
  origin: Vec3;
  direction: Vec3;
}

export type ServerMessage =
  | ServerWelcomeMessage
  | ServerPlayerJoinedMessage
  | ServerPlayerLeftMessage
  | ServerWorldStateMessage
  | ServerHitMessage
  | ServerPongMessage
  | ServerShotFiredMessage;
