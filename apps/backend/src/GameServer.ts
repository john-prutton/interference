import { WebSocketServer } from "ws";
import type { ClientMessage } from "@interference/domain";
import { PlayerRegistry } from "./PlayerRegistry";

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
