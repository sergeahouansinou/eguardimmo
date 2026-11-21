"use client";

import { ExternalInboxPage, ExternalNewThreadPage } from "@eguardimmo/messagerie";
import { useSearchParams } from "next/navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function InboxScreen() {
  return <ExternalInboxPage />;
}

export function NewMessageScreen() {
  const access = useSearchParams().get("acces");
  return <ExternalNewThreadPage {...(access !== null && UUID.test(access) ? { initialOptionId: access } : {})} />;
}
