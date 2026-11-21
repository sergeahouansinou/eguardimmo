import type { Metadata } from "next";
import { ChargesExerciceFormApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Nouvel exercice de charges" };

export default function Page() {
  return <ApiOnly><ChargesExerciceFormApiScreen /></ApiOnly>;
}
