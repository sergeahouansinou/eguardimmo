import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { EquipeInviteScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Inviter un collaborateur" };

export default function Page() {
  return (
    <ApiOnly>
      <EquipeInviteScreen />
    </ApiOnly>
  );
}
