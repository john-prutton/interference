import { runMain } from "@effect/platform-node/NodeRuntime";
import { Effect, Layer } from "effect";
import { GameServer, GameServerLive } from "./GameServer.js";
import { PlayerRegistryLive } from "./PlayerRegistry.js";
import { MatchStateLive } from "./MatchState.js";

const AppLayer = GameServerLive.pipe(
  Layer.provide(PlayerRegistryLive),
  Layer.provide(MatchStateLive),
);

const program = Effect.gen(function* () {
  const server = yield* GameServer;
  yield* server.run;
});

runMain(program.pipe(Effect.provide(AppLayer)));
