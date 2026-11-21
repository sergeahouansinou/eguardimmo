"use client";

import { InboxPage, StaffInboxPage, StaffSectionNav, StaffThreadPage, useStaffConfig } from "@eguardimmo/messagerie";
import { useSearchParams } from "next/navigation";

export function ApiMessagesHome() {
  const { capabilities } = useStaffConfig();
  const section = useSearchParams().get("section");
  if (!capabilities.readExternal) return <InboxPage />;
  const kind = section === "mandants" && capabilities.kinds.includes("owner") ? "owner" : "tenant";
  return <StaffInboxPage kind={kind} />;
}

export function ApiTeamInbox() {
  const { capabilities } = useStaffConfig();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {capabilities.readExternal ? <StaffSectionNav current="team" /> : null}
      <InboxPage />
    </div>
  );
}

export function ApiThreadScreen({ id }: { id: string }) {
  const { capabilities } = useStaffConfig();
  if (!capabilities.readExternal) return <p role="alert" className="text-body text-fg-muted">Votre rôle ne donne pas accès aux conversations avec les locataires et les mandants.</p>;
  return <StaffThreadPage threadId={id} />;
}
