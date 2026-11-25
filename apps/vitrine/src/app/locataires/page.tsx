import { ProfilePage } from "@/components/ProfilePage";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ title: "Locataires", description: "Espace locataire : loyers, quittances, demandes et messagerie avec l’agence.", path: "/locataires" });

export default function Page() {
  return <ProfilePage profileKey="locataire" />;
}
