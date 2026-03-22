import { create } from "zustand";
import type { PlayerState, Vec3 } from "@interference/domain";

// Module-level (not in Zustand) — avoids React re-renders on the 60fps hot path.
export interface PositionSnapshot {
  serverTime: number;
  position: Vec3;
  yaw: number;
}
/** RemotePlayer components register a push callback here keyed by player id. */
export const snapshotPushers = new Map<string, (snap: PositionSnapshot) => void>();

export interface Notification {
  id: number;
  text: string;
  createdAt: number;
}

export interface DamageNumber {
  id: number;
  value: number;
  fatal: boolean;
  createdAt: number;
}

interface GameStore {
  localPlayerId: string | null;
  localPlayerColor: string | null;
  localPosition: { x: number; y: number; z: number };
  localYaw: number;
  localPitch: number;
  localHp: number;
  localKills: number;
  localDeaths: number;
  remotePlayers: Map<string, PlayerState>;
  connected: boolean;
  pendingRespawn: Vec3 | null;
  hitAt: number;
  hitMarkerAt: number;
  damageNumbers: DamageNumber[];
  respawnAt: number;
  matchWinner: { id: string; kills: number } | null;
  notifications: Notification[];

  setLocalPlayer: (id: string, color: string) => void;
  setLocalPosition: (pos: { x: number; y: number; z: number }) => void;
  setLocalRotation: (yaw: number, pitch: number) => void;
  setLocalStats: (hp: number, kills: number, deaths: number) => void;
  setConnected: (v: boolean) => void;
  updateRemotePlayers: (players: PlayerState[], localId: string | null) => void;
  addRemotePlayer: (player: PlayerState) => void;
  removeRemotePlayer: (id: string) => void;
  setPendingRespawn: (pos: Vec3 | null) => void;
  setHitAt: (t: number) => void;
  setHitMarker: () => void;
  addDamageNumber: (value: number, fatal: boolean) => void;
  setRespawnAt: (t: number) => void;
  setMatchWinner: (w: { id: string; kills: number } | null) => void;
  addNotification: (text: string) => void;
}

let notifId = 0;

export const useGameStore = create<GameStore>((set) => ({
  localPlayerId: null,
  localPlayerColor: null,
  localPosition: { x: 0, y: 1, z: 0 },
  localYaw: 0,
  localPitch: 0,
  localHp: 100,
  localKills: 0,
  localDeaths: 0,
  remotePlayers: new Map(),
  connected: false,
  pendingRespawn: null,
  hitAt: 0,
  hitMarkerAt: 0,
  damageNumbers: [],
  respawnAt: 0,
  matchWinner: null,
  notifications: [],

  setLocalPlayer: (id, color) =>
    set({ localPlayerId: id, localPlayerColor: color, connected: true }),

  setLocalPosition: (pos) => set({ localPosition: pos }),

  setLocalRotation: (yaw, pitch) => set({ localYaw: yaw, localPitch: pitch }),

  setLocalStats: (hp, kills, deaths) => set({ localHp: hp, localKills: kills, localDeaths: deaths }),

  setConnected: (v) => set({ connected: v }),

  updateRemotePlayers: (players, localId) =>
    set(() => {
      const next = new Map<string, PlayerState>();
      for (const p of players) {
        if (p.id !== localId) next.set(p.id, p);
      }
      return { remotePlayers: next };
    }),

  addRemotePlayer: (player) =>
    set((state) => {
      const next = new Map(state.remotePlayers);
      next.set(player.id, player);
      return { remotePlayers: next };
    }),

  removeRemotePlayer: (id) =>
    set((state) => {
      const next = new Map(state.remotePlayers);
      next.delete(id);
      return { remotePlayers: next };
    }),

  setPendingRespawn: (pos) => set({ pendingRespawn: pos }),

  setHitAt: (t) => set({ hitAt: t }),

  setHitMarker: () => set({ hitMarkerAt: Date.now() }),

  addDamageNumber: (value, fatal) =>
    set((state) => ({
      damageNumbers: [
        ...state.damageNumbers.slice(-5),
        { id: notifId++, value, fatal, createdAt: Date.now() },
      ],
    })),

  setRespawnAt: (t) => set({ respawnAt: t }),

  setMatchWinner: (w) => set({ matchWinner: w }),

  addNotification: (text) =>
    set((state) => ({
      // Keep at most 5 notifications
      notifications: [
        ...state.notifications.slice(-4),
        { id: notifId++, text, createdAt: Date.now() },
      ],
    })),
}));
