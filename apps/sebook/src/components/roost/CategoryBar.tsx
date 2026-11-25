"use client";

import Link from "next/link";
import { HOME_CATEGORIES, type HomeCategoryId } from "@/lib/roost-data";
import { CategoryIcon } from "./icons";
import { useI18n } from "@/lib/i18n/context";
import type { I18nKey } from "@/lib/i18n/dictionaries";

// Barre de catégories de l'accueil. Désormais FONCTIONNELLE : chaque catégorie
// filtre le pool d'annonces (état remonté dans RoostHome → passé à Listings).
// « Filtres » mène à /destinations (vraie surface de recherche + carte). Le
// toggle « total avant taxes » a été retiré : eGuardImmo n'a ni frais ni taxes
// en ligne (paiement sur place), il n'avait donc aucun sens.
export default function CategoryBar({
  active,
  onChange,
  available,
  onFilters,
  filterCount = 0,
}: {
  active: HomeCategoryId;
  onChange: (id: HomeCategoryId) => void;
  // Ids de catégories qui ont RÉELLEMENT des annonces dans le pool courant.
  // undefined → on affiche tout (pas de filtrage de disponibilité). « all » est
  // toujours conservé. Évite de proposer une catégorie qui mène à un écran vide.
  available?: HomeCategoryId[];
  // Si fourni, « Filtres » devient un bouton qui ouvre le panneau (page
  // Destinations). Sinon (accueil) c'est un lien vers /destinations.
  onFilters?: () => void;
  // Nombre de filtres actifs → badge sur le bouton « Filtres ».
  filterCount?: number;
}) {
  const { t } = useI18n();

  const filtersIcon = (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
  const filtersStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #E2DDD6",
    background: "#fff",
    borderRadius: 13,
    padding: "11px 15px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    fontSize: 13,
    color: "#231F1C",
    textDecoration: "none",
  };
  const filterBadge =
    filterCount > 0 ? (
      <span
        style={{
          minWidth: 18,
          height: 18,
          padding: "0 5px",
          borderRadius: 9,
          background: "#231F1C",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {filterCount}
      </span>
    ) : null;

  const cats = available
    ? HOME_CATEGORIES.filter((c) => c.id === "all" || available.includes(c.id))
    : HOME_CATEGORIES;

  return (
    <div style={{ borderBottom: "1px solid #EFEBE6" }}>
      <div className="r-catbar-inner" style={{ maxWidth: 1320, margin: "0 auto", padding: "0 40px", display: "flex", alignItems: "center", gap: 24 }}>
        <div className="cat-scroll" style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 34, overflowX: "auto", padding: "14px 2px 0", minWidth: 0 }}>
          {cats.map((cat) => {
            const isActive = active === cat.id;
            return (
              <button
                key={cat.id}
                className="r-hover-dark"
                onClick={() => {
                  onChange(cat.id);
                }}
                aria-pressed={isActive}
                style={{
                  flex: "0 0 auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${isActive ? "#231F1C" : "transparent"}`,
                  padding: "0 2px 12px",
                  cursor: "pointer",
                  color: isActive ? "#231F1C" : "#6E6A66",
                  opacity: isActive ? 1 : 0.65,
                  fontFamily: "inherit",
                  transition: "opacity .15s,color .15s,border-color .15s",
                }}
              >
                <span style={{ display: "flex" }}>
                  <CategoryIcon d={cat.d} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{t(("hcat_" + cat.id) as I18nKey)}</span>
              </button>
            );
          })}
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, paddingBottom: 14 }}>
          {onFilters ? (
            <button type="button" onClick={onFilters} className="r-hover-border" style={filtersStyle}>
              {filtersIcon}
              {t('filtersLabel')}
              {filterBadge}
            </button>
          ) : (
            <Link href="/destinations" className="r-hover-border" style={filtersStyle}>
              {filtersIcon}
              {t('filtersLabel')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
