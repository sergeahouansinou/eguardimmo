import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { ApiTeamInbox } from "@/features/messagerie/MessagesScreens";

export const metadata: Metadata = { title: "Messages de l’équipe" };

export default function Page() {
  return (
    <ApiOnly>
      <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
        <ApiTeamInbox />
      </Suspense>
    </ApiOnly>
  );
}
