import type { Metadata } from "next";
import { AnnoncesPage } from "@/features/annonces/AnnoncesPage";

export const metadata: Metadata = { title: "Annonces" };

export default function Page() {
  return <AnnoncesPage />;
}
