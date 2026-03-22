import { useEffect, useRef, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "@interference/domain";
import { useGameStore } from "../store/gameStore";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const store = useGameStore();
  const storeRef = useRef(store);
  storeRef.current = store;

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
        const s = storeRef.current;
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

    ws.onclose = () => storeRef.current.setConnected(false);
    ws.onerror = () => storeRef.current.setConnected(false);

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

  return { connected: store.connected, sendMove };
}
