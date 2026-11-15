import { LotForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouveau lot" };

export default function Page() {
  return <LotForm />;
}
