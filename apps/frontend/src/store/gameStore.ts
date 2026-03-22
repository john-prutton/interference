import { create } from "zustand";
import type { PlayerState, Vec3 } from "@interference/domain";

export interface Notification {
  id: number;
  text: string;
  createdAt: number;
}

interface GameStore {
  localPlayerId: string | null;
  localPlayerColor: string | null;
  localPosition: { x: number; y: number; z: number };
  localYaw: number;
  localPitch: number;
  remotePlayers: Map<string, PlayerState>;
  connected: boolean;
  pendingRespawn: Vec3 | null;
  hitAt: number;
  notifications: Notification[];

  setLocalPlayer: (id: string, color: string) => void;
  setLocalPosition: (pos: { x: number; y: number; z: number }) => void;
  setLocalRotation: (yaw: number, pitch: number) => void;
  setConnected: (v: boolean) => void;
  updateRemotePlayers: (players: PlayerState[], localId: string | null) => void;
  addRemotePlayer: (player: PlayerState) => void;
  removeRemotePlayer: (id: string) => void;
  setPendingRespawn: (pos: Vec3 | null) => void;
  setHitAt: (t: number) => void;
  addNotification: (text: string) => void;
}

let notifId = 0;

export const useGameStore = create<GameStore>((set) => ({
  localPlayerId: null,
  localPlayerColor: null,
  localPosition: { x: 0, y: 1, z: 0 },
  localYaw: 0,
  localPitch: 0,
  remotePlayers: new Map(),
  connected: false,
  pendingRespawn: null,
  hitAt: 0,
  notifications: [],

  setLocalPlayer: (id, color) =>
    set({ localPlayerId: id, localPlayerColor: color, connected: true }),

  setLocalPosition: (pos) => set({ localPosition: pos }),

  setLocalRotation: (yaw, pitch) => set({ localYaw: yaw, localPitch: pitch }),

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

  addNotification: (text) =>
    set((state) => ({
      // Keep at most 5 notifications
      notifications: [
        ...state.notifications.slice(-4),
        { id: notifId++, text, createdAt: Date.now() },
      ],
    })),
}));
