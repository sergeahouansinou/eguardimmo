import type { Metadata } from "next";
import { ConformiteScreen } from "@/features/conformite/screens";
import { ApiOnly } from "@/features/loyers/ApiOnly";

export const metadata: Metadata = { title: "Conformité" };

export default function Page() {
  return (
    <ApiOnly>
      <ConformiteScreen />
    </ApiOnly>
  );
}
