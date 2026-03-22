import { useGameStore } from "../store/gameStore";

interface Props {
  isLocked: boolean;
  requestLock: () => void;
  connected: boolean;
}

export function HUD({ isLocked, requestLock, connected }: Props) {
  const notifications = useGameStore((s) => s.notifications);
  const hitAt = useGameStore((s) => s.hitAt);

  const now = Date.now();
  const damageAlpha = hitAt > 0 ? Math.max(0, 1 - (now - hitAt) / 500) : 0;
  const visibleNotifs = notifications.filter((n) => now - n.createdAt < 3000);

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
        </>
      )}
    </div>
  );
}
