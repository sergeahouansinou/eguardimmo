import type { Metadata } from "next";
import FavoritesView from "@/components/roost/compte/FavoritesView";

export const metadata: Metadata = { title: "Mes favoris", robots: { index: false, follow: false } };

export default function FavoritesPage() {
  return <FavoritesView />;
}
