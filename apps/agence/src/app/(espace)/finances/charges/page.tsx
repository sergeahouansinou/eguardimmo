import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { ChargesExercicesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Régularisation des charges" };

export default function Page() {
  return <ApiOnly><ChargesExercicesScreen /></ApiOnly>;
}
