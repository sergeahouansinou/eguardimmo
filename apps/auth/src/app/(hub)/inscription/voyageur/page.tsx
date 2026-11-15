import type { Metadata } from "next";
import { VoyageurRegister } from "@/features/inscription/RegisterForms";

export const metadata: Metadata = { title: "Créer mon compte voyageur" };

export default function Page() {
  return <VoyageurRegister />;
}
