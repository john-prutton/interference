import { useState, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { Scoreboard } from "./Scoreboard";

interface Props {
  isLocked: boolean;
  requestLock: () => void;
  connected: boolean;
}

export function HUD({ isLocked, requestLock, connected }: Props) {
  const notifications = useGameStore((s) => s.notifications);
  const hitAt = useGameStore((s) => s.hitAt);
  const localHp = useGameStore((s) => s.localHp);
  const [showScoreboard, setShowScoreboard] = useState(false);

  const now = Date.now();
  const damageAlpha = hitAt > 0 ? Math.max(0, 1 - (now - hitAt) / 500) : 0;
  const visibleNotifs = notifications.filter((n) => now - n.createdAt < 3000);

  useEffect(() => {
    if (!isLocked) { setShowScoreboard(false); return; }
    const onDown = (e: KeyboardEvent) => { if (e.code === "Tab") { e.preventDefault(); setShowScoreboard(true); } };
    const onUp   = (e: KeyboardEvent) => { if (e.code === "Tab") setShowScoreboard(false); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [isLocked]);

  const hpColor = localHp > 60 ? "#2ecc71" : localHp > 30 ? "#f39c12" : "#e74c3c";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: isLocked ? "none" : "auto",
        userSelect: "none",
      }}
    >
      {/* Red damage flash */}
      {damageAlpha > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(200,0,0,${damageAlpha * 0.45})`,
            pointerEvents: "none",
          }}
        />
      )}

      {!isLocked && (
        <div
          onClick={requestLock}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            color: "white",
            cursor: "pointer",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: "bold", fontFamily: "monospace" }}>
            INTERFERENCE
          </div>
          <div style={{ fontSize: 18, fontFamily: "monospace" }}>Click to Play</div>
          <div style={{ fontSize: 13, color: "#aaa", fontFamily: "monospace" }}>
            WASD to move · Space to jump · Click to shoot · Mouse to look · ESC to release cursor
          </div>
          <div
            style={{
              fontSize: 12,
              color: connected ? "#2ecc71" : "#e74c3c",
              fontFamily: "monospace",
              marginTop: 8,
            }}
          >
            {connected ? "● Connected" : "● Disconnected"}
          </div>
        </div>
      )}

      {isLocked && (
        <>
          {/* Crosshair */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 20,
              height: 20,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 2,
                background: "rgba(255,255,255,0.8)",
                transform: "translateY(-50%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: 2,
                background: "rgba(255,255,255,0.8)",
                transform: "translateX(-50%)",
              }}
            />
          </div>

          {/* Kill feed — top right */}
          {visibleNotifs.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                alignItems: "flex-end",
              }}
            >
              {visibleNotifs.map((n) => {
                const age = now - n.createdAt;
                const opacity = age < 2500 ? 1 : Math.max(0, 1 - (age - 2500) / 500);
                const isKill = n.text.startsWith("Enemy");
                return (
                  <div
                    key={n.id}
                    style={{
                      fontFamily: "monospace",
                      fontSize: 14,
                      color: isKill ? "#2ecc71" : "#e74c3c",
                      background: "rgba(0,0,0,0.5)",
                      padding: "3px 8px",
                      borderRadius: 3,
                      opacity,
                    }}
                  >
                    {n.text}
                  </div>
                );
              })}
            </div>
          )}

          {/* HP bar — bottom center */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 160,
                height: 8,
                background: "rgba(255,255,255,0.15)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${localHp}%`,
                  height: "100%",
                  background: hpColor,
                  borderRadius: 4,
                  transition: "width 0.1s ease, background 0.3s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: hpColor }}>
              {localHp} HP
            </div>
          </div>

          {/* Status */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              color: connected ? "#2ecc71" : "#e74c3c",
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            {connected ? "● Connected" : "● Disconnected"}
          </div>

          {/* Scoreboard */}
          {showScoreboard && <Scoreboard />}
        </>
      )}
    </div>
  );
}
