import { ConversationPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { conversationIds } from "@/features/messagerie/staticParams";

export const metadata: Metadata = { title: "Conversation" };

export function generateStaticParams() {
  return conversationIds("bailleur");
}

export default function Page({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const { id } = await params;
  return <ConversationPage conversationId={id} />;
}
