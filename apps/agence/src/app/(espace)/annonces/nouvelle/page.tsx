import type { Metadata } from "next";
import { NewListingPage } from "@/features/annonces/NewListingPage";

export const metadata: Metadata = { title: "Nouvelle annonce" };

export default function Page() {
  return <NewListingPage />;
}
