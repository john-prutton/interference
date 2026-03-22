import { useEffect, useRef, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "@interference/domain";
import { useGameStore } from "../store/gameStore";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  // Only subscribe to `connected` — avoids re-rendering App on every position update
  const connected = useGameStore((s) => s.connected);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      const msg: ClientMessage = { type: "join" };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        // Use getState() so we always read live Zustand state, not a stale React snapshot.
        // This matters when world_state arrives before React has re-rendered after welcome.
        const s = useGameStore.getState();
        switch (msg.type) {
          case "welcome":
            s.setLocalPlayer(msg.yourId, msg.yourColor);
            s.updateRemotePlayers(msg.players, msg.yourId);
            break;
          case "player_joined":
            s.addRemotePlayer(msg.player);
            break;
          case "player_left":
            s.removeRemotePlayer(msg.playerId);
            break;
          case "world_state":
            s.updateRemotePlayers(msg.players, s.localPlayerId);
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => useGameStore.getState().setConnected(false);
    ws.onerror = () => useGameStore.getState().setConnected(false);

    return () => ws.close();
  }, []);

  const sendMove = useCallback(
    (position: { x: number; y: number; z: number }, yaw: number, pitch: number) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const msg: ClientMessage = { type: "move", position, yaw, pitch };
      ws.send(JSON.stringify(msg));
    },
    []
  );

  return { connected, sendMove };
}
