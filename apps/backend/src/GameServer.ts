import { WebSocketServer } from "ws";
import type { ClientMessage } from "@interference/domain";
import { PlayerRegistry } from "./PlayerRegistry";

/** Returns true if the ray hits the sphere. */
function rayHitsSphere(
  ox: number, oy: number, oz: number,   // ray origin
  dx: number, dy: number, dz: number,   // ray direction (unit vector)
  cx: number, cy: number, cz: number,   // sphere center
  r: number
): boolean {
  const fx = cx - ox, fy = cy - oy, fz = cz - oz;
  const t = fx * dx + fy * dy + fz * dz;
  if (t < 0) return false; // sphere is behind the ray
  const distSq = fx * fx + fy * fy + fz * fz - t * t;
  return distSq <= r * r;
}

const KILLS_TO_WIN = 20;

export class GameServer {
  private wss: WebSocketServer;
  private registry: PlayerRegistry;
  private matchActive = true;

  constructor(port: number, host = "0.0.0.0") {
    this.registry = new PlayerRegistry();
    this.wss = new WebSocketServer({ port, host });

    // 20 Hz server tick — broadcast world_state to all clients on a fixed interval
    // instead of on every move message, reducing O(n²) message traffic.
    setInterval(() => {
      this.registry.broadcast({
        type: "world_state",
        players: this.registry.getAll(),
        serverTime: Date.now(),
      });
    }, 50);

    this.wss.on("connection", (ws) => {
      const playerId = this.registry.add(ws);
      const playerState = this.registry.getState(playerId)!;

      // Welcome the new player with current world snapshot
      this.registry.sendTo(playerId, {
        type: "welcome",
        yourId: playerId,
        yourColor: playerState.color,
        players: this.registry.getAll().filter((p) => p.id !== playerId),
      });

      // Notify existing players
      this.registry.broadcast(
        { type: "player_joined", player: playerState },
        playerId
      );

      ws.on("message", (data) => {
        try {
          const msg: ClientMessage = JSON.parse(data.toString());

          if (msg.type === "move") {
            this.registry.updateState(playerId, {
              position: msg.position,
              yaw: msg.yaw,
              pitch: msg.pitch,
            });
            // world_state is now broadcast by the 20 Hz tick, not per move.

          } else if (msg.type === "ping") {
            this.registry.sendTo(playerId, {
              type: "pong",
              clientTime: msg.clientTime,
              serverTime: Date.now(),
            });

          } else if (msg.type === "shoot") {
            const shooter = this.registry.getState(playerId);
            if (!shooter) return;

            // Clamp shootTime to a safe rewind window (anti-cheat guard)
            const now = Date.now();
            const targetServerTime = Math.max(now - 1000, Math.min(now, msg.shootTime));

            // Ray origin: shooter's eye position
            const ox = shooter.position.x;
            const oy = shooter.position.y + 0.6;
            const oz = shooter.position.z;

            // Ray direction from yaw + pitch (already unit length)
            const cosPitch = Math.cos(msg.pitch);
            const dx = -Math.sin(msg.yaw) * cosPitch;
            const dy = Math.sin(msg.pitch);
            const dz = -Math.cos(msg.yaw) * cosPitch;

            // Test each other player using their rewound (historical) position
            let victimId: string | null = null;
            for (const target of this.registry.getAll()) {
              if (target.id === playerId) continue;
              const rewindPos = this.registry.getPositionAt(target.id, targetServerTime)
                ?? target.position;
              if (rayHitsSphere(ox, oy, oz, dx, dy, dz,
                rewindPos.x, rewindPos.y + 0.8, rewindPos.z, 0.7)) {
                victimId = target.id;
                break;
              }
            }

            // Broadcast tracer to all other clients
            this.registry.broadcast(
              { type: "shot_fired", shooterId: playerId, origin: { x: ox, y: oy, z: oz }, direction: { x: dx, y: dy, z: dz } },
              playerId,
            );

            if (victimId) {
              const killed = this.registry.damagePlayer(victimId, 25);
              if (killed) {
                const newPosition = this.registry.respawnPlayer(victimId);
                if (newPosition) {
                  this.registry.addKill(playerId);
                  this.registry.broadcast({ type: "hit", shooterId: playerId, victimId, newPosition });
                  // Match win check
                  if (this.matchActive) {
                    const winner = this.registry.getState(playerId);
                    if (winner && winner.kills >= KILLS_TO_WIN) {
                      this.matchActive = false;
                      this.registry.broadcast({ type: "match_end", winnerId: playerId, winnerKills: winner.kills });
                      setTimeout(() => {
                        this.registry.resetMatch();
                        this.matchActive = true;
                        this.registry.broadcast({
                          type: "world_state",
                          players: this.registry.getAll(),
                          serverTime: Date.now(),
                        });
                      }, 5000);
                    }
                  }
                }
              } else {
                // Non-fatal hit — tell shooter their shot connected
                this.registry.broadcast({ type: "damaged", shooterId: playerId, victimId, damage: 25 });
              }
              // Broadcast world_state immediately so victims see HP drop without waiting for tick.
              this.registry.broadcast({
                type: "world_state",
                players: this.registry.getAll(),
                serverTime: Date.now(),
              });
            }
          }
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on("close", () => {
        this.registry.remove(playerId);
        this.registry.broadcast({ type: "player_left", playerId });
      });

      ws.on("error", () => {
        this.registry.remove(playerId);
        this.registry.broadcast({ type: "player_left", playerId });
      });
    });
  }
}
