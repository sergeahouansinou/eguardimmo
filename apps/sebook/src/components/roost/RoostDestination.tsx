"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { countActiveFilters } from "@/lib/destination-filters";
import { useI18n } from "@/lib/i18n/context";
import { FONTS, type HomeCategoryId, type Listing } from "@/lib/roost-data";
import { searchHref, type SearchState } from "@/marketplace/search";
import { categoryFromId } from "@/marketplace/roost";
import CategoryBar from "./CategoryBar";
import { ResultsGrid } from "./destination/ResultsGrid";
import { ScopeTabs } from "./destination/ScopeTabs";
import Footer from "./Footer";
import Header from "./Header";

const DestinationFilters = dynamic(() => import("./DestinationFilters"));

const CATEGORY_IDS: HomeCategoryId[] = ["all", "studio", "apartment", "house", "shared"];

export type DestinationStatus = "ready" | "unavailable";

export default function RoostDestination({ search, listings, nextCursor, status, placeName }: { search: SearchState; listings: Listing[]; nextCursor: string | null; status: DestinationStatus; placeName: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const active: HomeCategoryId = search.category ?? "all";
  const filterCount = useMemo(() => countActiveFilters(search), [search]);

  const title = search.scope === "short_stay" ? (placeName ? t("sbDestTitleShortAt", { destination: placeName }) : t("sbDestTitleShort")) : placeName ? t("sbDestTitleLongAt", { destination: placeName }) : t("sbDestTitleLong");

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: FONTS.body }}>
      <div style={{ position: "sticky", top: 0, zIndex: 80, background: "#fff" }}>
        <Header />
        <CategoryBar
          active={active}
          available={CATEGORY_IDS}
          onChange={(id) => {
            router.push(searchHref({ ...search, category: categoryFromId(id), after: null }));
          }}
          onFilters={() => {
            setFiltersOpen(true);
          }}
          filterCount={filterCount}
        />
      </div>

      <main className="r-dest-results" style={{ maxWidth: 1520, margin: "0 auto", padding: "24px 30px 60px" }}>
        <h1 style={{ fontFamily: "var(--font-schibsted), sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: 0, color: "#231F1C" }}>{title}</h1>
        <p style={{ fontSize: 14, color: "#6E6A66", margin: "4px 0 0" }}>{t("sbDestPriceNote")}</p>
        <ScopeTabs search={search} />
        {status === "unavailable" ? (
          <div role="alert" style={{ padding: "64px 0", textAlign: "center", color: "#6E6A66", fontSize: 15 }}>{t("sbSearchUnavailable")}</div>
        ) : (
          <ResultsGrid listings={listings} search={search} nextCursor={nextCursor} />
        )}
      </main>

      <Footer />

      {filtersOpen && (
        <DestinationFilters
          search={search}
          onClose={() => {
            setFiltersOpen(false);
          }}
          onApply={(next) => {
            setFiltersOpen(false);
            router.push(searchHref(next));
          }}
        />
      )}
    </div>
  );
}
