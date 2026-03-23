import { Context, Effect, Layer, Ref } from "effect";

export interface MatchStateService {
  readonly isActive: () => Effect.Effect<boolean>;
  readonly setActive: (v: boolean) => Effect.Effect<void>;
}

export class MatchState extends Context.Tag("MatchState")<
  MatchState,
  MatchStateService
>() {}

export const MatchStateLive = Layer.effect(
  MatchState,
  Effect.gen(function* () {
    const ref = yield* Ref.make(true);
    return {
      isActive: () => Ref.get(ref),
      setActive: (v: boolean) => Ref.set(ref, v),
    };
  }),
);
