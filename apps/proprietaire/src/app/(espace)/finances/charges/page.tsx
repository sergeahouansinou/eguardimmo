import type { Metadata } from "next";
import { ChargesExercicesApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Régularisation des charges" };

export default function Page() {
  return <ApiOnly><ChargesExercicesApiScreen /></ApiOnly>;
}
