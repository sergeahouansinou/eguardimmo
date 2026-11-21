import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { BanqueImportScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Importer un relevé" };

export default function Page() {
  return <ApiOnly><BanqueImportScreen /></ApiOnly>;
}
