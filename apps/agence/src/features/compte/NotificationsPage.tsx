"use client";

import { Card, CardHeader, CardTitle } from "@eguardimmo/ui";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { FormSelect, FormSwitch, SettingsPage, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { useNotifications, useSaveNotifications } from "./hooks";
import { CHANNEL_ITEMS, EVENT_GROUPS } from "./notificationGroups";
import { DIGEST_OPTIONS, notificationPrefsSchema } from "./notificationSchemas";
import type { NotificationsView } from "./notificationSchemas";

function NotificationsForm({ view }: { view: NotificationsView }) {
  const notify = useNotify();
  const save = useSaveNotifications();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError, formState } = useSchemaForm(notificationPrefsSchema, view.prefs);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save.mutateAsync(values);
      reset(values);
      notify.success("Notifications enregistrées");
    } catch (error) {
      setFormError(applyServerError(setError, error));
    }
  });

  return (
    <SettingsPage
      currentHref="/compte/notifications"
      subtitle="Choisissez les événements qui vous alertent, et par quel canal."
      onSubmit={(event) => void submit(event)}
      onCancel={() => {
        reset(view.prefs);
        setFormError(null);
      }}
      dirty={formState.isDirty}
      saving={save.isPending}
      formError={formError}
    >
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {EVENT_GROUPS.map((group) => (
            <Card key={group.title} role="region" aria-label={group.title}>
              <CardHeader>
                <CardTitle as="h2">{group.title}</CardTitle>
              </CardHeader>
              {group.items.map((item) => (
                <FormSwitch key={item.key} control={control} name={`events.${item.key}`} label={item.label} hint={item.hint} />
              ))}
            </Card>
          ))}
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Canaux">
            <CardHeader>
              <CardTitle as="h2">Canaux</CardTitle>
            </CardHeader>
            {CHANNEL_ITEMS.map((item) => (
              <FormSwitch key={item.key} control={control} name={`channels.${item.key}`} label={item.label} hint={item.hint ?? view.email} />
            ))}
          </Card>
          <Card role="region" aria-label="Résumé hebdomadaire">
            <CardHeader>
              <CardTitle as="h2">Résumé hebdomadaire</CardTitle>
            </CardHeader>
            <FormSelect control={control} name="digestFrequency" label="Fréquence" placeholder="Choisir une fréquence" options={DIGEST_OPTIONS} />
            <FormSwitch control={control} name="quietHours" label="Heures de silence" hint={view.quietHoursRange} />
          </Card>
        </aside>
      </div>
    </SettingsPage>
  );
}

export function NotificationsPage() {
  const query = useNotifications();
  return (
    <QueryState query={query} label="Les notifications">
      {(view) => <NotificationsForm view={view} />}
    </QueryState>
  );
}
