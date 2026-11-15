import type { ChannelKey, EventKey } from "./notificationSchemas";

interface EventItem {
  key: EventKey;
  label: string;
  hint: string;
}

export const EVENT_GROUPS: readonly { title: string; items: readonly EventItem[] }[] = [
  {
    title: "Finances",
    items: [
      { key: "unpaidRent", label: "Loyer impayé", hint: "Dès le 5 du mois pour chaque locataire en retard" },
      { key: "paymentReceived", label: "Encaissement reçu", hint: "À chaque virement rapproché" },
      { key: "payoutDone", label: "Reversement effectué", hint: "Récapitulatif par mandant" },
    ],
  },
  {
    title: "Mandats et conformité",
    items: [
      { key: "mandateExpiring", label: "Mandat arrivant à échéance", hint: "90 jours avant la date de fin" },
      { key: "complianceRenewal", label: "Pièce de conformité à renouveler", hint: "Carte professionnelle, garantie financière, assurance RCP" },
      { key: "newMandant", label: "Nouveau mandant", hint: "Mandat signé par un nouveau mandant" },
    ],
  },
  {
    title: "Suivi",
    items: [
      { key: "newMessage", label: "Nouveau message", hint: "Mandant ou locataire" },
      { key: "newIntervention", label: "Nouvelle intervention", hint: "Signalement d'un locataire" },
      { key: "quoteReceived", label: "Devis reçu", hint: "Un intervenant envoie un devis" },
      { key: "ownerApproval", label: "Accord du mandant", hint: "Réponse à un devis soumis" },
    ],
  },
];

export const CHANNEL_ITEMS: readonly { key: ChannelKey; label: string; hint: string | null }[] = [
  { key: "email", label: "E-mail", hint: null },
  { key: "app", label: "Application", hint: "Cloche de l'en-tête" },
  { key: "mobile", label: "Mobile", hint: "Notification sur le téléphone" },
];
