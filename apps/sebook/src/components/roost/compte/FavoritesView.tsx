"use client";

import { useFavoritesQuery } from "@/features/favorites/queries";
import ListingCard from "@/components/roost/ListingCard";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites";
import { useI18n } from "@/lib/i18n/context";
import { FONTS } from "@/lib/roost-data";
import { describeFailure } from "@/marketplace/errors";
import Footer from "../Footer";
import Header from "../Header";
import { SkelCard, SkelRegion } from "../Skeleton";
import { UI } from "../reservation/styles";
import PageNotice from "./PageNotice";

const GRID = { display: "grid", gap: "26px 16px" } as const;

function Body() {
  const { t } = useI18n();
  const { isAuthenticated, loading: authLoading, openAuth } = useAuth();
  const { favorites, loading } = useFavorites();
  const query = useFavoritesQuery(isAuthenticated);

  if (authLoading || loading) {
    return (
      <SkelRegion label={t("fav_loading")} className="r-search-grid" style={GRID}>
        {Array.from({ length: 8 }, (_, index) => (
          <SkelCard key={index} />
        ))}
      </SkelRegion>
    );
  }
  if (!isAuthenticated) {
    return <PageNotice text={t("fav_loginText")} action={{ label: t("acc_login"), onClick: () => { openAuth("login"); } }} />;
  }
  if (query.isError) {
    return <PageNotice role="alert" title={t("fav_errorTitle")} text={describeFailure(query.error).message} action={{ label: t("rsv_retry"), onClick: () => void query.refetch() }} />;
  }
  if (favorites.length === 0) return <PageNotice text={t("fav_empty")} action={{ label: t("fav_browse"), href: "/" }} />;
  return (
    <ul className="r-search-grid" style={{ ...GRID, listStyle: "none", margin: 0, padding: 0 }}>
      {favorites.map((listing) => (
        <li key={listing.id} style={{ minWidth: 0 }}>
          <ListingCard listing={listing} />
        </li>
      ))}
    </ul>
  );
}

export default function FavoritesView() {
  const { t } = useI18n();
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: FONTS.body }}>
      <Header />
      <main style={{ maxWidth: 1520, margin: "0 auto", padding: "40px clamp(16px, 4vw, 48px) 80px" }}>
        <h1 style={{ fontFamily: UI, fontWeight: 700, fontSize: "clamp(22px, 4vw, 32px)", letterSpacing: "-0.02em", color: "#231F1C", margin: "0 0 32px" }}>{t("fav_title")}</h1>
        <Body />
      </main>
      <Footer />
    </div>
  );
}
