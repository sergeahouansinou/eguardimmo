import type { Metadata } from "next";
import { ApiOnly } from "@/owner/ApiOnly";
import { LeasesScreen } from "@/owner/leases/LeasesScreen";

export const metadata: Metadata = { title: "Baux" };

export default function Page() {
  return (
    <ApiOnly>
      <LeasesScreen />
    </ApiOnly>
  );
}
