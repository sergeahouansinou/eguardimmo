"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import type { Listing } from "@/lib/roost-data";
import { EMPTY_SEARCH, searchHref, withoutCursor, type SearchState } from "@/marketplace/search";
import ListingCard from "../ListingCard";

const pagerStyle = { display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 20px", borderRadius: 11, border: "1px solid #E2DDD6", background: "#fff", color: "#231F1C", fontWeight: 700, fontSize: 14, textDecoration: "none" } as const;

export function ResultsGrid({ listings, search, nextCursor }: { listings: Listing[]; search: SearchState; nextCursor: string | null }) {
  const { t } = useI18n();
  const stay = { checkIn: search.checkIn, checkOut: search.checkOut, guests: search.guests };

  if (listings.length === 0) {
    return (
      <div style={{ padding: "64px 0", textAlign: "center", color: "#6E6A66", fontSize: 15, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <p style={{ margin: 0 }}>{search.after ? t("sbNoMoreResults") : t("sbNoResults")}</p>
        <Link href={searchHref({ ...EMPTY_SEARCH, scope: search.scope })} style={pagerStyle}>{t("sbSeeAll")}</Link>
      </div>
    );
  }

  return (
    <>
      <ul style={{ listStyle: "none", margin: "22px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "34px 24px" }}>
        {listings.map((listing) => (
          <li key={listing.id} style={{ minWidth: 0, display: "flex" }}>
            <ListingCard listing={listing} stay={stay} />
          </li>
        ))}
      </ul>
      <nav aria-label={t("sbPagination")} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 40 }}>
        {search.after !== null && <Link href={searchHref(withoutCursor(search))} style={pagerStyle}>{t("sbPageFirst")}</Link>}
        {nextCursor !== null && <Link href={searchHref({ ...search, after: nextCursor })} rel="next" style={pagerStyle}>{t("sbPageNext")}</Link>}
      </nav>
    </>
  );
}
