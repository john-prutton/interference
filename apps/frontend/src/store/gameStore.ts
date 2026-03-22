import { create } from "zustand";
import type { PlayerState } from "@interference/domain";

interface GameStore {
  localPlayerId: string | null;
  localPlayerColor: string | null;
  localPosition: { x: number; y: number; z: number };
  localYaw: number;
  localPitch: number;
  remotePlayers: Map<string, PlayerState>;
  connected: boolean;

  setLocalPlayer: (id: string, color: string) => void;
  setLocalPosition: (pos: { x: number; y: number; z: number }) => void;
  setLocalRotation: (yaw: number, pitch: number) => void;
  setConnected: (v: boolean) => void;
  updateRemotePlayers: (players: PlayerState[], localId: string | null) => void;
  addRemotePlayer: (player: PlayerState) => void;
  removeRemotePlayer: (id: string) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  localPlayerId: null,
  localPlayerColor: null,
  localPosition: { x: 0, y: 1, z: 0 },
  localYaw: 0,
  localPitch: 0,
  remotePlayers: new Map(),
  connected: false,

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
}));
