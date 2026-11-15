import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ReversementDetailPage } from "@/features/finances/reversements/ReversementDetailPage";
import { mandantIds } from "@/features/finances/ids";

export const metadata: Metadata = { title: "Reversement" };

export function generateStaticParams() {
  return mandantIds();
}

export default function Page({ params }: PageProps<"/finances/reversements/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/finances/reversements/[id]">, "params">) {
  const { id } = await params;
  return <ReversementDetailPage mandantId={id} />;
}
