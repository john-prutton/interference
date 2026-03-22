import { useEffect, useRef, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "@interference/domain";
import { useGameStore, snapshotPushers } from "../store/gameStore";
import { emitTracer } from "../map/mapData";

/** Client-to-server clock offset: add to Date.now() to get an estimate of server time. */
export const clockOffsetRef = { current: 0 };

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  // Only subscribe to `connected` — avoids re-rendering App on every position update
  const connected = useGameStore((s) => s.connected);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join" } satisfies ClientMessage));
      // Measure RTT to estimate clock offset (one sample is sufficient for a game session)
      ws.send(JSON.stringify({ type: "ping", clientTime: Date.now() } satisfies ClientMessage));
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
            // Distribute timestamped snapshots to RemotePlayer interpolation buffers
            for (const p of msg.players) {
              if (p.id === s.localPlayerId) continue;
              snapshotPushers.get(p.id)?.({
                serverTime: msg.serverTime,
                position: p.position,
                yaw: p.yaw,
              });
            }
            // Update local player's HP and K/D from server-authoritative state
            {
              const localP = msg.players.find((p) => p.id === s.localPlayerId);
              if (localP) s.setLocalStats(localP.hp, localP.kills, localP.deaths);
            }
            // Detect match reset: winner's kills dropped to 0 → hide end screen
            if (s.matchWinner) {
              const w = msg.players.find((p) => p.id === s.matchWinner!.id);
              if (w && w.kills === 0) s.setMatchWinner(null);
            }
            break;
          case "hit":
            if (msg.victimId === s.localPlayerId) {
              s.setPendingRespawn(msg.newPosition);
              s.setRespawnAt(Date.now() + 3000);
              s.setHitAt(Date.now());
              s.addNotification("You were eliminated!");
            } else if (msg.shooterId === s.localPlayerId) {
              s.setHitMarker();
              s.addDamageNumber(25, true);
              s.addNotification("Enemy eliminated!");
            }
            break;
          case "damaged":
            if (msg.shooterId === s.localPlayerId) {
              s.setHitMarker();
              s.addDamageNumber(msg.damage, false);
            }
            break;
          case "match_end":
            s.setMatchWinner({ id: msg.winnerId, kills: msg.winnerKills });
            break;
          case "pong": {
            const rtt = Date.now() - msg.clientTime;
            clockOffsetRef.current = msg.serverTime + rtt / 2 - Date.now();
            break;
          }
          case "shot_fired":
            emitTracer(msg.origin, msg.direction);
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

  const sendShoot = useCallback((yaw: number, pitch: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = {
      type: "shoot",
      yaw,
      pitch,
      shootTime: Date.now() + clockOffsetRef.current,
    };
    ws.send(JSON.stringify(msg));
  }, []);

  return { connected, sendMove, sendShoot };
}
