"use client";

import { Button } from "@eguardimmo/ui";
import { useState } from "react";
import { errorMessage, useConfie, useSavePreferences } from "../data/queries";
import type { ConfieData, Preference } from "../data/schemas";
import { AccountTabs } from "../ui/AccountTabs";
import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { QueryBoundary } from "../ui/States";
import { Toggle } from "../ui/Toggle";
import { useToast } from "../ui/Toast";

export function NotificationsScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Notifications key={JSON.stringify(data.preferences)} data={data} />}</QueryBoundary>;
}

type Channel = "email" | "push";

function Notifications({ data }: { data: ConfieData }) {
  const { notify } = useToast();
  const save = useSavePreferences();
  const [draft, setDraft] = useState<Preference[]>(data.preferences);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.preferences);

  const toggle = (id: string, channel: Channel, value: boolean) => {
    setDraft(draft.map((item) => (item.id === id ? { ...item, [channel]: value } : item)));
  };

  const submit = async () => {
    try {
      await save.mutateAsync(draft.map(({ id, email, push }) => ({ id, email, push })));
      notify("Vos préférences de notification sont enregistrées.");
    } catch (error) {
      notify(errorMessage(error), "danger");
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        crumbs={[{ label: "Mes informations" }, { label: "Notifications" }]}
        subtitle="Choisissez comment être prévenu des événements de votre mandat."
      />
      <AccountTabs current="notifications" />
      <Section title="Préférences">
        <ul aria-label="Préférences de notification" className="flex flex-col">
          {draft.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0">
              <span className="flex min-w-48 flex-1 flex-col">
                <b className="text-body-strong text-fg">{item.label}</b>
                <span className="text-caption text-fg-subtle">{item.detail}</span>
              </span>
              <span className="flex items-center gap-2 text-body text-fg-muted">
                <Toggle label={`E-mail, ${item.label}`} checked={item.email} onCheckedChange={(value) => { toggle(item.id, "email", value); }} />
                E-mail
              </span>
              <span className="flex items-center gap-2 text-body text-fg-muted">
                <Toggle label={`Notification, ${item.label}`} checked={item.push} onCheckedChange={(value) => { toggle(item.id, "push", value); }} />
                Notification
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" disabled={!dirty || save.isPending} onClick={() => { setDraft(data.preferences); }}>Annuler les changements</Button>
          <Button disabled={!dirty} loading={save.isPending} onClick={() => { void submit(); }}>Enregistrer mes préférences</Button>
        </div>
      </Section>
    </>
  );
}
