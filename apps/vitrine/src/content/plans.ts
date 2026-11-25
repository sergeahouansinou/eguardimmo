export type PlanId = "essentiel" | "agence" | "reseau";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  highlight: boolean;
  pricing: "configurable" | "quote";
  cta: string;
}

export const PLANS: readonly PlanDefinition[] = [
  { id: "essentiel", name: "Essentiel", description: "Pour démarrer avec quelques biens.", highlight: false, pricing: "configurable", cta: "Voir une démonstration" },
  { id: "agence", name: "Agence", description: "Mandats, fonds des mandants et équipe.", highlight: true, pricing: "configurable", cta: "Voir une démonstration" },
  { id: "reseau", name: "Réseau", description: "Plusieurs organisations et besoins sur mesure.", highlight: false, pricing: "quote", cta: "Nous contacter" },
];

export const CONFIGURABLE_PLAN_IDS = ["essentiel", "agence"] as const;
