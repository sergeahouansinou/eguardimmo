"use client";

import { CategoryIcon } from "../icons";
import { FONTS } from "@/lib/roost-data";
import { useT } from "@/lib/i18n/context";
import type { DetailCharacteristic } from "@/marketplace/roostDetail";
import { BODY_TEXT, INK, SECTION_BORDER } from "./ui";

export function Characteristics({ items }: { items: readonly DetailCharacteristic[] }) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <div style={{ padding: "28px 0", borderBottom: SECTION_BORDER }}>
      <h2 style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 21, margin: "0 0 18px", color: INK }}>{t("characteristics")}</h2>
      <ul className="r-annonce-amenities" style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px 28px", margin: 0 }}>
        {items.map((item) => (
          <li key={item.labelKey} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 15, color: BODY_TEXT }}>
            <span aria-hidden="true" style={{ flex: "0 0 auto", display: "flex", color: INK }}>
              <CategoryIcon d={[...item.icon]} size={22} />
            </span>
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              <strong>{t(item.labelKey)}</strong> : {item.valueKey ? t(item.valueKey, { n: item.value }) : item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
