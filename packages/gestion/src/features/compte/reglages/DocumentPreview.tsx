'use client';

import { Eye, Printer } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, Icon, Select } from '@eguardimmo/ui';
import { SettingsCard } from '../shared/SettingRow';
import { DocumentPaper } from './DocumentPaper';
import type { DocumentKind } from './DocumentPaper';
import type { DocumentsSettings } from './schemas';

const KIND_OPTIONS = [
  { value: 'quittance', label: 'Quittance' },
  { value: 'avis', label: "Avis d'échéance" },
];

function Thumbnail({ settings }: { settings: DocumentsSettings }) {
  return (
    <div className="rounded-lg bg-muted px-6 py-4">
      <div aria-hidden="true" className="flex aspect-[210/297] w-full flex-col gap-2 border border-line-strong bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="size-4 rounded-sm bg-nav" />
          <i className="block h-[5px] w-2/5 rounded-xs bg-fg-muted" />
        </div>
        <i className="ml-auto block h-[5px] w-[35%] rounded-xs bg-line" />
        <i className="ml-auto block h-[5px] w-[28%] rounded-xs bg-line" />
        <i className="mt-1.5 block h-[5px] w-[55%] rounded-xs bg-fg-muted" />
        <i className="block h-[5px] rounded-xs bg-line" />
        {settings.chargesDetail ? <i className="block h-[5px] rounded-xs bg-line" /> : null}
        <i className="block h-[5px] w-4/5 rounded-xs bg-line" />
        <i className="mt-1.5 block h-[5px] rounded-xs bg-line" />
        {settings.tenantBalance ? <i className="block h-[5px] rounded-xs bg-line" /> : null}
        <i className="ml-auto block h-[5px] w-[30%] rounded-xs bg-fg-muted" />
        <div className="mt-auto flex items-center justify-between">
          {settings.qrCode ? (
            <span className="size-7 border-2 border-fg bg-[repeating-linear-gradient(90deg,var(--color-fg)_0_2px,white_2px_4px)]" />
          ) : (
            <span />
          )}
          <i className="block h-[5px] w-[30%] rounded-xs bg-line" />
        </div>
      </div>
    </div>
  );
}

export function DocumentPreview({ settings }: { settings: DocumentsSettings }) {
  const [kind, setKind] = useState<DocumentKind>('quittance');
  const [open, setOpen] = useState(false);
  return (
    <SettingsCard id="rd-ap" title="Aperçu">
      <Select
        label="Document à prévisualiser"
        hideLabel
        placeholder="Document"
        options={KIND_OPTIONS}
        value={kind}
        onValueChange={(value) => { setKind(value === 'avis' ? 'avis' : 'quittance'); }}
      />
      <Thumbnail settings={settings} />
      <Dialog open={open} onOpenChange={setOpen}>
        <Button variant="secondary" onClick={() => { setOpen(true); }}>
          <Icon icon={Eye} />
          Aperçu du PDF
        </Button>
        <DialogContent
          title={kind === 'quittance' ? 'Aperçu de la quittance' : "Aperçu de l'avis d'échéance"}
          description="Exemple avec les réglages en cours, non enregistrés."
          className="max-h-[90vh] w-[min(640px,calc(100vw-32px))]"
        >
          <div className="overflow-y-auto p-4">
            <DocumentPaper kind={kind} settings={settings} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
            <DialogClose asChild>
              <Button variant="secondary">Fermer</Button>
            </DialogClose>
            <Button onClick={() => { window.print(); }}>
              <Icon icon={Printer} />
              Imprimer ou enregistrer en PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
