"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { type HomeCategoryId, type Listing, matchesHomeCategory } from "@/lib/roost-data";
import { EMPTY_SEARCH, searchHref } from "@/marketplace/search";
import ListingRow from "./ListingRow";

const SHORT_HREF = searchHref(EMPTY_SEARCH);
const LONG_HREF = searchHref({ ...EMPTY_SEARCH, scope: "long_term" });

export type HomeStatus = "ready" | "unavailable";

export default function Listings({ short, long, category, status }: { short: Listing[]; long: Listing[]; category: HomeCategoryId; status: HomeStatus }) {
  const { t } = useI18n();
  const shortItems = short.filter((item) => matchesHomeCategory(item, category));
  const longItems = long.filter((item) => matchesHomeCategory(item, category));
  const empty = shortItems.length === 0 && longItems.length === 0;

  return (
    <main id="roost-listings" className="r-listings" style={{ width: "100%", maxWidth: 1520, margin: "0 auto", padding: "28px 48px 64px", height: "auto" }}>
      <h1 className="sr-only">{t("sbHomeHeading")}</h1>
      {status === "unavailable" ? (
        <div role="alert" style={{ padding: "64px 0", textAlign: "center", color: "#6E6A66", fontSize: 15 }}>{t("sbHomeUnavailable")}</div>
      ) : empty ? (
        <div style={{ padding: "64px 0", textAlign: "center", color: "#6E6A66", fontSize: 15 }}>{t("noListingsAvailable")}</div>
      ) : (
        <>
          {shortItems.length > 0 && <ListingRow title={t("hcat_short")} items={shortItems} href={SHORT_HREF} />}
          {longItems.length > 0 && <ListingRow title={t("hcat_long")} items={longItems} href={LONG_HREF} />}
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11, marginTop: 32 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#231F1C" }}>{t("continueExploring")}</span>
        <Link href={SHORT_HREF} className="r-show-more" style={{ background: "#231F1C", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, textDecoration: "none" }}>
          {t("showMore")}
        </Link>
      </div>
    </main>
  );
}
