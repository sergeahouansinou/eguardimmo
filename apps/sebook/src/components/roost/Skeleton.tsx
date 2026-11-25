// Briques de squelette partagées par les loading.tsx (Server Component, zéro JS client).
// Les tailles reprennent celles des vraies cartes/blocs pour éviter tout décalage
// (CLS) quand le contenu réel remplace le squelette.

import type { CSSProperties } from "react";

export function SkelBlock({
  style,
  className,
}: {
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className ? `r-skel ${className}` : "r-skel"}
      aria-hidden="true"
      style={{ borderRadius: 8, ...style }}
    />
  );
}

/** Carte annonce : visuel au ratio de la vraie carte + 2 lignes de texte. */
export function SkelCard({ ratio = "1.18 / 1" }: { ratio?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <SkelBlock style={{ width: "100%", aspectRatio: ratio, borderRadius: 12 }} />
      <SkelBlock style={{ height: 13, width: "70%", borderRadius: 6 }} />
      <SkelBlock style={{ height: 13, width: "45%", borderRadius: 6 }} />
    </div>
  );
}

/** Conteneur annoncé aux lecteurs d'écran comme zone en cours de chargement. */
export function SkelRegion({
  label,
  children,
  style,
  className,
}: {
  label: string;
  children: React.ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}
