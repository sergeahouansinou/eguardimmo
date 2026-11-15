import type { Metadata } from "next";
import { BailleurRegister } from "@/features/inscription/RegisterForms";

export const metadata: Metadata = { title: "Créer mon espace bailleur" };

export default function Page() {
  return <BailleurRegister />;
}
