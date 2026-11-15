export interface Contractor {
  name: string;
  contact: string;
  phone: string;
}

export const CONTRACTORS: readonly Contractor[] = [
  { name: "Plomberie Sanvi", contact: "M. Sanvi", phone: "01 00 00 00 38" },
  { name: "Chauffage Martin", contact: "Mme Martin", phone: "01 00 00 00 41" },
  { name: "Électricité Bailly", contact: "M. Bailly", phone: "01 00 00 00 52" },
  { name: "Serrurerie Dupont", contact: "M. Dupont", phone: "01 00 00 00 63" },
  { name: "Peinture Lefèvre", contact: "Mme Lefèvre", phone: "01 00 00 00 74" },
  { name: "Menuiserie Roche", contact: "M. Roche", phone: "01 00 00 00 85" },
  { name: "Multiservices Azur", contact: "M. Azur", phone: "01 00 00 00 96" },
];

export function contractorByName(name: string): Contractor | undefined {
  return CONTRACTORS.find((contractor) => contractor.name === name);
}

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}
