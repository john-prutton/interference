import { useEffect, useRef, useCallback } from "react";
import { Effect, Runtime } from "effect";
import { decodeServerMessage, type ClientMessage } from "@interference/domain";
import { useGameStore, snapshotPushers } from "../store/gameStore";
import { emitTracer } from "../map/mapData";

/** Client-to-server clock offset: add to Date.now() to get an estimate of server time. */
export const clockOffsetRef = { current: 0 };

const AppRuntime = Runtime.defaultRuntime;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const connected = useGameStore((s) => s.connected);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join" } satisfies ClientMessage));
      ws.send(JSON.stringify({ type: "ping", clientTime: Date.now() } satisfies ClientMessage));
    };

    ws.onmessage = (event: MessageEvent) => {
      const handleMessage = decodeServerMessage(JSON.parse(event.data as string) as unknown).pipe(
        Effect.map((msg) => {
          const s = useGameStore.getState();
          switch (msg.type) {
            case "welcome":
              s.setLocalPlayer(msg.yourId, msg.yourColor);
              s.updateRemotePlayers([...msg.players], msg.yourId);
              break;
            case "player_joined":
              s.addRemotePlayer(msg.player);
              break;
            case "player_left":
              s.removeRemotePlayer(msg.playerId);
              break;
            case "world_state":
              s.updateRemotePlayers([...msg.players], s.localPlayerId);
              for (const p of msg.players) {
                if (p.id === s.localPlayerId) continue;
                snapshotPushers.get(p.id)?.({
                  serverTime: msg.serverTime,
                  position: p.position,
                  yaw: p.yaw,
                });
              }
              {
                const localP = msg.players.find((p) => p.id === s.localPlayerId);
                if (localP) s.setLocalStats(localP.hp, localP.kills, localP.deaths);
              }
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
        }),
        Effect.orElse(() => Effect.void),
      );
      Runtime.runFork(AppRuntime)(handleMessage);
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
    [],
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
