import { CompteApiPage } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { ProfilePage } from "@/features/compte/ProfilePage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Mon compte" };

export default function Page() {
  return dataSource === "api" ? <CompteApiPage /> : <ProfilePage />;
}
