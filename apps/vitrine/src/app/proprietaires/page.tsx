import { ProfilePage } from "@/components/ProfilePage";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ title: "Propriétaires", description: "Espace propriétaire : relevés de gestion, reversements, documents et revenus fonciers.", path: "/proprietaires" });

export default function Page() {
  return <ProfilePage profileKey="proprietaire" />;
}
