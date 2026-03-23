import { Data } from "effect";

export class MessageParseError extends Data.TaggedError("MessageParseError")<{
  readonly raw: string;
  readonly cause: unknown;
}> {}

export class WebSocketSendError extends Data.TaggedError("WebSocketSendError")<{
  readonly playerId: string;
  readonly cause: unknown;
}> {}
