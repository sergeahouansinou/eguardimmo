import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { ChargesExerciceFormScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Nouvel exercice de charges" };

export default function Page() {
  return <ApiOnly><ChargesExerciceFormScreen /></ApiOnly>;
}
