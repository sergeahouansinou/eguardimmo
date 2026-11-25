"use client";

import { FONTS, GRADIENTS } from "@/lib/roost-data";
import { useT } from "@/lib/i18n/context";
import type { AnnonceView } from "@/marketplace/roostDetail";
import { BODY_TEXT, INK, SECTION_BORDER } from "./ui";

export function Overview({ view }: { view: AnnonceView }) {
  const t = useT();
  const heading = [t(view.categoryKey), view.place].filter((part) => part !== "").join(" · ");
  return (
    <>
      <div style={{ paddingBottom: 28, borderBottom: SECTION_BORDER }}>
        <h2 style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 23, letterSpacing: "-0.01em", margin: "0 0 4px", color: INK }}>{heading}</h2>
        <p style={{ fontSize: 16, color: BODY_TEXT, margin: 0 }}>{view.facts.map((fact) => t(fact.key, { n: fact.value })).join(" · ")}</p>
      </div>
      {view.hostName ? (
        <div style={{ display: "flex", alignItems: "center", gap: 15, padding: "20px 0", borderBottom: SECTION_BORDER }}>
          <div
            aria-hidden="true"
            style={{
              width: 54,
              height: 54,
              flex: "0 0 auto",
              borderRadius: "50%",
              background: GRADIENTS[view.scene],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            {view.hostInitial}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, minWidth: 0, overflowWrap: "anywhere" }}>{t("hostedBy", { name: view.hostName })}</div>
        </div>
      ) : null}
    </>
  );
}
