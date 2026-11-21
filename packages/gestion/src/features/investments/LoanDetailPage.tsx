'use client';

import { Alert, Badge, Button, Icon, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Ban, FileUp, Landmark, Paperclip, Receipt, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '../../format/money';
import { DescriptionList, LinkButton, PageHeader, SectionCard } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission, useOrgPropertyChoices } from '../orgapi/hooks';
import { InvestmentsGate } from './InvestmentsGate';
import { AttestationDialog, FeeDialog, ImportScheduleDialog, PrepayDialog, VoidLoanDialog } from './LoanDialogs';
import { ScheduleTable } from './ScheduleTable';
import { useInvestmentsRetry, useLoan, useLoanSchedule } from './hooks';
import { deferralLabel, feeLabel, insuranceLabel, purposeLabel, rateLabel, sourceLabel, statusLabel, statusTone } from './labels';
import type { Loan } from './model';
import { investmentsPaths } from './paths';

type Dialog = 'prepay' | 'import' | 'fee' | 'attestation' | 'void' | null;

const crumbs = (title: string) => [
  { label: 'Accueil', href: links.home },
  { label: 'Finances', href: '/finances' },
  { label: 'Prêts immobiliers', href: investmentsPaths.loans },
  { label: title },
];

export function LoanDetailPage({ id }: { id: string }) {
  return (
    <InvestmentsGate>
      <LoanDetailContent id={id} />
    </InvestmentsGate>
  );
}

function LoanDetailContent({ id }: { id: string }) {
  const loan = useLoan(id);
  const retry = useInvestmentsRetry();
  if (loan.data) return <LoanDetail loan={loan.data} />;
  return (
    <>
      <PageHeader crumbs={crumbs('Prêt')} title="Prêt" />
      <QueryState
        query={loan}
        label="Chargement du prêt"
        title="Impossible de charger le prêt"
        onRetry={retry}
        notFound={{ title: 'Prêt introuvable', description: 'Ce prêt n’existe pas dans votre organisation.', backHref: investmentsPaths.loans, backLabel: 'Retour aux prêts' }}
      />
    </>
  );
}

function LoanDetail({ loan }: { loan: Loan }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const permission = useOrgPermission('investments');
  const properties = useOrgPropertyChoices();
  const schedule = useLoanSchedule(loan.id);
  const retry = useInvestmentsRetry();
  const close = () => { setDialog(null); };
  const propertyName = (properties.data ?? []).find((property) => property.id === loan.propertyId)?.name ?? 'Bien';
  const active = loan.status === 'active';
  const editable = permission.write && loan.status !== 'voided';
  const currency = loan.principal.currency;
  const imported = loan.scheduleSource === 'imported';

  return (
    <>
      <PageHeader
        crumbs={crumbs(loan.lenderLabel)}
        title={loan.lenderLabel}
        subtitle={`${purposeLabel[loan.purpose]} · ${propertyName}`}
        badges={<Badge tone={statusTone[loan.status]}>{statusLabel[loan.status]}</Badge>}
        actions={
          <>
            <LinkButton href={investmentsPaths.loans}>Retour aux prêts</LinkButton>
            {editable && active ? (
              <Button variant="secondary" disabled={imported} onClick={() => { setDialog('prepay'); }}>
                <Icon icon={Undo2} />
                Remboursement anticipé
              </Button>
            ) : null}
            {editable && active ? (
              <Button variant="secondary" onClick={() => { setDialog('import'); }}>
                <Icon icon={FileUp} />
                Importer le tableau de la banque
              </Button>
            ) : null}
            {editable ? (
              <Button variant="secondary" onClick={() => { setDialog('fee'); }}>
                <Icon icon={Receipt} />
                Ajouter des frais
              </Button>
            ) : null}
            {editable ? (
              <Button variant="secondary" onClick={() => { setDialog('attestation'); }}>
                <Icon icon={Paperclip} />
                Attestation de la banque
              </Button>
            ) : null}
            {editable ? (
              <Button variant="danger" onClick={() => { setDialog('void'); }}>
                <Icon icon={Ban} />
                Annuler la saisie
              </Button>
            ) : null}
          </>
        }
      />
      {loan.status === 'voided' ? (
        <Alert tone="danger" title="Saisie annulée">
          {loan.voidReason ?? 'Ce prêt a été annulé et n’entre plus dans vos chiffres.'}
        </Alert>
      ) : null}
      {imported && active ? (
        <Alert tone="info" title="Tableau importé">
          Le remboursement anticipé n’est pas disponible tant que le tableau de la banque remplace le calcul.
        </Alert>
      ) : null}
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <SectionCard id="loan-terms" title="Conditions">
          <DescriptionList
            termWidth="150px"
            items={[
              { term: 'Capital emprunté', detail: formatMoney(loan.principal.amount, currency) },
              { term: 'Taux nominal', detail: rateLabel(loan.nominalRate) },
              { term: 'Première échéance', detail: formatDateFr(loan.firstDueOn) },
              { term: 'Durée', detail: `${String(loan.termMonths)} mois` },
              { term: 'Différé', detail: loan.deferralKind === 'none' ? deferralLabel.none : `${deferralLabel[loan.deferralKind]} · ${String(loan.deferralMonths)} mois` },
              { term: 'Assurance', detail: insuranceLabel[loan.insuranceMode] },
              ...(loan.insuranceRate === null ? [] : [{ term: 'Taux d’assurance', detail: rateLabel(loan.insuranceRate) }]),
              ...(loan.insuranceAmount === null ? [] : [{ term: 'Assurance par échéance', detail: formatMoney(loan.insuranceAmount.amount, currency) }]),
              { term: 'Référence du contrat', detail: loan.contractReference ?? 'Non renseignée' },
              { term: 'Échéancier', detail: sourceLabel[loan.scheduleSource] },
            ]}
          />
        </SectionCard>
        <SectionCard id="loan-outstanding" title="Capital restant dû">
          <p className="text-value tabular-nums text-fg">{formatMoney(loan.outstanding.amount.amount, loan.outstanding.amount.currency)}</p>
          <p className="text-caption text-fg-subtle">
            {`Selon l’échéancier au ${formatDateFr(loan.outstanding.asOf)}. Donnée contractuelle, jamais un solde comptable : le prêt n’écrit rien au grand livre.`}
          </p>
          {loan.repaidOn === null ? null : <p className="text-body text-fg-muted">{`Soldé le ${formatDateFr(loan.repaidOn)}.`}</p>}
        </SectionCard>
      </div>
      <SectionCard id="loan-schedule" title="Tableau d’amortissement">
        <QueryState query={schedule} label="Chargement du tableau" title="Impossible de charger le tableau" onRetry={retry} />
        {schedule.data ? <ScheduleTable schedule={schedule.data} /> : null}
      </SectionCard>
      <SectionCard id="loan-fees" title="Frais d’emprunt">
        {loan.fees.length === 0 ? (
          <p className="text-body text-fg-muted">Aucun frais enregistré.</p>
        ) : (
          <Table scrollLabel="Frais d’emprunt, défilement horizontal">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nature</TableHeaderCell>
                <TableHeaderCell>Payé le</TableHeaderCell>
                <TableHeaderCell numeric>Montant</TableHeaderCell>
                <TableHeaderCell>Justificatif</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loan.fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>{feeLabel[fee.kind]}</TableCell>
                  <TableCell>{formatDateFr(fee.paidOn)}</TableCell>
                  <TableCell numeric>{formatMoney(fee.amount.amount, fee.amount.currency)}</TableCell>
                  <TableCell>{fee.hasFile ? 'Joint' : 'Aucun'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <SectionCard id="loan-attestations" title="Attestations de la banque">
        {loan.attestations.length === 0 ? (
          <p className="text-body text-fg-muted">Aucune attestation. Sans attestation, la déclaration utilise l’échéancier.</p>
        ) : (
          <Table scrollLabel="Attestations de la banque, défilement horizontal">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Année</TableHeaderCell>
                <TableHeaderCell numeric>Intérêts</TableHeaderCell>
                <TableHeaderCell numeric>Assurance</TableHeaderCell>
                <TableHeaderCell numeric>Frais</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loan.attestations.map((attestation) => (
                <TableRow key={attestation.id}>
                  <TableCell strong>{attestation.incomeYear}</TableCell>
                  <TableCell numeric>{formatMoney(attestation.interest.amount, attestation.interest.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(attestation.insurance.amount, attestation.insurance.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(attestation.fees.amount, attestation.fees.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <p className="flex items-center gap-1 text-caption text-fg-subtle">
        <Icon icon={Landmark} />
        Les montants fiscaux de l’année sont calculés par le serveur à partir de ces données.
      </p>
      <PrepayDialog open={dialog === 'prepay'} loan={loan} schedule={schedule.data} onClose={close} />
      <ImportScheduleDialog open={dialog === 'import'} loan={loan} onClose={close} />
      <FeeDialog open={dialog === 'fee'} loan={loan} onClose={close} />
      <AttestationDialog open={dialog === 'attestation'} loan={loan} onClose={close} />
      <VoidLoanDialog open={dialog === 'void'} loan={loan} onClose={close} />
    </>
  );
}
