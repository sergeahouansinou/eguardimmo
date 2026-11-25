import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Reservation from "@/components/roost/Reservation";
import { publicRefSchema } from "@/marketplace/schemas";

export const metadata: Metadata = { title: "Demande de réservation", robots: { index: false, follow: false } };

async function ReservationRoute({ params }: { params: PageProps<"/listings/[ref]/reserve">["params"] }) {
  const { ref } = await params;
  if (!publicRefSchema.safeParse(ref).success) notFound();
  return <Reservation publicRef={ref} />;
}

export default function ReservePage({ params }: PageProps<"/listings/[ref]/reserve">) {
  return (
    <Suspense fallback={null}>
      <ReservationRoute params={params} />
    </Suspense>
  );
}
