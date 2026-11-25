"use client";

import { FONTS } from "@/lib/roost-data";
import { useT } from "@/lib/i18n/context";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import type { CancellationPolicy } from "@/marketplace/schemas";
import { BODY_TEXT, INK, SECTION_BORDER } from "./ui";

const POLICY_KEYS: Record<CancellationPolicy, { name: I18nKey; text: I18nKey }> = {
  flexible: { name: "ficheCancelFlexible", text: "ficheCancelFlexibleText" },
  moderate: { name: "ficheCancelModerate", text: "ficheCancelModerateText" },
  strict: { name: "ficheCancelStrict", text: "ficheCancelStrictText" },
};

export function ThingsToKnow({ policy }: { policy: CancellationPolicy }) {
  const t = useT();
  const keys = POLICY_KEYS[policy];
  return (
    <section aria-labelledby="annonce-things-title" style={{ padding: "44px 0 64px", borderTop: SECTION_BORDER }}>
      <h2 id="annonce-things-title" style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 23, margin: "0 0 26px", color: INK }}>
        {t("thingsToKnow")}
      </h2>
      <div className="r-annonce-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 40 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 16px", color: INK }}>{t("cancellationTitle")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 15, color: BODY_TEXT }}>
            <div style={{ fontWeight: 600, color: INK }}>{t(keys.name)}</div>
            <div>{t(keys.text)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
