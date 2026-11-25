"use client";

import { PLACES_MIN_CHARS, placeLabel } from "@/features/search/usePlaces";
import { useI18n } from "@/lib/i18n/context";
import type { Place } from "@/marketplace/schemas";
import { INK, LINE } from "./styles";

export interface PlaceSuggestions {
  places: Place[];
  loading: boolean;
  failed: boolean;
}

export function DestinationField({
  text,
  onText,
  onChoose,
  suggestions: { places, loading, failed },
}: {
  text: string;
  onText: (text: string) => void;
  onChoose: (place: Place, label: string) => void;
  suggestions: PlaceSuggestions;
}) {
  const { t } = useI18n();
  const typed = text.trim().length >= PLACES_MIN_CHARS;

  return (
    <>
      <input
        value={text}
        onChange={(event) => {
          onText(event.target.value);
        }}
        placeholder={t("searchWhereGoing")}
        aria-label={t("searchWhere")}
        autoComplete="off"
        maxLength={80}
        style={{ width: "100%", border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", fontSize: 14, color: INK, marginBottom: 16, outline: "none" }}
      />
      <div role="status" style={{ fontSize: 13, color: "#6E6A66", padding: "0 8px" }}>
        {!typed ? t("sbPlacesHint") : loading ? t("sbPlacesLoading") : failed ? t("sbPlacesFailed") : places.length === 0 ? t("sbPlacesNone") : ""}
      </div>
      <ul style={{ display: "flex", flexDirection: "column", gap: 2, listStyle: "none", margin: 0, padding: 0 }}>
        {places.map((place) => (
          <li key={place.slug}>
            <button
              type="button"
              className="r-hover-soft"
              onClick={() => {
                onChoose(place, placeLabel(place));
              }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, background: "none", border: "none", padding: "9px 8px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
            >
              <span style={{ width: 40, height: 40, borderRadius: 11, background: "#F1ECE6", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#6E6A66" strokeWidth={1.7} aria-hidden="true">
                  <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{placeLabel(place)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
