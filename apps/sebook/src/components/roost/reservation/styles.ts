import type { CSSProperties } from "react";
import { FONTS } from "@/lib/roost-data";

export const UI = FONTS.ui;
export const NAVY = "#113242";

export const cardStyle: CSSProperties = {
  border: "1px solid #E5E0D9",
  borderRadius: 18,
  padding: "26px 28px",
};

export const h2Style: CSSProperties = {
  fontFamily: UI,
  fontWeight: 700,
  fontSize: 19,
  letterSpacing: "-0.01em",
  margin: 0,
  color: "#231F1C",
};

export const recapRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  fontSize: 15,
};

export const mutedStyle: CSSProperties = { color: "#6E6A66" };
export const strongStyle: CSSProperties = { fontWeight: 600, color: "#231F1C", textAlign: "right" };

export const alertStyle: CSSProperties = {
  padding: "12px 15px",
  background: "#FEF2F2",
  border: "1px solid #F4C7C7",
  borderRadius: 11,
  fontSize: 13.5,
  color: "#B42318",
  lineHeight: 1.5,
};

export const noticeStyle: CSSProperties = {
  padding: "12px 15px",
  background: "#FFF8EB",
  border: "1px solid #F1D9A8",
  borderRadius: 11,
  fontSize: 13.5,
  color: "#6B4A00",
  lineHeight: 1.5,
};

export const softLinkStyle: CSSProperties = {
  background: "#F4F1ED",
  borderRadius: 9,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  color: "#231F1C",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export const underlineLinkStyle: CSSProperties = { color: "inherit", textDecoration: "underline", textUnderlineOffset: 2, fontWeight: 600 };
