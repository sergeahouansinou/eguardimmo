"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { EMPTY_SEARCH, searchHref } from "@/marketplace/search";
import { kindKey } from "@/marketplace/roostDetail";
import type { Kind } from "@/marketplace/schemas";
import { INK, MUTED, SECTION_BORDER } from "./ui";

function Chevron() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#A8A29B" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function Breadcrumb({ kind, cityName }: { kind: Kind; cityName: string | null }) {
  const t = useT();
  const link = { color: INK, textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 44 } as const;
  return (
    <div style={{ borderTop: SECTION_BORDER }}>
      <div style={{ borderBottom: SECTION_BORDER }}>
        <nav aria-label={t("ficheBreadcrumb")} style={{ maxWidth: 1280, margin: "0 auto", padding: "8px 40px", fontSize: 14, color: MUTED }}>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
            <li>
              <Link href="/" className="r-hover-underline" style={link}>
                {t("ficheHome")}
              </Link>
            </li>
            <li aria-hidden="true" style={{ display: "flex" }}>
              <Chevron />
            </li>
            <li>
              <Link href={searchHref({ ...EMPTY_SEARCH, scope: kind })} className="r-hover-underline" style={link}>
                {t(kindKey(kind))}
              </Link>
            </li>
            {cityName ? (
              <>
                <li aria-hidden="true" style={{ display: "flex" }}>
                  <Chevron />
                </li>
                <li style={{ color: MUTED }}>{cityName}</li>
              </>
            ) : null}
          </ol>
        </nav>
      </div>
    </div>
  );
}
