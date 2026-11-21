import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { EvenementFormScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Nouvel événement" };

export default function Page() {
  return <ApiOnly><EvenementFormScreen /></ApiOnly>;
}
