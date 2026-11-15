'use client';

import { Upload } from 'lucide-react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { useLeaseLookups } from './BauxParts';
import { useImportLeases, useLeases } from './hooks';
import { LEASE_IMPORT_HEADERS, parseLeasesCsv } from './leasesImport';
import type { LeaseImportReport } from './leasesImport';
import { useTenants, useUnits } from '../locataires/hooks';
import { errorMessage, useNotify } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { formatDateFr, todayIso } from '../locataires/kit/dates';
import { money, parseEuros } from '../locataires/kit/money';
import { tenantNameOf } from '../locataires/schemas';

const MAX_BYTES = 1_048_576;

export function LeaseImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const notify = useNotify();
  const units = useUnits();
  const tenants = useTenants();
  const leases = useLeases();
  const lookups = useLeaseLookups();
  const importer = useImportLeases();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<LeaseImportReport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const reset = () => {
    setFileName('');
    setReport(null);
    setProblem(null);
  };

  const downloadTemplate = () => {
    downloadCsv('modele-baux.csv', toCsv(LEASE_IMPORT_HEADERS, [['Studio 2e', 'Ibrahim Yao', '2026-12-01', '2027-11-30', '720,00', '60,00', '720,00', 'Meublé']]));
    notify({ title: 'Modèle téléchargé', description: 'modele-baux.csv' });
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
    const people = (tenants.data ?? []).map((tenant) => ({ id: tenant.id, name: tenantNameOf(tenant) }));
    setReport(parseLeasesCsv(text, units.data ?? [], people, leases.data ?? [], todayIso()));
  };

  const confirm = async () => {
    if (!report || report.accepted.length === 0) return;
    try {
      const created = await importer.mutateAsync(report.accepted.map((entry) => entry.input));
      const rejected = report.rejected.length;
      notify({
        title: `${String(created.length)} bail${created.length > 1 ? 'x' : ''} importé${created.length > 1 ? 's' : ''}`,
        description: rejected > 0 ? `${String(rejected)} ligne${rejected > 1 ? 's' : ''} rejetée${rejected > 1 ? 's' : ''}.` : fileName,
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      notify({ tone: 'danger', title: 'Import impossible', description: errorMessage(error) });
    }
  };

  const ready = units.data !== undefined && tenants.data !== undefined && leases.data !== undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent title="Importer des baux" description={`Colonnes attendues : ${LEASE_IMPORT_HEADERS.join(', ')}. Dates en jj/mm/aaaa ou aaaa-mm-jj, montants en euros, type vide ou meublé, séparateur point-virgule.`}>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept=".csv,.txt,text/csv"
              aria-label="Fichier CSV des baux"
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
                      <TableHeaderCell>Bien</TableHeaderCell>
                      <TableHeaderCell>Locataire</TableHeaderCell>
                      <TableHeaderCell>Période</TableHeaderCell>
                      <TableHeaderCell numeric>Loyer</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.accepted.map((entry) => (
                      <TableRow key={entry.line}>
                        <TableCell>{entry.line}</TableCell>
                        <TableCell strong>{lookups.unitShort(entry.input.unitId)}</TableCell>
                        <TableCell>{lookups.tenantName(entry.input.tenantId)}</TableCell>
                        <TableCell>{`${formatDateFr(entry.input.start)} → ${formatDateFr(entry.input.end)}`}</TableCell>
                        <TableCell numeric>{money(parseEuros(entry.input.rent))}</TableCell>
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
              {report && report.accepted.length > 0 ? `Importer ${String(report.accepted.length)} bail${report.accepted.length > 1 ? 'x' : ''}` : 'Importer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
