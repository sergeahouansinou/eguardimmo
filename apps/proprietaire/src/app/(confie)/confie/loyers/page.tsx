import type { Metadata } from "next";
import { LoyersScreen } from "@/features/confie/screens/LoyersScreen";
import { dataSource } from "@/lib/env";
import { LoyersScreen as ApiLoyersScreen } from "@/owner/rent/RentScreens";

export const metadata: Metadata = { title: "Loyers et reversements" };

export default function Page() {
  return dataSource === "api" ? <ApiLoyersScreen /> : <LoyersScreen />;
}
