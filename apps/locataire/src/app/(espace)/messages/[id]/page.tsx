import { ConversationPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { conversationIds } from "@/data/staticParams";

export const metadata: Metadata = { title: "Conversation" };

export function generateStaticParams() {
  return conversationIds();
}

export default function Page({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const { id } = await params;
  return <ConversationPage conversationId={id} />;
}
