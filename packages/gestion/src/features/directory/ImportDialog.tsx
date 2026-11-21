'use client';

import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { FilePicker, useGestionNavigation, useNotify } from '../locataires/kit';
import { ActionError } from '../orgapi/ActionError';
import { CSV_MAX_BYTES, downloadTextFile, readFileText } from '../suivi/shared/csv';
import { importFailureOf } from './api/failures';
import { useImportContacts } from './hooks';
import { CONTACT_CSV_TEMPLATE, parseContactsCsv } from './importCsv';
import type { ContactCsvReport, ImportCandidate } from './importCsv';
import { reasonsText } from './labels';
import type { ImportFailure } from './model';
import { directoryPaths } from './paths';

const MAX_SHOWN = 20;

const validateFile = (file: File): string | null => {
  if (!/\.(csv|txt)$/i.test(file.name)) return 'Ce fichier n’est pas un CSV.';
  if (file.size === 0) return 'Ce fichier est vide.';
  if (file.size > CSV_MAX_BYTES) return 'Ce fichier dépasse 1 Mo.';
  return null;
};

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Importer des contacts" description="Fichier CSV, une ligne par contact, 500 lignes au plus. Tout est importé ou rien : une ligne refusée par le serveur annule l’import.">
        {open ? <ImportForm onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ContactCsvReport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const attempt = useRef<{ signature: string; clientId: string } | null>(null);
  const importer = useImportContacts();
  const notify = useNotify();

  const pick = (next: File | null) => {
    setFile(next);
    setReport(null);
    setReadError(null);
    setFailure(null);
    setAllowDuplicates(false);
    if (next === null) return;
    readFileText(next).then(
      (text) => { setReport(parseContactsCsv(text)); },
      (reason: unknown) => { setReadError(reason instanceof Error ? reason.message : 'Le fichier n’a pas pu être lu.'); },
    );
  };

  const accepted = report?.accepted ?? [];

  const run = async () => {
    const rows = accepted.map((candidate) => candidate.row);
    const signature = JSON.stringify([rows, allowDuplicates]);
    if (attempt.current?.signature !== signature) attempt.current = { signature, clientId: globalThis.crypto.randomUUID() };
    setFailure(null);
    try {
      const result = await importer.mutateAsync({ rows, clientId: attempt.current.clientId, allowDuplicates });
      notify({ title: `${String(result.count)} contact${result.count > 1 ? 's' : ''} importé${result.count > 1 ? 's' : ''}` });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  };

  const structured = importFailureOf(failure);

  return (
    <div className="flex flex-col gap-3 p-4">
      <FilePicker label="Fichier CSV" hint="Séparateur point-virgule ou virgule" accept=".csv,.txt,text/csv" validate={validateFile} file={file} onFile={pick} error={readError ?? undefined} />
      <Button variant="link" size="sm" onClick={() => { downloadTextFile('modele-contacts.csv', CONTACT_CSV_TEMPLATE); }}>Télécharger le modèle de fichier</Button>
      {report?.fatal ? <Alert tone="danger" title="Fichier inutilisable">{report.fatal}</Alert> : null}
      {report?.fatal === null ? <Summary report={report} /> : null}
      {structured ? <FailureList failure={structured} accepted={accepted} allowDuplicates={allowDuplicates} onAllowDuplicates={setAllowDuplicates} /> : failure === null ? null : <ActionError title="Import refusé" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button disabled={accepted.length === 0} loading={importer.isPending} onClick={() => { void run(); }}>
          {accepted.length === 0 ? 'Importer' : `Importer ${String(accepted.length)} contact${accepted.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}

function Summary({ report }: { report: ContactCsvReport }) {
  return (
    <div className="flex flex-col gap-2" role="status">
      <p className="text-body text-fg">{`${String(report.accepted.length)} ligne${report.accepted.length > 1 ? 's' : ''} prête${report.accepted.length > 1 ? 's' : ''} à importer.`}</p>
      {report.rejected.length > 0 ? (
        <Alert tone="warning" title={`${String(report.rejected.length)} ligne${report.rejected.length > 1 ? 's' : ''} écartée${report.rejected.length > 1 ? 's' : ''} : elles ne seront pas importées`}>
          <ul className="mt-1 flex flex-col gap-0.5" aria-label="Lignes écartées">
            {report.rejected.slice(0, MAX_SHOWN).map((line) => (
              <li key={line.line}>{`Ligne ${String(line.line)} : ${line.reasons.join(' ')}`}</li>
            ))}
          </ul>
          {report.rejected.length > MAX_SHOWN ? <p className="mt-1">{`… et ${String(report.rejected.length - MAX_SHOWN)} autre(s) ligne(s).`}</p> : null}
        </Alert>
      ) : null}
    </div>
  );
}

const lineOf = (accepted: readonly ImportCandidate[], row: number): string => String(accepted[row - 1]?.line ?? row);

function FailureList({ failure, accepted, allowDuplicates, onAllowDuplicates }: { failure: ImportFailure; accepted: readonly ImportCandidate[]; allowDuplicates: boolean; onAllowDuplicates: (value: boolean) => void }) {
  const { Link } = useGestionNavigation();
  const shown = failure.rows.length;
  if (failure.kind === 'invalid') {
    return (
      <Alert tone="danger" title="Aucun contact n’a été importé">
        <p>Corrigez les lignes signalées dans le fichier, puis rechargez-le.</p>
        <ul className="mt-1 flex flex-col gap-0.5" aria-label="Lignes refusées par le serveur">
          {failure.rows.map((row) => (
            <li key={row.row}>{`Ligne ${lineOf(accepted, row.row)} : ${row.messages.join(' ')}`}</li>
          ))}
        </ul>
        {failure.total > shown ? <p className="mt-1">{`… et ${String(failure.total - shown)} autre(s) ligne(s).`}</p> : null}
      </Alert>
    );
  }
  return (
    <Alert tone="warning" title="Des doublons possibles ont été trouvés : rien n’a été importé">
      <ul className="mt-1 flex flex-col gap-1" aria-label="Doublons possibles">
        {failure.rows.map((row) => (
          <li key={row.row}>
            {`Ligne ${lineOf(accepted, row.row)} : ressemble à `}
            {row.candidates.map((candidate, index) => (
              <span key={candidate.id}>
                {index > 0 ? ', ' : ''}
                <Link href={directoryPaths.contact(candidate.id)} className="underline underline-offset-2">{candidate.displayName}</Link>
                {` (${reasonsText(candidate.reasons)})`}
              </span>
            ))}
            {row.duplicateOfRows.length > 0 ? `${row.candidates.length > 0 ? ' ; ' : ''}même contact que la ligne ${row.duplicateOfRows.map((other) => lineOf(accepted, other)).join(', ')} du fichier` : ''}
          </li>
        ))}
      </ul>
      {failure.total > shown ? <p className="mt-1">{`… et ${String(failure.total - shown)} autre(s) ligne(s).`}</p> : null}
      <div className="mt-2">
        <Checkbox label="Importer quand même, malgré les doublons possibles" checked={allowDuplicates} onChange={(event) => { onAllowDuplicates(event.target.checked); }} />
      </div>
    </Alert>
  );
}
