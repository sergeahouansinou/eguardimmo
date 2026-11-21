import type { Metadata } from "next";
import { BanqueImportApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Importer un relevé" };

export default function Page() {
  return <ApiOnly><BanqueImportApiScreen /></ApiOnly>;
}
