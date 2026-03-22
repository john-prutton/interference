import { GameServer } from "./GameServer";

const PORT = parseInt(process.env["PORT"] ?? "8080", 10);
new GameServer(PORT);
console.log(`Game server listening on ws://localhost:${PORT}`);
