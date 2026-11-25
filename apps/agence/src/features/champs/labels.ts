import type { Entity, FieldType, Vocabulary } from "./schemas";

export const ENTITY_LABELS: Readonly<Record<Entity, string>> = {
  unit: "Lots",
  property: "Biens",
  party: "Contacts",
  lease: "Baux",
  mandate: "Mandats",
  equipment: "Équipements",
  intervention: "Interventions",
};

export const TYPE_LABELS: Readonly<Record<FieldType, string>> = {
  text: "Texte",
  number: "Nombre",
  money: "Montant",
  date: "Date",
  bool: "Oui ou non",
  select: "Choix unique",
  multiselect: "Choix multiples",
  term: "Valeur d’un référentiel",
  url: "Lien web",
};

export const VOCABULARY_LABELS: Readonly<Record<Vocabulary, string>> = {
  legal_form: "Formes juridiques",
  contact_category: "Catégories de contact",
  unit_type: "Types de lot",
  lease_component: "Composantes de bail",
  certificate_type: "Types de diagnostic",
  expense_category: "Catégories de dépense",
  mandate_type: "Types de mandat",
  invoice_item: "Lignes de facture",
  tax_rate: "Taux de TVA",
  intervention_nature: "Natures d’intervention",
  charge_rubric: "Rubriques de charges",
};

export const CHOICE_TYPES: readonly FieldType[] = ["select", "multiselect"];
