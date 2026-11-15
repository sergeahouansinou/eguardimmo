'use client';

import { Badge, Button } from '@eguardimmo/ui';
import { useState } from 'react';
import { TwoColumns } from '../../components/FicheHeader';
import { EntryList, FactList, Panel } from '../../components/Panels';
import { PhotosPanel } from '../../components/PhotosPanel';
import { QueryBoundary, SkeletonCard } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { useCommand } from '../../hooks/useCommand';
import { formatNumber } from '../../lib/amount';
import { daysBetween, formatDate, monthsBetween } from '../../lib/dates';
import { formatBytes } from '../../lib/text';
import { biensPaths } from '../../paths';
import { useDocuments, useEquipement } from '../../queries';
import type { EquipementDetail } from '../../schemas/equipements';
import { formatMoney } from '../../../../format/money';
import { LogEntryDialog } from './EntretienDialogs';

export function logItems(detail: EquipementDetail) {
  return detail.log.map((entry) => ({
    id: entry.id,
    title: entry.title,
    detail: `${formatDate(entry.date)}${entry.detail ? ` · ${entry.detail}` : ''}${entry.cost === null ? '' : ` · ${formatMoney(entry.cost, detail.currency)}`}`,
    badge: entry.done ? { label: 'Fait', tone: 'success' as const } : { label: 'Planifié', tone: 'info' as const },
  }));
}

function WarrantyCard({ detail }: { detail: EquipementDetail }) {
  const { warranty, asOf } = detail;
  const active = warranty.endsOn !== null && warranty.endsOn >= asOf;
  const remaining = warranty.endsOn !== null && active ? monthsBetween(asOf, warranty.endsOn) : null;
  return (
    <Panel title="Garantie">
      {warranty.endsOn === null ? (
        <p className="text-body text-fg-muted">Aucune garantie renseignée. Ajoutez la date de fin depuis la modification de l’équipement.</p>
      ) : (
        <FactList
          single
          rows={[
            { label: warranty.coverage, value: warranty.months > 0 ? `${formatNumber(warranty.months)} mois` : '—' },
            { label: 'Fin de garantie', value: formatDate(warranty.endsOn) },
            {
              label: 'Reste',
              value: remaining === null ? 'Garantie expirée' : remaining === 0 ? `${String(Math.max(0, daysBetween(asOf, warranty.endsOn)))} jours` : `${String(remaining)} mois`,
              badge: active ? { label: 'Sous garantie', tone: 'info' } : { label: 'Expirée', tone: 'neutral' },
            },
          ]}
        />
      )}
    </Panel>
  );
}

export function EquipementOverview({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useEquipement(id);
  const documents = useDocuments({ kind: 'equipement', id });
  const [logging, setLogging] = useState(false);
  const addPhotos = useCommand(
    (source, input: { names: string[] }) => {
      const current = query.data;
      if (!current) return Promise.reject(new Error('Fiche non chargée'));
      return source.updateEquipement(id, { ...current.values, photoNames: [...current.values.photoNames, ...input.names] });
    },
    { success: (_result, input) => (input.names.length > 1 ? `${String(input.names.length)} photos ajoutées` : 'Photo ajoutée') },
  );
  return (
    <QueryBoundary query={query} errorTitle="La fiche n’a pas pu être chargée" skeleton={<SkeletonCard label="Chargement de la fiche" lines={6} />}>
      {(detail) => {
        if (detail === null) return null;
        const entries = logItems(detail);
        return (
          <>
            <PhotosPanel photos={detail.photos} count={detail.photoCount} pending={addPhotos.isPending} onAdd={(names) => { addPhotos.execute({ names }); }} />
            <TwoColumns>
              <Panel
                title="Identification"
                action={
                  <Button variant="link" size="sm" asChild>
                    <Link href={biensPaths.editEquipement(id)}>Modifier</Link>
                  </Button>
                }
              >
                <FactList rows={detail.identification} />
              </Panel>
              <WarrantyCard detail={detail} />
              <Panel title="Entretien">
                <FactList single rows={detail.maintenanceRows} />
              </Panel>
              <Panel title="Coût et durée de vie">
                <FactList
                  single
                  rows={[
                    { label: 'Coût total à ce jour', value: formatMoney(detail.cost.total, detail.currency) },
                    { label: 'dont entretien', value: formatMoney(detail.cost.maintenance, detail.currency) },
                    ...(detail.cost.lifetimeYears === null ? [] : [{ label: 'Durée de vie estimée', value: `${String(detail.cost.lifetimeYears)} ans` }]),
                    ...(detail.cost.replacementYear === null ? [] : [{ label: 'Remplacement prévu', value: String(detail.cost.replacementYear) }]),
                  ]}
                />
              </Panel>
              <Panel
                title="Carnet d’entretien"
                action={
                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="secondary" size="sm" onClick={() => { setLogging(true); }}>
                      Ajouter une entrée
                    </Button>
                    <Button variant="link" size="sm" asChild>
                      <Link href={biensPaths.equipement(id, 'entretien')}>{`Tout voir, ${String(entries.length)}`}</Link>
                    </Button>
                  </div>
                }
              >
                <EntryList label="Carnet d’entretien" empty="Aucune entrée pour le moment." items={entries.slice(0, 3)} />
              </Panel>
              <Panel
                title="Documents"
                action={
                  <Button variant="link" size="sm" asChild>
                    <Link href={biensPaths.equipement(id, 'documents')}>{`Tout voir, ${String(documents.data?.items.length ?? 0)}`}</Link>
                  </Button>
                }
              >
                <QueryBoundary query={documents} errorTitle="Les documents n’ont pas pu être chargés" skeleton={<SkeletonCard label="Chargement des documents" lines={3} />}>
                  {(docs) => (
                    <EntryList
                      label="Documents de l’équipement"
                      empty="Aucun document. Ajoutez la facture d’achat ou la notice."
                      items={docs.items.slice(0, 3).map((item) => ({ id: item.id, title: item.name, detail: `${formatDate(item.date)} · ${formatBytes(item.sizeBytes)}`, href: biensPaths.equipement(id, 'documents') }))}
                    />
                  )}
                </QueryBoundary>
              </Panel>
            </TwoColumns>
            <LogEntryDialog equipementId={id} currency={detail.currency} asOf={detail.asOf} open={logging} onOpenChange={setLogging} />
            {detail.equipement.archived ? <Badge tone="neutral">Équipement archivé</Badge> : null}
          </>
        );
      }}
    </QueryBoundary>
  );
}
