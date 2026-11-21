'use client';

import { Badge, Button, Card, Icon, Select } from '@eguardimmo/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { KeyDialog } from './KeyDialog';
import type { KeyDialogTarget } from './KeyDialog';
import { useArchiveKey, useChargeKeys, useChargesPermissions, useUnitChoices } from './hooks';
import { keyKindLabel } from './labels';
import type { ChargeKey, UnitChoice } from './model';
import { ChargesGate, ChargesSections } from './parts/ChargesGate';
import { ConfirmAction } from './parts/ConfirmAction';
import { usePropertyLabels } from './parts/choices';
import { ListLoading, LoadError, NoRows, PageHeader, SectionCard, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function KeysPage() {
  return (
    <ChargesGate>
      <KeysContent />
    </ChargesGate>
  );
}

function KeysContent() {
  const permissions = useChargesPermissions();
  const { search } = useGestionNavigation();
  const [propertyId, setPropertyId] = useState(search.get('bien') ?? '');
  const properties = usePropertyLabels();
  const units = useUnitChoices(propertyId === '' ? null : propertyId);
  const [target, setTarget] = useState<KeyDialogTarget | null>(null);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Clés de répartition' }]}
        title="Clés de répartition"
        subtitle="Tantièmes, surfaces, parts égales ou consommations : elles répartissent chaque poste de charges entre les lots."
        actions={
          permissions.write && propertyId !== '' ? (
            <Button variant="primary" onClick={() => { setTarget({ mode: 'create' }); }}>
              <Icon icon={Plus} />
              Nouvelle clé
            </Button>
          ) : null
        }
      />
      <ChargesSections current="keys" />
      <Card role="region" aria-label="Clés du bien" className="gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Bien" placeholder="Choisissez le bien" options={properties.options} value={propertyId} onValueChange={setPropertyId} searchable />
        </div>
        {propertyId === '' ? <NoRows>Choisissez un bien pour voir ses clés de répartition.</NoRows> : <KeysList propertyId={propertyId} units={units.data ?? []} onVersion={setTarget} />}
      </Card>
      <KeyDialog target={target} propertyId={propertyId} units={units.data ?? []} onClose={() => { setTarget(null); }} />
    </>
  );
}

function KeysList({ propertyId, units, onVersion }: { propertyId: string; units: readonly UnitChoice[]; onVersion: (target: KeyDialogTarget) => void }) {
  const keys = useChargeKeys(propertyId);
  if (keys.isPending) return <ListLoading label="Chargement des clés" />;
  if (keys.isError || keys.data === undefined) return <LoadError title="Impossible de charger les clés" />;
  if (keys.data.length === 0) return <NoRows>Aucune clé pour ce bien. Créez-en une pour répartir les charges entre les lots.</NoRows>;
  return (
    <div className="flex flex-col gap-3">
      {keys.data.map((key) => (
        <KeyCard key={key.id} chargeKey={key} propertyId={propertyId} units={units} onVersion={onVersion} />
      ))}
    </div>
  );
}

function KeyCard({ chargeKey, propertyId, units, onVersion }: { chargeKey: ChargeKey; propertyId: string; units: readonly UnitChoice[]; onVersion: (target: KeyDialogTarget) => void }) {
  const permissions = useChargesPermissions();
  const archive = useArchiveKey();
  const notify = useNotify();
  const [archiving, setArchiving] = useState(false);
  const current = chargeKey.versions.find((version) => version.validTo === null) ?? chargeKey.versions.at(-1);

  return (
    <SectionCard
      id={`key-${chargeKey.id}`}
      title={chargeKey.label}
      aside={
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{keyKindLabel[chargeKey.kind]}</Badge>
          {chargeKey.archived ? <Badge tone="neutral">Archivée</Badge> : null}
          {permissions.write && !chargeKey.archived ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => { onVersion({ mode: 'version', keyId: chargeKey.id, label: chargeKey.label, kind: chargeKey.kind }); }}>Nouvelle version</Button>
              <Button size="sm" variant="ghost" onClick={() => { setArchiving(true); }}>Archiver</Button>
            </>
          ) : null}
        </span>
      }
    >
      {current === undefined ? <p className="text-body text-fg-subtle">Aucune version.</p> : (
        <>
          <p className="text-caption text-fg-subtle">{`Version en vigueur depuis le ${formatDateFr(current.validFrom)}`}</p>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {current.shares.map((share) => (
              <li key={share.unitId} className="flex items-center justify-between gap-2 text-body">
                <span className="text-fg-muted">{units.find((unit) => unit.id === share.unitId)?.reference ?? 'Lot'}</span>
                <b className="tabular-nums text-fg">{share.weight}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      <ConfirmAction
        open={archiving}
        title="Archiver cette clé ?"
        description="Une clé archivée ne se choisit plus pour de nouveaux postes ; les exercices déjà calculés ne changent pas."
        confirmLabel="Archiver la clé"
        failureTitle="Clé non archivée"
        tone="danger"
        run={async () => {
          await archive.mutateAsync({ propertyId, keyId: chargeKey.id });
          notify({ title: 'Clé archivée', description: 'Elle reste visible dans l’historique.' });
        }}
        onClose={() => { setArchiving(false); }}
      />
    </SectionCard>
  );
}
