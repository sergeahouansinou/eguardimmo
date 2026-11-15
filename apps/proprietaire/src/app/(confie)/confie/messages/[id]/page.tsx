import { ConversationPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { conversationIds } from "@/features/messagerie/staticParams";

export const metadata: Metadata = { title: "Conversation" };

export function generateStaticParams() {
  return conversationIds("proprietaire");
}

export default function Page({ params }: PageProps<"/confie/messages/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/confie/messages/[id]">, "params">) {
  const { id } = await params;
  return <ConversationPage conversationId={id} />;
}
