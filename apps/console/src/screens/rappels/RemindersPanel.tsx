'use client';

import { EmptyState } from '@eguardimmo/ui';
import { BellRing } from 'lucide-react';
import { PlatformState } from '@/ui/PlatformState';
import { groupBy } from './groupBy';
import { useReminders } from './hooks';
import { ReminderCard } from './ReminderCard';

export function RemindersPanel() {
  const reminders = useReminders();
  return (
    <PlatformState query={reminders} label="Le catalogue des rappels">
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState icon={BellRing} title="Aucun rappel" description="Le serveur ne propose aucun rappel automatique." />
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-body text-fg-muted">
              Les rappels partent chaque jour à 9 h. Chaque destinataire peut les désactiver. Activer un rappel ne relance pas les situations anciennes.
            </p>
            {groupBy(rows, (row) => row.category_label).map((group) => (
              <section key={group.key} aria-label={`Rappels : ${group.key}`} className="flex flex-col gap-3">
                <h2 className="text-block-title">{group.key}</h2>
                {group.items.map((reminder) => <ReminderCard key={reminder.code} reminder={reminder} />)}
              </section>
            ))}
          </div>
        )
      }
    </PlatformState>
  );
}
