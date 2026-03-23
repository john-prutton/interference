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
  const hitMarkerAt = useGameStore((s) => s.hitMarkerAt);
  const damageNumbers = useGameStore((s) => s.damageNumbers);
  const localHp = useGameStore((s) => s.localHp);
  const respawnAt = useGameStore((s) => s.respawnAt);
  const matchWinner = useGameStore((s) => s.matchWinner);
  const ping = useGameStore((s) => s.ping);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [tick, setTick] = useState(0); // drives animation re-renders

  const now = Date.now();
  const damageAlpha = hitAt > 0 ? Math.max(0, 1 - (now - hitAt) / 500) : 0;
  const hitMarkerAlpha = hitMarkerAt > 0 ? Math.max(0, 1 - (now - hitMarkerAt) / 250) : 0;
  const visibleNotifs = notifications.filter((n) => now - n.createdAt < 3000);
  const isDead = respawnAt > 0;
  const respawnSecsLeft = isDead ? Math.max(0, Math.ceil((respawnAt - now) / 1000)) : 0;
  const activeDamageNumbers = damageNumbers.filter((n) => now - n.createdAt < 1000);
  const hpColor = localHp > 60 ? "#2ecc71" : localHp > 30 ? "#f39c12" : "#e74c3c";

  // Re-render at 20 fps when animating damage numbers, respawn countdown, or hit marker
  useEffect(() => {
    const needsTick = activeDamageNumbers.length > 0 || isDead || hitMarkerAlpha > 0;
    if (!needsTick) return;
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [activeDamageNumbers.length, isDead, hitMarkerAlpha > 0]);

  // Tab key scoreboard
  useEffect(() => {
    if (!isLocked) { setShowScoreboard(false); return; }
    const onDown = (e: KeyboardEvent) => { if (e.code === "Tab") { e.preventDefault(); setShowScoreboard(true); } };
    const onUp   = (e: KeyboardEvent) => { if (e.code === "Tab") setShowScoreboard(false); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [isLocked]);

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

      {/* Match end screen */}
      {matchWinner && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            gap: 12,
            fontFamily: "monospace",
            color: "white",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 13, letterSpacing: 4, color: "#aaa" }}>MATCH OVER</div>
          <div style={{ fontSize: 30, fontWeight: "bold" }}>
            Player {matchWinner.id.slice(0, 6)} wins!
          </div>
          <div style={{ fontSize: 18, color: "#f39c12" }}>{matchWinner.kills} kills</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 8 }}>New match starting…</div>
        </div>
      )}

      {!isLocked && !matchWinner && (
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
          {/* Crosshair + hit marker */}
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
            {/* Regular crosshair */}
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
            {/* Hit marker: red X overlay */}
            {hitMarkerAlpha > 0 && (
              <>
                <div style={{
                  position: "absolute", top: "50%", left: 0, right: 0, height: 2,
                  background: "#e74c3c", transform: "translateY(-50%) rotate(45deg)",
                  opacity: hitMarkerAlpha,
                }} />
                <div style={{
                  position: "absolute", left: "50%", top: 0, bottom: 0, width: 2,
                  background: "#e74c3c", transform: "translateX(-50%) rotate(45deg)",
                  opacity: hitMarkerAlpha,
                }} />
              </>
            )}
          </div>

          {/* Damage numbers — float up from crosshair */}
          {activeDamageNumbers.map((n) => {
            const age = now - n.createdAt;
            const opacity = Math.max(0, 1 - age / 1000);
            const translateY = -(age / 8);
            return (
              <div
                key={n.id}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: `translate(-50%, calc(-50% + ${translateY}px))`,
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  fontSize: 16,
                  color: n.fatal ? "#e74c3c" : "#ffffff",
                  opacity,
                  pointerEvents: "none",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  marginTop: -30,
                }}
              >
                +{n.value}
              </div>
            );
          })}

          {/* Respawn countdown */}
          {isDead && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                fontFamily: "monospace",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontSize: 22, color: "#e74c3c", fontWeight: "bold", letterSpacing: 3 }}>
                ELIMINATED
              </div>
              <div style={{ fontSize: 15, color: "#ccc" }}>
                Respawning in {respawnSecsLeft}…
              </div>
            </div>
          )}

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

          {/* Status + Ping */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              fontSize: 12,
              fontFamily: "monospace",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <span style={{ color: connected ? "#2ecc71" : "#e74c3c" }}>
              {connected ? "● Connected" : "● Disconnected"}
            </span>
            {connected && (
              <span style={{ color: ping < 80 ? "#2ecc71" : ping < 150 ? "#f39c12" : "#e74c3c" }}>
                {ping}ms
              </span>
            )}
          </div>

          {/* Scoreboard */}
          {showScoreboard && <Scoreboard />}
        </>
      )}

      {/* suppress unused tick warning */}
      {tick === -1 && null}
    </div>
  );
}
