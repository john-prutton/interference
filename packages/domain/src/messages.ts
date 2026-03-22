import type { PlayerState } from "./player";

export interface ClientJoinMessage {
  type: "join";
}

export interface ClientMoveMessage {
  type: "move";
  position: PlayerState["position"];
  yaw: PlayerState["yaw"];
  pitch: PlayerState["pitch"];
}

export type ClientMessage = ClientJoinMessage | ClientMoveMessage;

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
}

export type ServerMessage =
  | ServerWelcomeMessage
  | ServerPlayerJoinedMessage
  | ServerPlayerLeftMessage
  | ServerWorldStateMessage;
