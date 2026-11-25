"use client";

import Link from "next/link";
import { memo } from "react";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { useFavorites } from "@/lib/favorites";
import { useI18n } from "@/lib/i18n/context";
import { GRADIENTS, PERIOD_UNIT_KEY, type Listing } from "@/lib/roost-data";
import { listingHref } from "@/marketplace/format";
import { Heart } from "./icons";

export interface StayContext {
  checkIn: string;
  checkOut: string;
  guests: number | null;
}

const ListingCard = memo(function ListingCard({ listing, carousel = false, stay }: { listing: Listing; carousel?: boolean; stay?: StayContext }) {
  const { isFavorite, toggle } = useFavorites();
  const requireAuth = useRequireAuth();
  const { t } = useI18n();
  const faved = isFavorite(listing.id);

  return (
    <Link
      href={listingHref(listing.id, stay)}
      className={carousel ? "r-card" : undefined}
      style={{ scrollSnapAlign: carousel ? "start" : undefined, textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8, width: carousel ? undefined : "100%", textAlign: "left" }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1.18/1", borderRadius: 12, overflow: "hidden", background: GRADIENTS[listing.scene] }}>
        <button
          type="button"
          aria-label={faved ? t("removeFromFavorites") : t("addToFavorites")}
          aria-pressed={faved}
          className="r-hover-scale"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            requireAuth(() => {
              void toggle(listing.id);
            });
          }}
          style={{ position: "absolute", top: 11, right: 11, background: "none", border: "none", padding: 0, cursor: "pointer", transition: "transform .12s", lineHeight: 0 }}
        >
          <Heart faved={faved} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#231F1C", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{listing.title}</span>
        {listing.subtitle !== "" && <span style={{ fontSize: 13, color: "#6E6A66" }}>{listing.subtitle}</span>}
        <span style={{ fontSize: 13, color: "#231F1C", marginTop: 2 }}>
          <span style={{ fontWeight: 600 }}>{listing.price}</span>
          {` / ${t(PERIOD_UNIT_KEY[listing.pricePeriod])}`}
        </span>
      </div>
    </Link>
  );
});

export default ListingCard;
