import type { CSSProperties } from "react";

export const INK = "#231F1C";
export const BODY_TEXT = "#3F3A35";
export const MUTED = "#6E6A66";
export const SECTION_BORDER = "1px solid #EFEBE6";

export const underlineBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "none",
  border: "none",
  borderRadius: 8,
  padding: "12px 11px",
  minHeight: 44,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 600,
  color: INK,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

export const outlineBtn: CSSProperties = {
  background: "#fff",
  border: `1px solid ${INK}`,
  borderRadius: 10,
  padding: "13px 22px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 600,
  color: INK,
};

export const closeBtnStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "1px solid #E2DDD6",
  background: "#fff",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

export const reserveBtn: CSSProperties = {
  display: "block",
  textAlign: "center",
  width: "100%",
  background: "#85C920",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: 15,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  textDecoration: "none",
};
