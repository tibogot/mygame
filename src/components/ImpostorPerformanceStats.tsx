import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

/**
 * IMPOSTOR PERFORMANCE STATS
 *
 * Displays real-time performance metrics to compare
 * impostor rendering vs full 3D model rendering
 */

interface PerformanceStatsProps {
  enabled?: boolean;
  position?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "middle-left";
}

export const ImpostorPerformanceStats: React.FC<PerformanceStatsProps> = ({
  enabled = true,
  position = "middle-left",
}) => {
  const [fps, setFps] = useState(60);
  const [drawCalls, setDrawCalls] = useState(0);
  const [triangles, setTriangles] = useState(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useFrame(({ gl }) => {
    frameCountRef.current++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTimeRef.current;

    // Update FPS every 500ms
    if (deltaTime >= 500) {
      const currentFps = Math.round((frameCountRef.current / deltaTime) * 1000);
      setFps(currentFps);
      frameCountRef.current = 0;
      lastTimeRef.current = currentTime;

      // Get renderer info
      const info = gl.info;
      setDrawCalls(info.render.calls);
      setTriangles(info.render.triangles);
    }
  });

  if (!enabled) return null;

  const positionStyles = {
    "top-left": { top: "80px", left: "20px" },
    "top-right": { top: "80px", right: "20px" },
    "bottom-left": { bottom: "180px", left: "20px" }, // Above character controls
    "bottom-right": { bottom: "20px", right: "20px" },
    "middle-left": { top: "45%", left: "20px", transform: "translateY(-50%)" }, // Below stats, above controls
  };

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none", // Allow clicks to pass through to Leva and game
    zIndex: 999, // Below Leva (which is usually 1000+)
  };

  const styles: React.CSSProperties = {
    position: "fixed",
    ...positionStyles[position],
    background: "rgba(0, 0, 0, 0.8)",
    color: "#ffffff",
    padding: "15px 20px",
    borderRadius: "8px",
    fontFamily: "'Courier New', monospace",
    fontSize: "14px",
    minWidth: "220px",
    backdropFilter: "blur(5px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
    pointerEvents: "auto", // This box itself can be interacted with
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#00ff88",
    marginBottom: "10px",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "1px",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    alignItems: "center",
  };

  const labelStyle: React.CSSProperties = {
    color: "#aaaaaa",
    fontSize: "12px",
  };

  const valueStyle: React.CSSProperties = {
    fontWeight: "bold",
    fontSize: "16px",
  };

  const getFpsColor = (fps: number) => {
    if (fps >= 60) return "#00ff88";
    if (fps >= 30) return "#ffaa00";
    return "#ff4444";
  };

  return (
    <Html fullscreen style={containerStyle}>
      <div style={styles}>
        <div style={titleStyle}>🚀 Impostor Performance</div>

        <div style={rowStyle}>
          <span style={labelStyle}>FPS:</span>
          <span style={{ ...valueStyle, color: getFpsColor(fps) }}>{fps}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Draw Calls:</span>
          <span style={valueStyle}>{drawCalls}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Triangles:</span>
          <span style={valueStyle}>
            {triangles >= 1000000
              ? `${(triangles / 1000000).toFixed(2)}M`
              : triangles >= 1000
              ? `${(triangles / 1000).toFixed(1)}K`
              : triangles}
          </span>
        </div>

        <div
          style={{
            marginTop: "12px",
            paddingTop: "10px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            fontSize: "11px",
            color: "#666666",
            textAlign: "center",
          }}
        >
          Toggle impostor in Leva panel
        </div>
      </div>
    </Html>
  );
};

export default ImpostorPerformanceStats;
