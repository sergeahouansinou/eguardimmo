'use client';

import { Button, Card, EmptyState, Icon, Select } from '@eguardimmo/ui';
import { FilePlus2, Receipt } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';
import { PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission } from '../orgapi/hooks';
import { GenerateDialog } from './GenerateDialog';
import { SummariesTable } from './SummariesTable';
import { useStatements, useTaxMandants, useTaxRetry } from './hooks';
import { SUPPORTED_YEAR } from './model';

const ALL = 'all';

export function MandantStatementsPage() {
  const [mandantId, setMandantId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const pages = useCursorPages();
  const retry = useTaxRetry();
  const statements = useStatements({ incomeYear: null, mandantId, cursor: pages.cursor });
  const mandants = useTaxMandants();
  const prepare = useOrgPermission('tax_prepare');
  const names = new Map((mandants.data ?? []).map((mandant) => [mandant.partyId, mandant.name]));

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances', href: '/finances' }, { label: 'Fiscalité' }]}
        title="Relevés fiscaux des mandants"
        subtitle={`Revenus fonciers ${String(SUPPORTED_YEAR)} par mandant : à générer, vérifier puis publier dans l’espace du mandant.`}
        actions={
          prepare.write ? (
            <Button onClick={() => { setGenerating(true); }}>
              <Icon icon={FilePlus2} />
              Générer les relevés
            </Button>
          ) : null
        }
      />
      <Select
        label="Mandant"
        placeholder="Tous les mandants"
        searchable
        value={mandantId ?? ALL}
        onValueChange={(value) => { setMandantId(value === ALL ? null : value); pages.reset(); }}
        options={[{ value: ALL, label: 'Tous les mandants' }, ...(mandants.data ?? []).map((mandant) => ({ value: mandant.partyId, label: mandant.name }))]}
      />
      <QueryState query={statements} label="Chargement des relevés" title="Impossible de charger les relevés" onRetry={retry} />
      {statements.data === undefined ? null : statements.data.items.length === 0 && pages.page === 1 ? (
        <EmptyState icon={Receipt} title={mandantId === null ? 'Aucun relevé généré' : 'Aucun relevé pour ce mandant'} description="Générez les relevés de l’année pour vos mandants : chacun est calculé par le serveur à partir de ses encaissements et de ses dépenses.">
          {prepare.write && mandantId === null ? <Button onClick={() => { setGenerating(true); }}>Générer les relevés</Button> : null}
        </EmptyState>
      ) : (
        <Card role="region" aria-label="Relevés fiscaux" className="gap-2">
          <SummariesTable items={statements.data.items} mandantNames={names} />
          <CursorPager pages={pages} nextCursor={statements.data.nextCursor} label="Pagination des relevés" />
        </Card>
      )}
      <GenerateDialog open={generating} mandants={mandants.data ?? []} loading={mandants.isPending} onClose={() => { setGenerating(false); }} />
    </>
  );
}
