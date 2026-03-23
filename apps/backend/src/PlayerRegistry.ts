import { Context, Effect, Layer, Option, Ref } from "effect";
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
  { x: 15,  y: 1, z: 15  },
  { x: -15, y: 1, z: 15  },
  { x: 15,  y: 1, z: -15 },
  { x: -15, y: 1, z: -15 },
  { x: 24,  y: 1, z: 0   },
  { x: -24, y: 1, z: 0   },
  { x: 0,   y: 1, z: 24  },
  { x: 0,   y: 1, z: -24 },
  { x: 0,   y: 3, z: 0   },
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

export interface PlayerRegistryService {
  readonly add: (ws: WebSocket) => Effect.Effect<string>;
  readonly remove: (id: string) => Effect.Effect<void>;
  readonly updateState: (
    id: string,
    partial: Partial<Pick<PlayerState, "position" | "yaw" | "pitch">>,
  ) => Effect.Effect<void>;
  readonly getPositionAt: (id: string, targetServerTime: number) => Effect.Effect<Option.Option<Vec3>>;
  readonly damagePlayer: (id: string, amount: number) => Effect.Effect<boolean>;
  readonly addKill: (id: string) => Effect.Effect<void>;
  readonly respawnPlayer: (id: string) => Effect.Effect<Option.Option<Vec3>>;
  readonly resetMatch: () => Effect.Effect<void>;
  readonly getAll: () => Effect.Effect<readonly PlayerState[]>;
  readonly getState: (id: string) => Effect.Effect<Option.Option<PlayerState>>;
  readonly broadcast: (message: ServerMessage, excludeId?: string) => Effect.Effect<void>;
  readonly sendTo: (id: string, message: ServerMessage) => Effect.Effect<void>;
}

export class PlayerRegistry extends Context.Tag("PlayerRegistry")<
  PlayerRegistry,
  PlayerRegistryService
>() {}

export const PlayerRegistryLive = Layer.effect(
  PlayerRegistry,
  Effect.gen(function* () {
    const playersRef = yield* Ref.make(new Map<string, PlayerEntry>());

    const add = (ws: WebSocket): Effect.Effect<string> =>
      Ref.modify(playersRef, (players) => {
        const id = uuidv4();
        const color = PLAYER_COLORS[players.size % PLAYER_COLORS.length] ?? "#ffffff";
        const state: PlayerState = {
          id,
          position: { x: 0, y: 1, z: 0 },
          yaw: 0,
          pitch: 0,
          color,
          hp: 100,
          kills: 0,
          deaths: 0,
        };
        const updated = new Map(players);
        updated.set(id, { state, ws, history: [] });
        return [id, updated] as const;
      });

    const remove = (id: string): Effect.Effect<void> =>
      Ref.update(playersRef, (players) => {
        const updated = new Map(players);
        updated.delete(id);
        return updated;
      });

    const updateState = (
      id: string,
      partial: Partial<Pick<PlayerState, "position" | "yaw" | "pitch">>,
    ): Effect.Effect<void> =>
      Ref.update(playersRef, (players) => {
        const entry = players.get(id);
        if (!entry) return players;
        const now = Date.now();
        const newHistory = [...entry.history, { serverTime: now, position: { ...entry.state.position } }];
        const cutoff = now - HISTORY_MAX_AGE_MS;
        const trimmed = newHistory.filter((h) => h.serverTime >= cutoff);
        const updated = new Map(players);
        updated.set(id, {
          ...entry,
          state: { ...entry.state, ...partial },
          history: trimmed,
        });
        return updated;
      });

    const getPositionAt = (id: string, targetServerTime: number): Effect.Effect<Option.Option<Vec3>> =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => {
          const entry = players.get(id);
          if (!entry) return Option.none<Vec3>();
          const h = entry.history;
          if (h.length === 0) return Option.some({ ...entry.state.position });
          if (targetServerTime <= (h[0]?.serverTime ?? 0)) return Option.fromNullable(h[0] ? { ...h[0].position } : undefined);
          if (targetServerTime >= (h[h.length - 1]?.serverTime ?? 0)) return Option.some({ ...entry.state.position });

          // Binary search for the bracketing pair
          let lo = 0, hi = h.length - 1;
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if ((h[mid]?.serverTime ?? 0) <= targetServerTime) lo = mid;
            else hi = mid;
          }
          const a = h[lo];
          const b = h[hi];
          if (!a || !b) return Option.some({ ...entry.state.position });
          const t = (targetServerTime - a.serverTime) / (b.serverTime - a.serverTime);
          return Option.some({
            x: a.position.x + (b.position.x - a.position.x) * t,
            y: a.position.y + (b.position.y - a.position.y) * t,
            z: a.position.z + (b.position.z - a.position.z) * t,
          });
        }),
      );

    const damagePlayer = (id: string, amount: number): Effect.Effect<boolean> =>
      Ref.modify(playersRef, (players) => {
        const entry = players.get(id);
        if (!entry) return [false, players] as const;
        const newHp = Math.max(0, entry.state.hp - amount);
        const updated = new Map(players);
        updated.set(id, { ...entry, state: { ...entry.state, hp: newHp } });
        return [newHp === 0, updated] as const;
      });

    const addKill = (id: string): Effect.Effect<void> =>
      Ref.update(playersRef, (players) => {
        const entry = players.get(id);
        if (!entry) return players;
        const updated = new Map(players);
        updated.set(id, { ...entry, state: { ...entry.state, kills: entry.state.kills + 1 } });
        return updated;
      });

    const respawnPlayer = (id: string): Effect.Effect<Option.Option<Vec3>> =>
      Ref.modify(playersRef, (players) => {
        const entry = players.get(id);
        if (!entry) return [Option.none<Vec3>(), players] as const;
        const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]!;
        const updated = new Map(players);
        updated.set(id, {
          ...entry,
          state: { ...entry.state, position: { ...spawn }, hp: 100, deaths: entry.state.deaths + 1 },
        });
        return [Option.some(spawn), updated] as const;
      });

    const resetMatch = (): Effect.Effect<void> =>
      Ref.update(playersRef, (players) => {
        const updated = new Map(players);
        for (const [id, entry] of players) {
          const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]!;
          updated.set(id, {
            ...entry,
            state: { ...entry.state, hp: 100, kills: 0, deaths: 0, position: { ...spawn } },
            history: [],
          });
        }
        return updated;
      });

    const getAll = (): Effect.Effect<readonly PlayerState[]> =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => Array.from(players.values()).map((e) => e.state)),
      );

    const getState = (id: string): Effect.Effect<Option.Option<PlayerState>> =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => Option.fromNullable(players.get(id)?.state)),
      );

    const broadcast = (message: ServerMessage, excludeId?: string): Effect.Effect<void> =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => {
          const data = JSON.stringify(message);
          for (const [id, entry] of players) {
            if (id === excludeId) continue;
            if (entry.ws.readyState === 1 /* OPEN */) {
              entry.ws.send(data);
            }
          }
        }),
      );

    const sendTo = (id: string, message: ServerMessage): Effect.Effect<void> =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => {
          const entry = players.get(id);
          if (entry && entry.ws.readyState === 1) {
            entry.ws.send(JSON.stringify(message));
          }
        }),
      );

    return { add, remove, updateState, getPositionAt, damagePlayer, addKill, respawnPlayer, resetMatch, getAll, getState, broadcast, sendTo };
  }),
);
