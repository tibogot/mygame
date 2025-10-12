import React from "react";

export const ControlsUI = () => {
  const containerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "20px",
    left: "20px",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "white",
    padding: "15px 20px",
    borderRadius: "8px",
    fontFamily: "monospace",
    fontSize: "12px",
    lineHeight: "1.6",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    userSelect: "none",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#ffd700",
    borderBottom: "1px solid rgba(255, 215, 0, 0.3)",
    paddingBottom: "5px",
  };

  const sectionStyle: React.CSSProperties = {
    marginTop: "8px",
  };

  const keyStyle: React.CSSProperties = {
    display: "inline-block",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    padding: "2px 6px",
    borderRadius: "3px",
    margin: "0 4px 0 0",
    fontSize: "11px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>⌨️ CONTROLS</div>

      <div style={sectionStyle}>
        <div>
          <span style={keyStyle}>WASD</span> Move
        </div>
        <div>
          <span style={keyStyle}>Shift</span> Run
        </div>
        <div>
          <span style={keyStyle}>Space</span> Jump
        </div>
        <div>
          <span style={keyStyle}>Ctrl</span> Crouch
        </div>
        <div>
          <span style={keyStyle}>Q</span> Walk Backwards
        </div>
      </div>

      <div style={sectionStyle}>
        <div>
          <span style={keyStyle}>E</span> Dance 💃
        </div>
        <div>
          <span style={keyStyle}>R</span> Combat Mode ⚔️
        </div>
      </div>

      <div
        style={{
          ...sectionStyle,
          marginTop: "10px",
          fontSize: "11px",
          opacity: 0.7,
        }}
      >
        <div>In Combat Mode:</div>
        <div>
          <span style={keyStyle}>L-Click</span> Attack
        </div>
        <div>
          <span style={keyStyle}>R-Click</span> Alt Attack
        </div>
      </div>
    </div>
  );
};
