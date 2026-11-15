'use client';

import { Fragment } from 'react';
import { Select } from '@eguardimmo/ui';
import { Checkbox, DataTable, QueryState, Td, Th } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { FormAlerts } from '../shared/FormAlerts';
import { SettingRow, SettingsCard } from '../shared/SettingRow';
import { SettingsLayout } from '../shared/SettingsLayout';
import { Toggle } from '../shared/Toggle';
import { digestOptions } from './options';
import { narrow } from '../shared/narrow';
import { CHANNELS, CHANNEL_LABELS, DIGESTS, NOTIFICATION_GROUPS, notificationsSchema } from './schemas';
import type { Channel, NotificationsSettings } from './schemas';
import { useNotificationsSettings, useSaveNotifications } from './source';
import { useSettingsForm } from '../shared/useSettingsForm';

type Update = (patch: Partial<NotificationsSettings>) => void;

function EventsCard({ value, update }: { value: NotificationsSettings; update: Update }) {
  const setChannel = (eventId: string, channel: Channel, checked: boolean) => {
    update({
      events: value.events.map((entry) => (entry.id === eventId ? { ...entry, channels: { ...entry.channels, [channel]: checked } } : entry)),
    });
  };
  return (
    <SettingsCard id="rn-ev" title="Événements" aside={<span className="text-caption text-fg-subtle">{`${String(value.events.length)} événements`}</span>}>
      <DataTable caption="Canaux de notification par événement">
        <thead>
          <tr>
            <Th>Événement</Th>
            {CHANNELS.map((channel) => (
              <Th key={channel} className="w-24">
                <span className="block text-center">{CHANNEL_LABELS[channel]}</span>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_GROUPS.map((group) => (
            <Fragment key={group}>
              <tr>
                <th colSpan={4} scope="colgroup" className="h-8 border-b border-line bg-muted px-2 text-left text-caption font-medium text-fg-muted">
                  {group}
                </th>
              </tr>
              {value.events
                .filter((entry) => entry.group === group)
                .map((entry) => (
                  <tr key={entry.id}>
                    <Td strong>{entry.label}</Td>
                    {CHANNELS.map((channel) => (
                      <Td key={channel} className="text-center">
                        <Checkbox
                          hideLabel
                          label={`${entry.label}, ${CHANNEL_LABELS[channel]}`}
                          checked={entry.channels[channel]}
                          onCheckedChange={(checked) => { setChannel(entry.id, channel, checked); }}
                        />
                      </Td>
                    ))}
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </DataTable>
    </SettingsCard>
  );
}

function SideCards({ value, update }: { value: NotificationsSettings; update: Update }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SettingsCard id="rn-res" title="Résumé par e-mail">
        <div>
          <SettingRow title="Fréquence">
            <Select
              label="Fréquence du résumé"
              hideLabel
              placeholder="Choisir"
              className="w-full sm:w-[148px]"
              options={digestOptions}
              value={value.digest}
              onValueChange={(next) => {
                const digest = narrow(DIGESTS, next);
                if (digest) update({ digest });
              }}
            />
          </SettingRow>
          <SettingRow title="Heures de silence" hint="22:00 à 07:00, mobile uniquement">
            <Toggle label="Heures de silence" checked={value.quietHours} onCheckedChange={(quietHours) => { update({ quietHours }); }} />
          </SettingRow>
        </div>
      </SettingsCard>
      <SettingsCard id="rn-com" title="Informations eGuardImmo">
        <div>
          <SettingRow title="Nouveautés du produit">
            <Toggle label="Nouveautés du produit" checked={value.productNews} onCheckedChange={(productNews) => { update({ productNews }); }} />
          </SettingRow>
          <SettingRow title="Lettre mensuelle">
            <Toggle label="Lettre mensuelle" checked={value.monthlyLetter} onCheckedChange={(monthlyLetter) => { update({ monthlyLetter }); }} />
          </SettingRow>
          <SettingRow title="Offres partenaires">
            <Toggle label="Offres partenaires" checked={value.partnerOffers} onCheckedChange={(partnerOffers) => { update({ partnerOffers }); }} />
          </SettingRow>
        </div>
      </SettingsCard>
    </div>
  );
}

export function ReglagesNotificationsPage({ Link }: ScreenProps) {
  const query = useNotificationsSettings();
  const save = useSaveNotifications();
  const form = useSettingsForm({
    saved: query.data,
    schema: notificationsSchema,
    save: (value) => save.mutateAsync(value),
    success: 'Réglages des notifications enregistrés.',
  });
  return (
    <SettingsLayout
      Link={Link}
      section="notifications"
      description="Choisissez quels événements vous alertent, et par quel canal."
      onCancel={form.reset}
      onSave={form.submit}
      saving={form.saving}
    >
      <FormAlerts errors={form.errors} failed={form.failed} failureTitle="Les réglages n'ont pas pu être enregistrés" />
      <QueryState query={query} errorTitle="Les réglages n'ont pas pu être chargés" loadingLabel="Chargement des réglages">
        {() =>
          form.value ? (
            <div className="grid grid-cols-1 items-start gap-3 min-[1400px]:grid-cols-[minmax(0,1fr)_300px]">
              <EventsCard value={form.value} update={form.update} />
              <SideCards value={form.value} update={form.update} />
            </div>
          ) : null
        }
      </QueryState>
    </SettingsLayout>
  );
}
