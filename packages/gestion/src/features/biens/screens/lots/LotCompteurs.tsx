'use client';

import { Badge, Button, Dialog, DialogContent } from '@eguardimmo/ui';
import { Camera } from 'lucide-react';
import { useState } from 'react';
import { BarChart } from '../../components/Charts';
import { DataTable } from '../../components/DataTable';
import { FactList, Panel } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { ReadingDialog } from '../../components/ReadingDialog';
import { useListState } from '../../hooks/useListState';
import { formatNumber } from '../../lib/amount';
import { formatDate } from '../../lib/dates';
import { downloadFile, toCsv } from '../../lib/files';
import { METER_LABELS, REASON_LABELS } from '../../lib/labels';
import { useReadings } from '../../queries';
import type { Meter } from '../../schemas/releves';
import { formatMoney } from '../../../../format/money';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function monthLabel(month: string): string {
  const [year = '', index = '1'] = month.split('-');
  return `${MONTHS[Number(index) - 1] ?? index} ${year.slice(2)}`;
}

export function LotCompteurs({ id }: { id: string }) {
  const query = useReadings();
  const list = useListState({ key: 'date', direction: 'desc' }, 5);
  const [target, setTarget] = useState<string | null>(null);
  const [photoOf, setPhotoOf] = useState<string | null>(null);
  return (
    <QueryBoundary query={query} errorTitle="Les compteurs n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} label="Chargement des compteurs" />}>
      {(data) => {
        const meters = data.meters.filter((meter) => meter.lotId === id);
        const readings = data.items.filter((item) => item.lotId === id && !item.archived);
        if (meters.length === 0) return <Panel title="Compteurs"><p className="text-body text-fg-muted">Aucun compteur n’est rattaché à ce bien.</p></Panel>;
        const describe = (meter: Meter) => `${METER_LABELS[meter.kind]}, ${meter.ref}`;
        return (
          <>
            {meters.map((meter) => {
              const last = readings.filter((item) => item.meterId === meter.id).sort((a, b) => b.date.localeCompare(a.date))[0];
              const total = meter.series.reduce((sum, point) => sum + point.value, 0);
              const latest = meter.series.at(-1);
              return (
                <Panel
                  key={meter.id}
                  title={METER_LABELS[meter.kind]}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => { setTarget(meter.id); }}>
                      Nouveau relevé<span className="sr-only">{`, ${METER_LABELS[meter.kind]}`}</span>
                    </Button>
                  }
                >
                  <FactList
                    rows={[
                      ...meter.details,
                      ...(last ? [{ label: 'Dernier index', value: `${formatNumber(last.index, 1)} ${meter.unit}` }, { label: 'Relevé le', value: formatDate(last.date) }] : []),
                      ...(meter.series.length > 0 ? [{ label: 'Consommation des 12 derniers mois', value: `${formatNumber(total, 1)} ${meter.unit}` }] : []),
                    ]}
                  />
                  {meter.series.length > 0 ? (
                    <BarChart
                      title={`Consommation mensuelle, ${METER_LABELS[meter.kind]}`}
                      primaryLabel={`Consommé, ${meter.unit}`}
                      points={meter.series.map((point) => ({ id: point.month, label: monthLabel(point.month), primary: point.value, caption: `${formatNumber(point.value, 1)} ${meter.unit}` }))}
                    />
                  ) : null}
                  {latest ? null : <p className="text-body text-fg-muted">Pas encore de consommation calculée.</p>}
                </Panel>
              );
            })}
            <Panel
              title="Historique des relevés"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    downloadFile(
                      'releves.csv',
                      toCsv([
                        ['Date', 'Compteur', 'Index', 'Unité', 'Écart', 'Origine', 'Saisi par'],
                        ...readings.map((item) => [formatDate(item.date), METER_LABELS[item.kind], String(item.index).replace('.', ','), item.unit, item.delta === null ? '' : String(item.delta).replace('.', ','), item.origin, item.enteredBy]),
                      ]),
                    );
                  }}
                >
                  Exporter
                </Button>
              }
            >
              <DataTable
                label="Historique des relevés"
                rows={readings}
                getId={(row) => row.id}
                list={list}
                empty={<p className="text-body text-fg-muted">Aucun relevé enregistré.</p>}
                columns={[
                  { id: 'date', header: 'Date', sortBy: (row) => row.date, cell: (row) => formatDate(row.date) },
                  { id: 'meter', header: 'Compteur', sortBy: (row) => METER_LABELS[row.kind], cell: (row) => METER_LABELS[row.kind] },
                  { id: 'index', header: 'Index', numeric: true, sortBy: (row) => row.index, cell: (row) => `${formatNumber(row.index, 1)} ${row.unit}` },
                  { id: 'delta', header: 'Écart', numeric: true, cell: (row) => (row.delta === null ? '—' : `+${formatNumber(row.delta, 1)} ${row.unit}`) },
                  { id: 'cost', header: 'Coût', numeric: true, cell: (row) => (row.cost === null ? '—' : formatMoney(row.cost, data.currency)) },
                  { id: 'origin', header: 'Origine', cell: (row) => row.origin },
                  { id: 'reason', header: 'Motif', cell: (row) => <Badge tone={row.reason === 'en_cours_de_bail' ? 'neutral' : 'info'}>{REASON_LABELS[row.reason]}</Badge> },
                  { id: 'by', header: 'Saisi par', cell: (row) => row.enteredBy },
                  {
                    id: 'photo',
                    header: 'Photo',
                    cell: (row) =>
                      row.hasPhoto ? (
                        <Button variant="link" size="sm" onClick={() => { setPhotoOf(row.id); }}>
                          <Camera aria-hidden="true" className="size-3.5" />
                          <span className="sr-only">{`Voir la photo du relevé du ${formatDate(row.date)}`}</span>
                        </Button>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
            </Panel>
            <ReadingDialog key={target ?? 'closed'} open={target !== null} onOpenChange={(open) => { if (!open) setTarget(null); }} meters={meters} describe={describe} initialMeterId={target ?? undefined} />
            <Dialog open={photoOf !== null} onOpenChange={(open) => { if (!open) setPhotoOf(null); }}>
              <DialogContent title="Photo du compteur" description="Photo jointe au relevé, conservée avec le dossier.">
                <div className="m-4 flex h-40 items-center justify-center rounded-md bg-muted text-body text-fg-muted">Aperçu de la photo</div>
              </DialogContent>
            </Dialog>
          </>
        );
      }}
    </QueryBoundary>
  );
}
