import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { ReleveMandantApiScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Relevé d’un mandant" };

export default function Page() {
  return (
    <ApiOnly>
      <ReleveMandantApiScreen />
    </ApiOnly>
  );
}
