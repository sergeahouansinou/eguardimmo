'use client';

import { ConfirmDialog } from '@eguardimmo/ui';
import type { LibraryEntry } from './model';

export function ArchiveConfirm({ entry, pending, onCancel, onConfirm }: { entry: LibraryEntry | null; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      open={entry !== null}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title="Archiver ce document ?"
      description={entry === null ? '' : `« ${entry.file.name} » quitte la liste des documents actifs. Rien n’est supprimé : vous pourrez le restaurer depuis les archives.`}
      confirmLabel="Archiver"
      loading={pending}
      onConfirm={onConfirm}
    />
  );
}
