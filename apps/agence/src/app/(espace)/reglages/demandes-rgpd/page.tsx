import type { Metadata } from "next";
import { PrivacyRequestsPage } from "@/features/rgpd/PrivacyRequestsPage";

export const metadata: Metadata = { title: "Réglages, demandes RGPD" };

export default function Page() {
  return <PrivacyRequestsPage />;
}
