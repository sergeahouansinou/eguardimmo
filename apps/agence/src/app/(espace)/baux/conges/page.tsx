import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { CongesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Demandes de congé" };

export default function Page() {
  return <ApiOnly><CongesScreen /></ApiOnly>;
}
