import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TransmissionDownloadScreen } from "@/features/transmission/TransmissionDownloadScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Pièces d’un dossier", referrer: "no-referrer", robots: { index: false, follow: false } };

async function Download({ params }: PageProps<"/transmission/[jeton]">) {
  if (dataSource !== "api") notFound();
  const { jeton } = await params;
  return <TransmissionDownloadScreen urlToken={jeton} />;
}

export default function Page(props: PageProps<"/transmission/[jeton]">) {
  return (
    <Suspense fallback={null}>
      <Download {...props} />
    </Suspense>
  );
}
