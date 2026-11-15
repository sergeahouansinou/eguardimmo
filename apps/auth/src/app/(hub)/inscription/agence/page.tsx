import type { Metadata } from "next";
import { AgenceRegister } from "@/features/inscription/RegisterForms";

export const metadata: Metadata = { title: "Créer mon agence" };

export default function Page() {
  return <AgenceRegister />;
}
