import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { TacheFormScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Nouvelle tâche" };

export default function Page() {
  return <ApiOnly><TacheFormScreen /></ApiOnly>;
}
