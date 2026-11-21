import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { TachesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Tâches et rappels" };

export default function Page() {
  return <ApiOnly><TachesScreen /></ApiOnly>;
}
