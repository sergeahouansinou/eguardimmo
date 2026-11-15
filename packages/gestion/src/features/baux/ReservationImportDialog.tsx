'use client';

import { Upload } from 'lucide-react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { useImportReservations, useReservations } from './hooks';
import { IMPORT_HEADERS, parseReservationsCsv } from './reservationsImport';
import type { ImportReport } from './reservationsImport';
import { useUnits } from '../locataires/hooks';
import { errorMessage, useNotify } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { formatDateFr, todayIso } from '../locataires/kit/dates';
import { money, parseEuros } from '../locataires/kit/money';

const MAX_BYTES = 1_048_576;

export function ReservationImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported?: () => void }) {
  const notify = useNotify();
  const units = useUnits();
  const reservations = useReservations();
  const importer = useImportReservations();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const reset = () => {
    setFileName('');
    setReport(null);
    setProblem(null);
  };

  const downloadTemplate = () => {
    downloadCsv('modele-reservations.csv', toCsv(IMPORT_HEADERS, [['Studio Plage', 'Anna Kowalski', '2026-12-01', '2026-12-08', '630,00', '300,00', '300,00']]));
    notify({ title: 'Modèle téléchargé', description: 'modele-reservations.csv' });
  };

  const read = async (file: File) => {
    setProblem(null);
    setReport(null);
    if (file.size > MAX_BYTES) {
      setProblem('Le fichier dépasse 1 Mo.');
      return;
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setProblem('Choisissez un fichier .csv.');
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    setReport(parseReservationsCsv(text, units.data ?? [], reservations.data ?? [], todayIso()));
  };

  const confirm = async () => {
    if (!report || report.accepted.length === 0) return;
    try {
      const created = await importer.mutateAsync(report.accepted.map((entry) => entry.input));
      const rejected = report.rejected.length;
      notify({
        title: `${String(created.length)} réservation${created.length > 1 ? 's' : ''} importée${created.length > 1 ? 's' : ''}`,
        description: rejected > 0 ? `${String(rejected)} ligne${rejected > 1 ? 's' : ''} rejetée${rejected > 1 ? 's' : ''}.` : fileName,
      });
      reset();
      onOpenChange(false);
      onImported?.();
    } catch (error) {
      notify({ tone: 'danger', title: 'Import impossible', description: errorMessage(error) });
    }
  };

  const ready = units.data !== undefined && reservations.data !== undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent title="Importer des réservations" description={`Colonnes attendues : ${IMPORT_HEADERS.join(', ')}. Dates en jj/mm/aaaa ou aaaa-mm-jj, montants en euros, séparateur point-virgule.`}>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept=".csv,.txt,text/csv"
              aria-label="Fichier CSV des réservations"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void read(file);
              }}
            />
            <Button variant="secondary" disabled={!ready} onClick={() => { input.current?.click(); }}>
              <Upload size={14} aria-hidden="true" />
              Choisir un fichier CSV
            </Button>
            <Button variant="ghost" onClick={downloadTemplate}>Télécharger le modèle</Button>
            {fileName ? <span className="text-caption font-medium text-fg">{`Fichier : ${fileName}`}</span> : null}
          </div>
          {problem ? <Alert tone="danger" title="Fichier refusé">{problem}</Alert> : null}
          {report ? (
            <div className="flex flex-col gap-3" aria-live="polite">
              <Alert tone={report.accepted.length > 0 ? 'success' : 'warning'} title={`${String(report.accepted.length)} ligne${report.accepted.length > 1 ? 's' : ''} valide${report.accepted.length > 1 ? 's' : ''}, ${String(report.rejected.length)} rejetée${report.rejected.length > 1 ? 's' : ''}`}>
                {report.accepted.length > 0 ? 'Seules les lignes valides seront importées.' : 'Corrigez le fichier puis choisissez-le à nouveau.'}
              </Alert>
              {report.accepted.length > 0 ? (
                <Table aria-label="Lignes valides">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Ligne</TableHeaderCell>
                      <TableHeaderCell>Voyageur</TableHeaderCell>
                      <TableHeaderCell>Séjour</TableHeaderCell>
                      <TableHeaderCell numeric>Montant</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.accepted.map((entry) => (
                      <TableRow key={entry.line}>
                        <TableCell>{entry.line}</TableCell>
                        <TableCell strong>{entry.input.guest}</TableCell>
                        <TableCell>{`${formatDateFr(entry.input.arrival)} → ${formatDateFr(entry.input.departure)}`}</TableCell>
                        <TableCell numeric>{money(parseEuros(entry.input.amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
              {report.rejected.length > 0 ? (
                <Table aria-label="Lignes rejetées">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Ligne</TableHeaderCell>
                      <TableHeaderCell>Motif du rejet</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.rejected.map((entry) => (
                      <TableRow key={`${String(entry.line)}-${entry.reason}`}>
                        <TableCell strong>{entry.line}</TableCell>
                        <TableCell>{entry.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Fermer</Button>
            </DialogClose>
            <Button disabled={!report || report.accepted.length === 0} loading={importer.isPending} onClick={() => { void confirm(); }}>
              {report && report.accepted.length > 0 ? `Importer ${String(report.accepted.length)} réservation${report.accepted.length > 1 ? 's' : ''}` : 'Importer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
