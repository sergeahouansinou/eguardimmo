import { NewMessagePage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Nouveau message" };

export default function Page({ searchParams }: PageProps<"/messages/nouveau">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Screen searchParams={searchParams} />
    </Suspense>
  );
}

async function Screen({ searchParams }: Pick<PageProps<"/messages/nouveau">, "searchParams">) {
  const { destinataire } = await searchParams;
  return <NewMessagePage {...(typeof destinataire === "string" ? { initialRecipientId: destinataire } : {})} />;
}
