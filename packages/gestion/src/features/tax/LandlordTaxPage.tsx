'use client';

import { Button, Card, Checkbox, EmptyState, Icon } from '@eguardimmo/ui';
import { Lock, Receipt } from 'lucide-react';
import { useState } from 'react';
import { useAttemptKey } from '../finances/ownerfunds/attemptKey';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';
import { PageHeader, useGestionNavigation, useNotify } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { ConfirmAction } from '../orgapi/ConfirmAction';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission } from '../orgapi/hooks';
import { TaxIncomeView } from './TaxIncomeView';
import { useCreateSummary, useRentalIncome, useSummaries, useTaxRetry } from './hooks';
import { SUPPORTED_YEAR } from './model';
import { taxPaths } from './paths';
import { SummariesTable } from './SummariesTable';

export function LandlordTaxPage() {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const keyFor = useAttemptKey();
  const retry = useTaxRetry();
  const [household, setHousehold] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const pages = useCursorPages();
  const income = useRentalIncome(SUPPORTED_YEAR, household);
  const summaries = useSummaries({ incomeYear: null, mandantId: null, cursor: pages.cursor });
  const prepare = useOrgPermission('tax_prepare');
  const create = useCreateSummary();
  const blocked = income.data === undefined || income.data.provisional || income.data.blockers.length > 0;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances', href: '/finances' }, { label: 'Fiscalité' }]}
        title="Fiscalité : revenus fonciers"
        subtitle={`Déclaration 2044 des revenus ${String(SUPPORTED_YEAR)}, calculée par le serveur à partir de vos loyers, dépenses et prêts.`}
        actions={
          prepare.write ? (
            <Button disabled={blocked} onClick={() => { setFreezing(true); }}>
              <Icon icon={Lock} />
              Figer la synthèse {SUPPORTED_YEAR}
            </Button>
          ) : null
        }
      />
      <Checkbox label="Mon foyer fiscal est entièrement suivi dans l’application" checked={household} onChange={(event) => { setHousehold(event.target.checked); }} />
      <p className="text-caption text-fg-subtle">Cochée, la simulation du déficit foncier est calculée. Sinon, elle n’est pas affichée : elle serait fausse si d’autres revenus fonciers existent hors de l’application.</p>
      <QueryState query={income} label="Calcul des revenus fonciers" title="Impossible de calculer les revenus fonciers" onRetry={retry} />
      {income.data ? <TaxIncomeView income={income.data} /> : null}
      <h2 className="text-block-title text-fg">Synthèses figées</h2>
      <QueryState query={summaries} label="Chargement des synthèses" title="Impossible de charger les synthèses" onRetry={retry} />
      {summaries.data === undefined ? null : summaries.data.items.length === 0 && pages.page === 1 ? (
        <EmptyState icon={Receipt} title="Aucune synthèse figée" description="Figez la synthèse une fois l’année close pour conserver les chiffres déclarés et obtenir le PDF." />
      ) : (
        <Card role="region" aria-label="Synthèses figées" className="gap-2">
          <SummariesTable items={summaries.data.items} mandantNames={null} />
          <CursorPager pages={pages} nextCursor={summaries.data.nextCursor} label="Pagination des synthèses" />
        </Card>
      )}
      <ConfirmAction
        open={freezing}
        title={`Figer la synthèse ${String(SUPPORTED_YEAR)}`}
        description="Les chiffres sont enregistrés tels qu’ils sont calculés maintenant. Pour les modifier ensuite, il faudra rectifier la synthèse."
        confirmLabel="Figer la synthèse"
        failureTitle="Synthèse non figée"
        run={async () => {
          const created = await create.mutateAsync({ incomeYear: SUPPORTED_YEAR, householdComplete: household, key: keyFor(JSON.stringify([SUPPORTED_YEAR, household])) });
          notify({ title: 'Synthèse figée' });
          push(taxPaths.summary(created.id));
        }}
        onClose={() => { setFreezing(false); }}
      />
    </>
  );
}
