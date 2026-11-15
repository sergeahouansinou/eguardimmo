import type { Metadata } from "next";
import { ProfilePage } from "@/features/compte/ProfilePage";

export const metadata: Metadata = { title: "Mon compte" };

export default function Page() {
  return <ProfilePage />;
}
