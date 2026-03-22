import { v4 as uuidv4 } from "uuid";
import type WebSocket from "ws";
import type { PlayerState, ServerMessage } from "@interference/domain";

const PLAYER_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#e91e63",
];

interface PlayerEntry {
  state: PlayerState;
  ws: WebSocket;
}

export class PlayerRegistry {
  private players = new Map<string, PlayerEntry>();

  add(ws: WebSocket): string {
    const id = uuidv4();
    const color = PLAYER_COLORS[this.players.size % PLAYER_COLORS.length] ?? "#ffffff";
    const state: PlayerState = {
      id,
      position: { x: 0, y: 1, z: 0 },
      yaw: 0,
      pitch: 0,
      color,
    };
    this.players.set(id, { state, ws });
    return id;
  }

  remove(id: string): void {
    this.players.delete(id);
  }

  updateState(id: string, partial: Partial<Pick<PlayerState, "position" | "yaw" | "pitch">>): void {
    const entry = this.players.get(id);
    if (!entry) return;
    entry.state = { ...entry.state, ...partial };
  }

  getAll(): PlayerState[] {
    return Array.from(this.players.values()).map((e) => e.state);
  }

  getState(id: string): PlayerState | undefined {
    return this.players.get(id)?.state;
  }

  broadcast(message: ServerMessage, excludeId?: string): void {
    const data = JSON.stringify(message);
    for (const [id, entry] of this.players) {
      if (id === excludeId) continue;
      if (entry.ws.readyState === 1 /* OPEN */) {
        entry.ws.send(data);
      }
    }
  }

  sendTo(id: string, message: ServerMessage): void {
    const entry = this.players.get(id);
    if (entry && entry.ws.readyState === 1) {
      entry.ws.send(JSON.stringify(message));
    }
  }
}
