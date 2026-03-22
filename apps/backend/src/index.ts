import { config } from "dotenv";
import { resolve } from "node:path";

// Load env files in priority order (first file wins; dotenv skips already-set vars).
// .env.local — local overrides, gitignored, never committed.
// .env.dev   — shared development defaults, committed.
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env.dev") });

import { GameServer } from "./GameServer";

const PORT = parseInt(process.env["PORT"] ?? "8080", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";
new GameServer(PORT, HOST);
console.log(`Game server listening on ws://${HOST}:${PORT}`);
