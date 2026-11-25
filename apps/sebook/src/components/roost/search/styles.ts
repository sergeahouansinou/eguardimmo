import type { CSSProperties } from "react";

export const INK = "#231F1C";
export const PLACEHOLDER = "#8A8580";
export const LINE = "#E2DDD6";
export const ACCENT_INK = "#113242";

export const popoverStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 14px)",
  zIndex: 50,
  background: "#fff",
  border: "1px solid #EBE7E2",
  borderRadius: 24,
  boxShadow: "0 18px 44px rgba(0,0,0,.17)",
};

export const circleButton: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: `1px solid ${LINE}`,
  background: "#fff",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const drawerSectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: ".04em",
  color: PLACEHOLDER,
  textTransform: "uppercase",
  margin: "0 0 12px",
};
