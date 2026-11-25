"use client";

import { useState } from "react";
import { CategoryIcon } from "../icons";
import { FONTS } from "@/lib/roost-data";
import { useT } from "@/lib/i18n/context";
import type { DetailAmenity } from "@/marketplace/roostDetail";
import { Modal } from "./Modal";
import { BODY_TEXT, INK, SECTION_BORDER, closeBtnStyle, outlineBtn } from "./ui";

const TOP_COUNT = 10;
const MODAL_TITLE_ID = "annonce-amenities-title";

function AmenityLabel({ amenity }: { amenity: DetailAmenity }) {
  const t = useT();
  return amenity.labelKey ? t(amenity.labelKey) : amenity.fallbackLabel;
}

function AmenityIcon({ amenity }: { amenity: DetailAmenity }) {
  return (
    <span aria-hidden="true" style={{ flex: "0 0 auto", display: "flex", color: INK }}>
      <CategoryIcon d={[...amenity.icon]} size={24} />
    </span>
  );
}

export function Amenities({ amenities }: { amenities: readonly DetailAmenity[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (amenities.length === 0) return null;
  const top = amenities.slice(0, TOP_COUNT);
  return (
    <div style={{ padding: "28px 0", borderBottom: SECTION_BORDER }}>
      <h2 style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 21, margin: "0 0 20px", color: INK }}>{t("whatThisPlaceOffers")}</h2>
      <ul className="r-annonce-amenities" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 28px" }}>
        {top.map((amenity) => (
          <li key={amenity.id} style={{ display: "flex", alignItems: "center", gap: 15, fontSize: 16, color: BODY_TEXT }}>
            <AmenityIcon amenity={amenity} />
            <AmenityLabel amenity={amenity} />
          </li>
        ))}
      </ul>
      {amenities.length > TOP_COUNT ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="r-hover-soft"
          style={{ ...outlineBtn, marginTop: 26 }}
        >
          {t("showAllAmenities", { n: amenities.length })}
        </button>
      ) : null}
      {open ? (
        <Modal
          labelledBy={MODAL_TITLE_ID}
          maxWidth={680}
          onClose={() => {
            setOpen(false);
          }}
        >
          <div style={{ padding: "28px 32px 36px" }}>
            <button
              type="button"
              aria-label={t("contactClose")}
              onClick={() => {
                setOpen(false);
              }}
              className="r-hover-soft"
              style={{ ...closeBtnStyle, marginBottom: 16 }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <h2 id={MODAL_TITLE_ID} style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 22, margin: "0 0 22px", color: INK }}>
              {t("whatThisPlaceOffers")}
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {amenities.map((amenity) => (
                <li key={amenity.id} style={{ display: "flex", alignItems: "center", gap: 15, padding: "11px 0", borderBottom: "1px solid #F1ECE6", fontSize: 16, color: BODY_TEXT }}>
                  <AmenityIcon amenity={amenity} />
                  <AmenityLabel amenity={amenity} />
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
