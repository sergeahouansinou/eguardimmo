'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, IconButton } from '@eguardimmo/ui';
import { ConfirmDialog, EmptyBlock, pushFlash } from '../kit';
import { formatDateFr } from '../analytique/format';
import { FREQUENCIES } from './schemas';
import type { Schedule } from './schemas';
import { useRemoveSchedule } from './source';

const frequencyLabel = (frequency: Schedule['frequency']): string => FREQUENCIES.find((item) => item.value === frequency)?.label ?? frequency;

export function SchedulesDialog({ open, onOpenChange, schedules }: { open: boolean; onOpenChange: (open: boolean) => void; schedules: readonly Schedule[] }) {
  const [target, setTarget] = useState<Schedule | null>(null);
  const remove = useRemoveSchedule();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Envois programmés" description="Rapports envoyés automatiquement par e-mail." className="max-w-xl">
          <div className="flex flex-col gap-2 p-4">
            {schedules.length === 0 ? (
              <EmptyBlock title="Aucun envoi programmé">Programmez un envoi depuis la page d’un rapport.</EmptyBlock>
            ) : (
              <ul className="flex flex-col">
                {schedules.map((schedule) => (
                  <li key={schedule.id} className="flex min-h-14 items-center gap-3 border-t border-line first:border-t-0">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-body-strong text-fg">{schedule.label}</b>
                      <span className="truncate text-caption text-fg-subtle">
                        {`${frequencyLabel(schedule.frequency)} à ${schedule.recipient}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-caption text-fg-muted">{`Prochain : ${formatDateFr(schedule.nextRun)}`}</span>
                    <IconButton label={`Supprimer l’envoi de ${schedule.label}`} icon={Trash2} onClick={() => { setTarget(schedule); }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(next) => { if (!next) setTarget(null); }}
        title="Supprimer cet envoi programmé ?"
        description={target ? `${target.label} ne sera plus envoyé à ${target.recipient}.` : ''}
        confirmLabel="Supprimer l’envoi"
        pending={remove.isPending}
        onConfirm={() => {
          if (!target) return;
          remove.mutate(target.id, {
            onSuccess: () => {
              pushFlash('Envoi programmé supprimé.');
              setTarget(null);
            },
          });
        }}
      />
    </>
  );
}
