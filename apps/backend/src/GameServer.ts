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

export class GameServer {
  private wss: WebSocketServer;
  private registry: PlayerRegistry;

  constructor(port: number) {
    this.registry = new PlayerRegistry();
    this.wss = new WebSocketServer({ port });

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
            this.registry.broadcast({
              type: "world_state",
              players: this.registry.getAll(),
            });
          } else if (msg.type === "shoot") {
            const shooter = this.registry.getState(playerId);
            if (!shooter) return;

            // Ray origin: shooter's eye position
            const ox = shooter.position.x;
            const oy = shooter.position.y + 0.6;
            const oz = shooter.position.z;

            // Ray direction from yaw + pitch (already unit length)
            const cosPitch = Math.cos(msg.pitch);
            const dx = -Math.sin(msg.yaw) * cosPitch;
            const dy = Math.sin(msg.pitch);
            const dz = -Math.cos(msg.yaw) * cosPitch;

            // Test each other player's hit sphere (center = chest, radius = 0.7)
            let victimId: string | null = null;
            for (const target of this.registry.getAll()) {
              if (target.id === playerId) continue;
              if (rayHitsSphere(ox, oy, oz, dx, dy, dz,
                target.position.x, target.position.y + 0.8, target.position.z, 0.7)) {
                victimId = target.id;
                break;
              }
            }

            if (victimId) {
              const newPosition = this.registry.respawnPlayer(victimId);
              if (newPosition) {
                this.registry.broadcast({ type: "hit", shooterId: playerId, victimId, newPosition });
                this.registry.broadcast({ type: "world_state", players: this.registry.getAll() });
              }
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
