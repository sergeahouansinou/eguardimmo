"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { searchHref, type SearchState } from "@/marketplace/search";

export function ScopeTabs({ search }: { search: SearchState }) {
  const { t } = useI18n();
  const tabs = [
    { scope: "short_stay", label: t("hcat_short") },
    { scope: "long_term", label: t("hcat_long") },
  ] as const;
  return (
    <nav aria-label={t("sbScopeLabel")} style={{ display: "flex", gap: 8, marginTop: 14 }}>
      {tabs.map((tab) => {
        const on = search.scope === tab.scope;
        return (
          <Link
            key={tab.scope}
            href={searchHref({ ...search, scope: tab.scope, after: null })}
            aria-current={on ? "page" : undefined}
            style={{ padding: "8px 16px", borderRadius: 22, border: `1px solid ${on ? "#231F1C" : "#E2DDD6"}`, background: on ? "#231F1C" : "#fff", color: on ? "#fff" : "#231F1C", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
