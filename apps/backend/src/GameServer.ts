import { Context, Duration, Effect, Layer, Option, Schedule } from "effect";
import type { Fiber } from "effect";
import { WebSocketServer } from "ws";
import type { RawData } from "ws";
import type { ClientMessage, PlayerState, Vec3 } from "@interference/domain";
import { decodeClientMessage } from "@interference/domain";
import { PlayerRegistry, type PlayerRegistryService } from "./PlayerRegistry.js";
import { MatchState, type MatchStateService } from "./MatchState.js";

const KILLS_TO_WIN = 20;

/** Returns true if the ray hits the sphere. */
function rayHitsSphere(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  cx: number, cy: number, cz: number,
  r: number,
): boolean {
  const fx = cx - ox, fy = cy - oy, fz = cz - oz;
  const t = fx * dx + fy * dy + fz * dz;
  if (t < 0) return false;
  const distSq = fx * fx + fy * fy + fz * fz - t * t;
  return distSq <= r * r;
}

const handleShoot = (
  playerId: string,
  yaw: number,
  pitch: number,
  shootTime: number,
  registry: PlayerRegistryService,
  matchState: MatchStateService,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const shooter: Option.Option<PlayerState> = yield* registry.getState(playerId);
    if (Option.isNone(shooter)) return;

    const now = Date.now();
    const targetServerTime = Math.max(now - 1000, Math.min(now, shootTime));

    const ox = shooter.value.position.x;
    const oy = shooter.value.position.y + 0.6;
    const oz = shooter.value.position.z;

    const cosPitch = Math.cos(pitch);
    const dx = -Math.sin(yaw) * cosPitch;
    const dy = Math.sin(pitch);
    const dz = -Math.cos(yaw) * cosPitch;

    const allPlayers: readonly PlayerState[] = yield* registry.getAll();

    let victimId: string | null = null;
    for (const target of allPlayers) {
      if (target.id === playerId) continue;
      const rewindPos: Option.Option<Vec3> = yield* registry.getPositionAt(target.id, targetServerTime);
      const pos = Option.getOrElse(rewindPos, () => target.position);
      if (rayHitsSphere(ox, oy, oz, dx, dy, dz, pos.x, pos.y + 0.8, pos.z, 0.7)) {
        victimId = target.id;
        break;
      }
    }

    yield* registry.broadcast(
      { type: "shot_fired", shooterId: playerId, origin: { x: ox, y: oy, z: oz }, direction: { x: dx, y: dy, z: dz } },
      playerId,
    );

    if (victimId) {
      const killed: boolean = yield* registry.damagePlayer(victimId, 25);
      if (killed) {
        const newPosition: Option.Option<Vec3> = yield* registry.respawnPlayer(victimId);
        if (Option.isSome(newPosition)) {
          yield* registry.addKill(playerId);
          yield* registry.broadcast({ type: "hit", shooterId: playerId, victimId, newPosition: newPosition.value });

          const active: boolean = yield* matchState.isActive();
          if (active) {
            const winner: Option.Option<PlayerState> = yield* registry.getState(playerId);
            if (Option.isSome(winner) && winner.value.kills >= KILLS_TO_WIN) {
              yield* matchState.setActive(false);
              yield* registry.broadcast({ type: "match_end", winnerId: playerId, winnerKills: winner.value.kills });
              // Fork reset so it doesn't block the shot handler
              yield* Effect.gen(function* () {
                yield* Effect.sleep(Duration.seconds(5));
                yield* registry.resetMatch();
                yield* matchState.setActive(true);
                const players: readonly PlayerState[] = yield* registry.getAll();
                yield* registry.broadcast({ type: "world_state", players: [...players], serverTime: Date.now() });
              }).pipe(Effect.fork) as Effect.Effect<Fiber.RuntimeFiber<void, never>>;
            }
          }
        }
      } else {
        yield* registry.broadcast({ type: "damaged", shooterId: playerId, victimId, damage: 25 });
      }
      const players: readonly PlayerState[] = yield* registry.getAll();
      yield* registry.broadcast({ type: "world_state", players: [...players], serverTime: Date.now() });
    }
  }) as Effect.Effect<void>;

const processMessage = (
  raw: string,
  playerId: string,
  registry: PlayerRegistryService,
  matchState: MatchStateService,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const parsed: unknown = yield* Effect.try({ try: () => JSON.parse(raw) as unknown, catch: () => new Error("invalid json") });
    const msg: ClientMessage = yield* decodeClientMessage(parsed).pipe(
      Effect.mapError(() => new Error("parse error")),
    );

    switch (msg.type) {
      case "move":
        yield* registry.updateState(playerId, { position: msg.position, yaw: msg.yaw, pitch: msg.pitch });
        break;
      case "ping":
        yield* registry.sendTo(playerId, { type: "pong", clientTime: msg.clientTime, serverTime: Date.now() });
        break;
      case "shoot":
        yield* handleShoot(playerId, msg.yaw, msg.pitch, msg.shootTime, registry, matchState);
        break;
      case "join":
        break;
    }
  }).pipe(Effect.catchAll(() => Effect.void));

const handleConnection = (
  ws: import("ws").WebSocket,
  playerId: string,
  registry: PlayerRegistryService,
  matchState: MatchStateService,
): Effect.Effect<void> =>
  Effect.async<void>((resume) => {
    const onMessage = (data: RawData) => {
      Effect.runFork(processMessage(data.toString(), playerId, registry, matchState));
    };
    const onClose = () => {
      ws.off("message", onMessage);
      resume(Effect.void);
    };
    ws.on("message", onMessage);
    ws.once("close", onClose);
    ws.once("error", onClose);
  });

export interface GameServerService {
  readonly run: Effect.Effect<void>;
}

export class GameServer extends Context.Tag("GameServer")<
  GameServer,
  GameServerService
>() {}

const makeRun = (
  registry: PlayerRegistryService,
  matchState: MatchStateService,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const port = parseInt(process.env["PORT"] ?? "8080", 10);
    const host = process.env["HOST"] ?? "0.0.0.0";

    const wss: WebSocketServer = yield* Effect.acquireRelease(
      Effect.async<WebSocketServer>((resume) => {
        const server = new WebSocketServer({ port, host });
        server.once("listening", () => resume(Effect.succeed(server)));
        server.once("error", (err) => resume(Effect.die(err)));
      }),
      (server) => Effect.sync(() => server.close()),
    );

    yield* Effect.log(`Game server listening on ws://${host}:${port}`);

    // 20 Hz tick
    yield* Effect.gen(function* () {
      const players: readonly PlayerState[] = yield* registry.getAll();
      yield* registry.broadcast({ type: "world_state", players: [...players], serverTime: Date.now() });
    }).pipe(
      Effect.repeat(Schedule.spaced(Duration.millis(50))),
      Effect.fork,
    );

    // Handle connections (runs forever)
    yield* Effect.async<void>((resume) => {
      wss.on("connection", (ws) => {
        Effect.runFork(
          Effect.gen(function* () {
            const playerId: string = yield* registry.add(ws);
            const playerState: Option.Option<PlayerState> = yield* registry.getState(playerId);

            if (Option.isSome(playerState)) {
              const all: readonly PlayerState[] = yield* registry.getAll();
              yield* registry.sendTo(playerId, {
                type: "welcome",
                yourId: playerId,
                yourColor: playerState.value.color,
                players: all.filter((p) => p.id !== playerId),
              });
              yield* registry.broadcast({ type: "player_joined", player: playerState.value }, playerId);
            }

            yield* handleConnection(ws, playerId, registry, matchState);

            yield* registry.remove(playerId);
            yield* registry.broadcast({ type: "player_left", playerId });
          }) as Effect.Effect<void>,
        );
      });

      wss.once("error", (err) => resume(Effect.die(err)));
    });
  }).pipe(Effect.scoped);

export const GameServerLive = Layer.effect(
  GameServer,
  Effect.gen(function* () {
    const registry: PlayerRegistryService = yield* PlayerRegistry;
    const matchState: MatchStateService = yield* MatchState;
    return { run: makeRun(registry, matchState) };
  }),
);
