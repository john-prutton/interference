import { useGameStore } from "../store/gameStore";

export function Scoreboard() {
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const localPlayerColor = useGameStore((s) => s.localPlayerColor);
  const localHp = useGameStore((s) => s.localHp);
  const localKills = useGameStore((s) => s.localKills);
  const localDeaths = useGameStore((s) => s.localDeaths);

  type Row = { id: string; color: string; hp: number; kills: number; deaths: number; isLocal: boolean };

  const rows: Row[] = [];

  if (localPlayerId) {
    rows.push({
      id: localPlayerId,
      color: localPlayerColor ?? "#ffffff",
      hp: localHp,
      kills: localKills,
      deaths: localDeaths,
      isLocal: true,
    });
  }

  for (const p of remotePlayers.values()) {
    rows.push({ id: p.id, color: p.color, hp: p.hp, kills: p.kills, deaths: p.deaths, isLocal: false });
  }

  rows.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(0,0,0,0.82)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 6,
        padding: "18px 28px",
        minWidth: 320,
        fontFamily: "monospace",
        color: "white",
        pointerEvents: "none",
      }}
    >
      <div style={{ textAlign: "center", fontSize: 13, letterSpacing: 3, marginBottom: 14, color: "#aaa" }}>
        SCOREBOARD
      </div>

      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr 48px 40px 40px",
          gap: "0 10px",
          fontSize: 11,
          color: "#888",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: 6,
          marginBottom: 6,
        }}
      >
        <span />
        <span>PLAYER</span>
        <span style={{ textAlign: "right" }}>HP</span>
        <span style={{ textAlign: "right" }}>K</span>
        <span style={{ textAlign: "right" }}>D</span>
      </div>

      {/* Rows */}
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns: "24px 1fr 48px 40px 40px",
            gap: "0 10px",
            fontSize: 13,
            padding: "4px 0",
            background: r.isLocal ? "rgba(255,255,255,0.06)" : "transparent",
            borderRadius: 3,
          }}
        >
          {/* Color swatch */}
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: r.color,
              alignSelf: "center",
              marginLeft: 6,
            }}
          />
          {/* Name */}
          <span style={{ color: r.isLocal ? "#fff" : "#ccc" }}>
            {r.id.slice(0, 6)}
            {r.isLocal && <span style={{ color: "#aaa", fontSize: 10 }}> (you)</span>}
          </span>
          {/* HP */}
          <span
            style={{
              textAlign: "right",
              color: r.hp > 60 ? "#2ecc71" : r.hp > 30 ? "#f39c12" : "#e74c3c",
            }}
          >
            {r.hp}
          </span>
          {/* Kills */}
          <span style={{ textAlign: "right", color: "#eee" }}>{r.kills}</span>
          {/* Deaths */}
          <span style={{ textAlign: "right", color: "#888" }}>{r.deaths}</span>
        </div>
      ))}

      <div style={{ textAlign: "center", fontSize: 10, color: "#555", marginTop: 14 }}>
        HOLD [TAB]
      </div>
    </div>
  );
}
