import { RelevesScreen } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Relevés de compteurs" };

export default function Page() {
  return <RelevesScreen />;
}
