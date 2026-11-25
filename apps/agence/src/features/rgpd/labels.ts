import type { RequestKind } from "./schemas";

export const KIND_LABELS: Readonly<Record<RequestKind, string>> = {
  access: "Accès aux données",
  rectification: "Rectification",
  erasure: "Effacement",
  portability: "Portabilité",
  restriction: "Limitation du traitement",
  objection: "Opposition",
};

export const KIND_HELP: Readonly<Record<RequestKind, string>> = {
  access: "Fournir à la personne une copie des données que vous détenez sur elle.",
  rectification: "Corriger les données inexactes ou incomplètes.",
  erasure: "Supprimer ou anonymiser les données, sauf celles que la loi vous oblige à conserver (baux, pièces comptables).",
  portability: "Remettre les données fournies par la personne dans un format structuré.",
  restriction: "Suspendre l’usage des données pendant l’examen de la demande.",
  objection: "Cesser le traitement concerné, sauf motif légitime impérieux.",
};

export const IRREVERSIBLE_KINDS: readonly RequestKind[] = ["erasure"];
