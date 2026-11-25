'use client';

import { Alert, Button, Card, Checkbox, Chip, Select, Switch, TextField } from '@eguardimmo/ui';
import { useId, useState } from 'react';
import { formatDateTime, plural } from '@/lib/format';
import { describeProblem } from '@/platform/errors';
import type { Reminder } from '@/platform/notificationSettings/notificationSettings';
import { useNotify } from '@/ui/notify';
import { useUpdateReminder } from './hooks';
import {
  DELAY_PRESETS,
  REPEAT_MAX,
  REPEAT_MIN,
  channelLabel,
  draftOf,
  inputOf,
  timingLabel,
  validateReminder,
  withRepetition,
} from './reminderForm';
import type { ReminderDraft, ReminderErrors } from './reminderForm';

function lastRun(reminder: Reminder): string {
  if (reminder.last_run_at === null) return 'Aucun passage pour l’instant.';
  const sent = reminder.last_sent_count === null ? '' : ` : ${plural(reminder.last_sent_count, 'rappel envoyé', 'rappels envoyés')}`;
  return `Dernier passage le ${formatDateTime(reminder.last_run_at)}${sent}.`;
}

export function ReminderCard({ reminder }: { reminder: Reminder }) {
  const notify = useNotify();
  const update = useUpdateReminder();
  const [edited, setEdited] = useState<ReminderDraft | null>(null);
  const [errors, setErrors] = useState<ReminderErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const channelsId = useId();
  const titleId = useId();
  const draft = edited ?? draftOf(reminder);
  const dirty = edited !== null && JSON.stringify(inputOf(edited, reminder)) !== JSON.stringify(inputOf(draftOf(reminder), reminder));
  const presets = DELAY_PRESETS.filter((days) => days >= reminder.delay_min && days <= reminder.delay_max);

  const change = (next: ReminderDraft) => {
    setEdited(next);
    setErrors({});
    setFailure(null);
  };

  const save = async () => {
    const found = validateReminder(draft, reminder);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    try {
      await update.mutateAsync({ code: reminder.code, input: inputOf(draft, reminder) });
      setEdited(null);
      notify.success('Rappel enregistré', reminder.label);
    } catch (error) {
      const problem = describeProblem(error);
      setFailure(problem.code === 'reminder_not_found' ? 'Ce rappel n’existe plus sur le serveur. Rechargez la page.' : problem.message);
    }
  };

  return (
    <Card role="region" aria-labelledby={titleId} className="px-4 py-3">
      <form
        noValidate
        aria-labelledby={titleId}
        className="flex min-w-0 flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-60">
            <h3 id={titleId} className="text-body-strong">{reminder.label}</h3>
            <p className="text-caption text-fg-subtle">{reminder.description}</p>
          </div>
          <Switch label="Activé" aria-label={`Activer : ${reminder.label}`} checked={draft.enabled} onCheckedChange={(enabled) => { change({ ...draft, enabled }); }} />
        </div>
        <div className="grid items-start gap-3 md:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-2">
            <TextField
              label="Délai (jours)"
              placeholder="7"
              type="number"
              min={reminder.delay_min}
              max={reminder.delay_max}
              hint={`Envoi ${timingLabel(reminder.timing, draft.delay)} (de ${String(reminder.delay_min)} à ${String(reminder.delay_max)}).`}
              error={errors.delay}
              value={draft.delay}
              onChange={(event) => { change({ ...draft, delay: event.target.value }); }}
            />
            {presets.length > 0 ? (
              <div role="group" aria-label={`Délais courants : ${reminder.label}`} className="flex flex-wrap gap-2">
                {presets.map((days) => (
                  <Chip key={days} pressed={draft.delay === String(days)} onClick={() => { change({ ...draft, delay: String(days) }); }}>
                    {days} jours
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Select
              label="Répétition"
              placeholder="Répétition"
              options={[{ value: 'none', label: 'Aucune répétition' }, { value: 'every', label: 'Tous les N jours' }]}
              value={draft.repeats ? 'every' : 'none'}
              onValueChange={(value) => { change(withRepetition(draft, value === 'every')); }}
            />
            {draft.repeats ? (
              <TextField
                label="Intervalle (jours)"
                placeholder="7"
                type="number"
                min={REPEAT_MIN}
                max={REPEAT_MAX}
                error={errors.repeatEvery}
                value={draft.repeatEvery}
                onChange={(event) => { change({ ...draft, repeatEvery: event.target.value }); }}
              />
            ) : null}
          </div>
          <TextField
            label="Nombre maximal d’envois"
            placeholder="1"
            type="number"
            min={1}
            max={reminder.occurrences_limit}
            disabled={!draft.repeats}
            hint={draft.repeats ? `De 1 à ${String(reminder.occurrences_limit)}.` : 'Un seul envoi sans répétition.'}
            error={errors.occurrences}
            value={draft.repeats ? draft.occurrences : '1'}
            onChange={(event) => { change({ ...draft, occurrences: event.target.value }); }}
          />
        </div>
        <div role="group" aria-labelledby={channelsId} className="flex flex-col gap-1">
          <span id={channelsId} className="text-caption text-fg-muted">Canaux</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {reminder.available_channels.map((channel) => (
              <Checkbox
                key={channel}
                label={channelLabel(channel)}
                checked={draft.channels.includes(channel)}
                onChange={(event) => {
                  const others = draft.channels.filter((entry) => entry !== channel);
                  change({ ...draft, channels: event.target.checked ? [...others, channel] : others });
                }}
              />
            ))}
          </div>
          {errors.channels ? <p role="alert" className="text-caption text-fg-danger">{errors.channels}</p> : null}
        </div>
        {failure ? <Alert tone="danger" title="Le rappel n’a pas été enregistré">{failure}</Alert> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
          <p className="text-caption text-fg-subtle">{lastRun(reminder)}</p>
          <div className="flex gap-2">
            {dirty ? (
              <Button variant="ghost" size="sm" disabled={update.isPending} onClick={() => { setEdited(null); setErrors({}); setFailure(null); }}>
                Annuler
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={!dirty} loading={update.isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
