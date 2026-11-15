import { ImmeubleForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouvel immeuble" };

export default function Page() {
  return <ImmeubleForm />;
}
