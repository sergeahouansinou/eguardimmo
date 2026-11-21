'use client';

import { Alert, Badge, Card } from '@eguardimmo/ui';
import { formatMoney } from '../../format/money';
import { DescriptionList, LedgerLines, SectionCard } from '../locataires/kit';
import { IncomeLines } from './IncomeLines';
import { blockerLabel, coOwnerNatureLabel } from './labels';
import type { TaxIncome } from './model';

const EXPERT_NOTE = 'Ces montants sont à faire valider par un expert-comptable ou un conseil fiscal avant toute déclaration : l’application ne dépose rien auprès de l’administration.';

const bpLabel = (bp: number): string => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(bp / 100)} %`;

export function TaxIncomeView({ income, idPrefix = 'tax' }: { income: TaxIncome; idPrefix?: string }) {
  const money = (value: { amount: number; currency: TaxIncome['currency'] }) => formatMoney(value.amount, value.currency);
  const texts = [income.warning, ...income.mentions];
  const mentionsExpert = texts.some((text) => /expert-comptable/i.test(text));

  return (
    <div className="relative flex min-w-0 flex-col gap-3">
      {income.provisional ? (
        <>
          <Alert tone="warning" title="Calcul provisoire">
            L’année n’est pas terminée : ces montants évolueront jusqu’à la clôture. Ils ne peuvent pas être figés tant qu’elle n’est pas close.
          </Alert>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center overflow-hidden select-none">
            <span className="-rotate-12 border-4 border-warning-line px-4 py-1 text-[clamp(2rem,10vw,5rem)] font-bold tracking-widest text-warning-fg opacity-15">PROVISOIRE</span>
          </div>
        </>
      ) : null}
      <Alert tone="info" title={`Revenus fonciers ${String(income.incomeYear)}, formulaire ${income.formVersion}`}>
        <span className="flex flex-col gap-1">
          <span>{income.warning}</span>
          {mentionsExpert ? null : <span>{EXPERT_NOTE}</span>}
        </span>
      </Alert>
      {income.blockers.length === 0 ? null : (
        <Alert tone="danger" title="Points à corriger avant de figer">
          <ul className="list-disc pl-4">
            {income.blockers.map((blocker, index) => (
              <li key={index}>{blockerLabel[blocker.code] ?? blocker.code}</li>
            ))}
          </ul>
        </Alert>
      )}
      {income.warnings.length === 0 ? null : (
        <Alert tone="warning" title="Points d’attention">
          <ul className="list-disc pl-4">
            {income.warnings.map((warning, index) => (
              <li key={index}>{warning.message ?? warning.code}</li>
            ))}
          </ul>
        </Alert>
      )}
      {income.properties.map((property, index) => (
        <SectionCard key={property.propertyId ?? index} id={`${idPrefix}-property-${String(index)}`} title={property.name} aside={<Badge tone="neutral">{`${String(property.premises)} local${property.premises > 1 ? 'aux' : ''} loué${property.premises > 1 ? 's' : ''}`}</Badge>}>
          {property.coOwners.length === 0 ? null : (
            <p className="text-body text-fg-muted">
              {`Propriété partagée : ${property.coOwners.map((owner) => `${bpLabel(owner.shareBp)} (${coOwnerNatureLabel[owner.nature] ?? owner.nature})`).join(', ')}.`}
            </p>
          )}
          <IncomeLines lines={property.lines} label={`Lignes du bien ${property.name}`} />
        </SectionCard>
      ))}
      <SectionCard id={`${idPrefix}-totals`} title="Totaux de la déclaration">
        <IncomeLines lines={income.totals} label="Totaux de la déclaration" />
      </SectionCard>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <SectionCard id={`${idPrefix}-micro`} title="Micro-foncier, à titre de comparaison">
          <LedgerLines
            lines={[
              { label: 'Recettes brutes', value: money(income.micro.grossReceipts) },
              { label: 'Taux d’abattement', value: bpLabel(income.micro.allowanceBp) },
              { label: 'Plafond d’éligibilité', value: money(income.micro.threshold) },
            ]}
            total={{ label: 'Base après abattement', value: money(income.micro.baseAfterAllowance) }}
          />
        </SectionCard>
        <SectionCard id={`${idPrefix}-real`} title="Régime réel, à titre de comparaison">
          <LedgerLines lines={[{ label: 'Recettes brutes', value: money(income.micro.grossReceipts) }]} total={{ label: 'Base du régime réel', value: money(income.micro.realBase) }} />
        </SectionCard>
      </div>
      <p className="text-caption text-fg-subtle">Les deux bases sont présentées côte à côte, sans recommandation de régime : le choix revient au contribuable et à son conseil.</p>
      {income.deficit === null ? (
        <Card className="gap-1">
          <p className="text-body text-fg-muted">Le déficit foncier n’est pas simulé : il ne l’est que si le foyer fiscal est entièrement suivi dans l’application.</p>
        </Card>
      ) : (
        <SectionCard id={`${idPrefix}-deficit`} title="Simulation du déficit foncier">
          <DescriptionList
            termWidth="220px"
            items={[
              { term: 'Résultat foncier', detail: money(income.deficit.result) },
              { term: 'Dont intérêts d’emprunt', detail: money(income.deficit.interestPart) },
              { term: 'Dont autres charges', detail: money(income.deficit.otherPart) },
              { term: 'Imputable sur le revenu global', detail: money(income.deficit.imputableOnGlobalIncome) },
              { term: 'Reportable sur les revenus fonciers', detail: money(income.deficit.carriedForward) },
            ]}
          />
        </SectionCard>
      )}
      {income.mentions.length === 0 ? null : (
        <ul className="flex flex-col gap-1 text-caption text-fg-subtle">
          {income.mentions.map((mention, index) => (
            <li key={index}>{mention}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
