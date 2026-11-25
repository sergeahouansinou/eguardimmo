import { ProfilePage } from "@/components/ProfilePage";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ title: "Agences", description: "Logiciel de gestion locative pour agences : baux, loyers, mandats, fonds des mandants et équipe.", path: "/agences" });

export default function Page() {
  return <ProfilePage profileKey="agence" />;
}
