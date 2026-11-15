'use client';

import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { bienLabel } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
import { reminderLabel } from './schemas';
import type { Task } from './schemas';

export function TaskDetailDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Dialog open={task !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {task ? (
        <DialogContent title={task.title} description="Détail de la tâche" className="max-w-md">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 p-4 text-body">
            <dt className="text-fg-subtle">Bien</dt>
            <dd>{bienLabel(task.bienId)}</dd>
            <dt className="text-fg-subtle">Assignée à</dt>
            <dd>{task.assignee}</dd>
            <dt className="text-fg-subtle">Échéance</dt>
            <dd>{formatFrDate(task.dueDate)}</dd>
            <dt className="text-fg-subtle">Rappel</dt>
            <dd>{reminderLabel(task.reminder)}</dd>
            <dt className="text-fg-subtle">État</dt>
            <dd>{task.done ? 'Terminée' : 'À faire'}</dd>
          </dl>
          <div className="flex justify-end p-4 pt-0">
            <DialogClose asChild>
              <Button variant="secondary">Fermer</Button>
            </DialogClose>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
