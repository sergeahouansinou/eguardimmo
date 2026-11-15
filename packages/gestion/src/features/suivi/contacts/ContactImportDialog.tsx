'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { CSV_MAX_BYTES, downloadTextFile, readFileText } from '../shared/csv';
import { DropZone } from '../shared/DropZone';
import { formatSize } from '../shared/files';
import { CONTACT_CSV_TEMPLATE, parseContactsCsv } from './importCsv';
import type { ContactImportReport } from './importCsv';
import type { ContactInput } from './schemas';

interface Loaded {
  fileName: string;
  report: ContactImportReport;
}

export function ContactImportDialog({
  open,
  pending,
  error,
  onClose,
  onImport,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onImport: (contacts: readonly ContactInput[]) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const close = () => {
    setLoaded(null);
    setProblem(null);
    onClose();
  };

  const pick = (files: File[]) => {
    const file = files[0];
    setLoaded(null);
    setProblem(null);
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setProblem(`« ${file.name} » n’est pas un fichier CSV.`);
      return;
    }
    if (file.size === 0) {
      setProblem(`« ${file.name} » est vide.`);
      return;
    }
    if (file.size > CSV_MAX_BYTES) {
      setProblem(`« ${file.name} » dépasse ${formatSize(CSV_MAX_BYTES)}.`);
      return;
    }
    readFileText(file).then(
      (text) => { setLoaded({ fileName: file.name, report: parseContactsCsv(text) }); },
      (reason: unknown) => { setProblem(reason instanceof Error ? reason.message : 'Le fichier n’a pas pu être lu.'); },
    );
  };

  const report = loaded?.report;
  const count = report?.accepted.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent title="Importer des contacts" description="Fichier CSV, une ligne par contact. Chaque ligne est contrôlée avant l’import." className="max-w-xl">
        <div className="flex flex-col gap-3 p-4">
          <DropZone
            title="Déposer le fichier CSV ici"
            hint="Séparateur point-virgule ou virgule, 500 lignes au maximum"
            buttonLabel="Choisir un fichier"
            inputLabel="Choisir le fichier CSV des contacts"
            accept=".csv,.txt,text/csv"
            multiple={false}
            onFiles={pick}
          />
          <Button
            variant="link"
            size="sm"
            className="self-start"
            onClick={() => { downloadTextFile('modele-contacts.csv', CONTACT_CSV_TEMPLATE); }}
          >
            Télécharger le modèle CSV
          </Button>
          {problem ? <Alert tone="danger" title="Fichier refusé">{problem}</Alert> : null}
          {error ? <Alert tone="danger" title="L’import n’a pas abouti">{error}</Alert> : null}
          {report?.fatal ? <Alert tone="danger" title="Fichier inexploitable">{report.fatal}</Alert> : null}
          {loaded && report && !report.fatal ? (
            <section aria-label="Résultat du contrôle" className="flex flex-col gap-2">
              <p role="status" className="text-body text-fg">
                <b>{loaded.fileName}</b> : {count} contact{count > 1 ? 's' : ''} prêt{count > 1 ? 's' : ''} à importer, {report.rejected.length} ligne{report.rejected.length > 1 ? 's' : ''} rejetée{report.rejected.length > 1 ? 's' : ''}.
              </p>
              {report.rejected.length > 0 ? (
                <ul aria-label="Lignes rejetées" className="flex max-h-48 flex-col gap-1 overflow-auto rounded-md border border-line p-2 text-caption text-fg-muted">
                  {report.rejected.map((row) => (
                    <li key={row.line}>
                      <b className="text-fg">Ligne {row.line}</b> : {row.reasons.join(' ')}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button
              loading={pending}
              disabled={count === 0}
              onClick={() => { if (report) onImport(report.accepted); }}
            >
              {count > 0 ? `Importer ${String(count)} contact${count > 1 ? 's' : ''}` : 'Importer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
