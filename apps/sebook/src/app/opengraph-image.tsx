import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

export const alt = `${SITE_NAME} - Logements à réserver`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LIME = "#85C920";
const INK = "#231F1C";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: `linear-gradient(135deg, ${INK} 0%, #3A342F 62%, ${LIME} 175%)`,
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: LIME,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "40px",
            fontWeight: 800,
            color: INK,
          }}
        >
          S
        </div>
        <div style={{ fontSize: "44px", fontWeight: 800, letterSpacing: "-1px" }}>{SITE_NAME}</div>
      </div>

      <div style={{ marginTop: "48px", fontSize: "68px", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-2px", maxWidth: "900px" }}>
        Logements à réserver
      </div>

      <div style={{ marginTop: "28px", fontSize: "34px", fontWeight: 500, color: "#E3EFC9", maxWidth: "900px" }}>{SITE_TAGLINE}</div>
    </div>,
    { ...size },
  );
}
