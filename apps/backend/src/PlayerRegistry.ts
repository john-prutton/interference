import { v4 as uuidv4 } from "uuid";
import type WebSocket from "ws";
import type { PlayerState, ServerMessage, Vec3 } from "@interference/domain";

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

const SPAWN_POINTS: Vec3[] = [
  { x: 0, y: 1, z: 0 },
  { x: 12, y: 1, z: 12 },
  { x: -12, y: 1, z: 12 },
  { x: 12, y: 1, z: -12 },
  { x: -12, y: 1, z: -12 },
  { x: 18, y: 1, z: 0 },
  { x: -18, y: 1, z: 0 },
  { x: 0, y: 1, z: 18 },
  { x: 0, y: 1, z: -18 },
];

const HISTORY_MAX_AGE_MS = 2000;

interface HistoryEntry {
  serverTime: number;
  position: Vec3;
}

interface PlayerEntry {
  state: PlayerState;
  ws: WebSocket;
  history: HistoryEntry[];
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
    this.players.set(id, { state, ws, history: [] });
    return id;
  }

  remove(id: string): void {
    this.players.delete(id);
  }

  updateState(id: string, partial: Partial<Pick<PlayerState, "position" | "yaw" | "pitch">>): void {
    const entry = this.players.get(id);
    if (!entry) return;
    entry.state = { ...entry.state, ...partial };

    // Record position history for lag compensation
    const now = Date.now();
    entry.history.push({ serverTime: now, position: { ...entry.state.position } });
    // Evict entries older than HISTORY_MAX_AGE_MS
    const cutoff = now - HISTORY_MAX_AGE_MS;
    let i = 0;
    while (i < entry.history.length && (entry.history[i]?.serverTime ?? 0) < cutoff) i++;
    if (i > 0) entry.history.splice(0, i);
  }

  /**
   * Returns the interpolated position of a player at a given server timestamp.
   * Read-only — does not mutate any state.
   */
  getPositionAt(id: string, targetServerTime: number): Vec3 | undefined {
    const entry = this.players.get(id);
    if (!entry) return undefined;
    const h = entry.history;
    if (h.length === 0) return { ...entry.state.position };
    if (targetServerTime <= (h[0]?.serverTime ?? 0)) return { ...h[0]?.position } as Vec3;
    if (targetServerTime >= (h[h.length - 1]?.serverTime ?? 0)) return { ...entry.state.position };

    // Binary search for the bracketing pair
    let lo = 0, hi = h.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((h[mid]?.serverTime ?? 0) <= targetServerTime) lo = mid;
      else hi = mid;
    }
    const a = h[lo]!, b = h[hi]!;
    const t = (targetServerTime - a.serverTime) / (b.serverTime - a.serverTime);
    return {
      x: a.position.x + (b.position.x - a.position.x) * t,
      y: a.position.y + (b.position.y - a.position.y) * t,
      z: a.position.z + (b.position.z - a.position.z) * t,
    };
  }

  respawnPlayer(id: string): Vec3 | undefined {
    const entry = this.players.get(id);
    if (!entry) return undefined;
    const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]!;
    // Mutate position directly — intentionally NOT recorded in history so in-flight
    // shots still test against pre-respawn positions.
    entry.state = { ...entry.state, position: { ...spawn } };
    return spawn;
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
