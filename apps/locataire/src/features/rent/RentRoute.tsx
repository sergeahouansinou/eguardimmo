import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { isUuid } from "@/tenant/ids";
import { InstallmentDetailScreen } from "./InstallmentDetailScreen";
import { PaymentDetailScreen } from "./PaymentDetailScreen";
import { ReceiptDetailScreen } from "./ReceiptDetailScreen";

const SCREENS = {
  echeance: InstallmentDetailScreen,
  quittance: ReceiptDetailScreen,
  paiement: PaymentDetailScreen,
} as const;

export async function RentRoute({ kind, params }: { kind: keyof typeof SCREENS; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  const Screen = SCREENS[kind];
  return <Screen id={id} />;
}
