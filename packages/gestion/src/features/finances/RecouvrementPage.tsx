'use client';

import { BookOpen, CalendarClock, Gavel, ListChecks, Mail } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Icon, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { downloadCsv } from './csv';
import { formatDate } from './dates';
import { bailOf, dossierSteps, dossierTotals, resteDu } from './derive';
import { formatMoneyInput } from './money';
import { EmptyBlock, FINANCES_ROUTES, NotFoundBlock, PageHeader, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import type { FinancesData } from './schemas';
import { financesPaths } from './paths';
import { PlanDialog } from './impayes/PlanDialog';
import { BillFeesDialog } from './recouvrement/BillFeesDialog';
import { DiligenceDialog } from './recouvrement/DiligenceDialog';

export function RecouvrementPage({ Link, navigate, echeanceId }: ScreenProps & { echeanceId: string }) {
  const query = useFinances();
  const echeance = query.data?.echeances.find((item) => item.id === echeanceId);
  const bail = query.data && echeance ? bailOf(query.data, echeance.bailId) : undefined;
  return (
    <QueryGate query={query} errorTitle="Le dossier n’a pas pu être chargé">
      {(data) => {
        if (!echeance || !bail) {
          return (
            <>
              <PageHeader Link={Link} crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Impayés', href: FINANCES_ROUTES.impayes }, { label: 'Recouvrement' }]} title="Recouvrement" />
              <NotFoundBlock Link={Link} title="Impayé introuvable" backHref={FINANCES_ROUTES.impayes} backLabel="Retour aux impayés" />
            </>
          );
        }
        return <RecouvrementContent data={data} echeanceId={echeanceId} Link={Link} navigate={navigate} />;
      }}
    </QueryGate>
  );
}

function RecouvrementContent({ data, echeanceId, Link, navigate }: ScreenProps & { data: FinancesData; echeanceId: string }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const [diligence, setDiligence] = useState(false);
  const [plan, setPlan] = useState(false);
  const [billing, setBilling] = useState(false);
  const echeance = data.echeances.find((item) => item.id === echeanceId);
  const bail = echeance ? bailOf(data, echeance.bailId) : undefined;
  const dossier = data.dossiers.find((item) => item.echeanceId === echeanceId);
  if (!echeance || !bail) return null;
  const reste = resteDu(echeance);
  
  const crumbs = [
    { label: 'Finances', href: FINANCES_ROUTES.operations },
    { label: 'Impayés', href: FINANCES_ROUTES.impayes },
    { label: bail.locataire, href: financesPaths.impaye(echeanceId) },
    { label: 'Recouvrement' },
  ];
  const subtitle = `${bail.unite}, ${bail.immeuble} · ${echeance.libelle.toLowerCase()} impayé depuis le ${formatDate(echeance.echeance)}`;

  if (!dossier) {
    return (
      <>
        <PageHeader Link={Link} crumbs={crumbs} title={`Recouvrement, ${bail.locataire}`} description={subtitle} />
        {exec.error ? <Alert tone="danger" title="L’opération n’a pas été enregistrée">{exec.error.message}</Alert> : null}
        <EmptyBlock
          title="Aucun dossier de recouvrement"
          action={
            reste > 0 ? (
              <Button loading={exec.pending} onClick={() => { exec.run({ type: 'openDossier', echeanceId }); }}>
                Ouvrir le dossier
              </Button>
            ) : null
          }
        >
          {reste > 0 ? `Le dossier regroupe les relances, les actes et leurs frais pour ${money(reste)} impayés.` : 'Cette échéance est soldée : aucun dossier à ouvrir.'}
        </EmptyBlock>
      </>
    );
  }

  const totals = dossierTotals(data, dossier);
  const solde = reste <= 0;
  const steps = dossierSteps(dossier, solde, formatDate);
  const current = steps.find((step) => step.state === 'cur');
  const factures = data.factures.filter((facture) => facture.dossierId === dossier.id && facture.type === 'facture').sort((x, y) => x.numero.localeCompare(y.numero));
  const lastFacture = factures[factures.length - 1];
  const factureOf = (id: string | null) => data.factures.find((facture) => facture.id === id);

  const exportCarnet = () => {
    downloadCsv(`carnet-${dossier.numero}.csv`, [
      ['N°', 'Date', 'Acte', 'Intervenant', 'Coût', 'Facture'],
      ...dossier.actes.map((acte, index) => [index + 1, formatDate(acte.date), acte.libelle, acte.intervenant, formatMoneyInput(acte.cout), factureOf(acte.factureId)?.numero ?? '']),
    ]);
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={crumbs}
        title={`Recouvrement, ${bail.locataire}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {current ? <Badge tone="danger">{current.label}</Badge> : null}
            <Badge>Dossier {dossier.numero}</Badge>
            <span>{subtitle}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" disabled={solde} onClick={() => { setPlan(true); }}>
              Proposer un échéancier
            </Button>
            <Button variant="secondary" onClick={() => { navigate(financesPaths.grandLivre(echeanceId)); }}>
              <Icon icon={BookOpen} />
              Grand livre
            </Button>
            <Button onClick={() => { setDiligence(true); }}>Ajouter une diligence</Button>
          </>
        }
      />
      {exec.error ? <Alert tone="danger" title="L’opération n’a pas été enregistrée">{exec.error.message}</Alert> : null}
      <section aria-label="Chiffres du dossier" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dette principale" tone="danger" value={money(totals.dette)}>
          <span className="text-caption text-fg-subtle">{echeance.libelle}</span>
        </StatCard>
        <StatCard label="Frais engagés" value={money(totals.frais)}>
          <span className="text-caption text-fg-subtle">Dont {money(totals.fraisRegles)} déjà réglés</span>
        </StatCard>
        <StatCard label="Total à recouvrer" tone="danger" value={money(totals.totalARecouvrer)}>
          <span className="text-caption text-fg-subtle">Dette et frais facturés</span>
        </StatCard>
        <StatCard label="Dossier ouvert" value={`${String(totals.jours)} jour${totals.jours > 1 ? 's' : ''}`}>
          <span className="text-caption text-fg-subtle">Depuis le {formatDate(dossier.ouvertLe)}</span>
        </StatCard>
      </section>

      <Card aria-labelledby="re-etapes">
        <CardTitle as="h2" id="re-etapes">Étapes de la procédure</CardTitle>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step) => (
            <li key={step.id} aria-current={step.state === 'cur' ? 'step' : undefined} className={`flex flex-col gap-0.5 rounded-md border p-2 ${step.state === 'cur' ? 'border-action bg-action-subtle' : 'border-line'}`}>
              <span className={`text-body-strong ${step.state === 'todo' ? 'text-fg-subtle' : 'text-fg'}`}>{step.label}</span>
              <span className="text-caption text-fg-subtle">
                {step.state === 'done' ? 'Fait · ' : step.state === 'cur' ? 'En cours · ' : ''}
                {step.caption}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card aria-labelledby="re-carnet">
        <CardHeader>
          <CardTitle as="h2" id="re-carnet">Carnet du commissaire de justice</CardTitle>
          <Button variant="link" size="sm" onClick={exportCarnet}>
            Exporter le carnet
          </Button>
        </CardHeader>
        {dossier.actes.length === 0 ? (
          <EmptyBlock title="Aucun acte au carnet">Ajoutez une diligence pour tracer la première relance.</EmptyBlock>
        ) : (
          <Table aria-label="Carnet des actes">
            <TableHead>
              <tr>
                <TableHeaderCell>N°</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Acte</TableHeaderCell>
                <TableHeaderCell>Intervenant</TableHeaderCell>
                <TableHeaderCell numeric>Coût</TableHeaderCell>
                <TableHeaderCell>Refacturé</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {dossier.actes.map((acte, index) => {
                const facture = factureOf(acte.factureId);
                let billed: ReactNode = <span className="text-caption text-fg-subtle">Sans frais</span>;
                if (facture) billed = <Badge tone={facture.statut === 'payee' ? 'success' : 'warning'}>{facture.numero} {facture.statut === 'payee' ? 'Payée' : 'En attente'}</Badge>;
                else if (acte.cout > 0) billed = <Badge tone="neutral">À refacturer</Badge>;
                return (
                  <TableRow key={acte.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{formatDate(acte.date)}</TableCell>
                    <TableCell strong>{acte.libelle}</TableCell>
                    <TableCell>{acte.intervenant}</TableCell>
                    <TableCell numeric>{money(acte.cout)}</TableCell>
                    <TableCell>{billed}</TableCell>
                    <TableCell>
                      {facture ? (
                        <Button variant="link" size="sm" asChild>
                          <Link href={financesPaths.facture(facture.id)}>Ouvrir</Link>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <p className="flex flex-wrap items-center justify-between gap-2 text-caption text-fg-subtle">
          <span>{dossier.actes.length} acte{dossier.actes.length > 1 ? 's' : ''} · frais engagés {money(totals.frais)}</span>
          <span>Les frais sont refacturés au locataire par une facture adressée.</span>
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card aria-labelledby="re-facture">
          <CardHeader>
            <CardTitle as="h2" id="re-facture">Facture des frais</CardTitle>
            {lastFacture ? (
              <Button variant="link" size="sm" asChild>
                <Link href={financesPaths.facture(lastFacture.id)}>Aperçu du PDF</Link>
              </Button>
            ) : null}
          </CardHeader>
          {lastFacture ? (
            <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-body">
              <dt className="text-fg-subtle">Numéro</dt>
              <dd>{lastFacture.numero}</dd>
              <dt className="text-fg-subtle">Destinataire</dt>
              <dd>{lastFacture.destinataire}</dd>
              <dt className="text-fg-subtle">Montant</dt>
              <dd>{money(lastFacture.montantTtc)}</dd>
              <dt className="text-fg-subtle">Échéance</dt>
              <dd>{lastFacture.echeance ? formatDate(lastFacture.echeance) : '—'}</dd>
              <dt className="text-fg-subtle">État</dt>
              <dd><Badge tone={lastFacture.statut === 'payee' ? 'success' : 'warning'}>{lastFacture.statut === 'payee' ? 'Payée' : 'En attente'}</Badge></dd>
            </dl>
          ) : (
            <p className="text-body text-fg-muted">Aucune facture de frais émise pour ce dossier.</p>
          )}
          {totals.nonRefactures > 0 ? (
            <Alert tone="warning" title={`${money(totals.nonRefactures)} de frais non refacturés`}>
              <Button size="sm" variant="secondary" onClick={() => { setBilling(true); }}>
                Facturer les frais
              </Button>
            </Alert>
          ) : null}
        </Card>

        <Card aria-labelledby="re-suite">
          <CardTitle as="h2" id="re-suite">Prochaine étape</CardTitle>
          <ul className="flex flex-col text-body">
            <li className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
              <Icon icon={CalendarClock} className="text-fg-subtle" />
              <span className="flex grow flex-col">
                <b>Délai de huit jours</b>
                <span className="text-caption text-fg-subtle">{dossier.delaiJusquau ? `Jusqu’au ${formatDate(dossier.delaiJusquau)}` : 'Démarre au commandement de payer'}</span>
              </span>
              {dossier.delaiJusquau && !solde ? <Badge tone="warning">En cours</Badge> : null}
            </li>
            <li className="flex items-center gap-2 border-t border-line py-2">
              <Icon icon={ListChecks} className="text-fg-subtle" />
              <span className="flex grow flex-col">
                <b>Échéancier de paiement</b>
                <span className="text-caption text-fg-subtle">
                  {dossier.plan ? `${String(dossier.plan.lignes.length)} versements proposés le ${formatDate(dossier.plan.propositionLe)}` : 'À proposer si le locataire le demande'}
                </span>
              </span>
              {!dossier.plan && !solde ? (
                <Button variant="link" size="sm" onClick={() => { setPlan(true); }}>
                  Proposer
                </Button>
              ) : null}
            </li>
            <li className="flex items-center gap-2 border-t border-line py-2">
              <Icon icon={Gavel} className="text-fg-subtle" />
              <span className="flex grow flex-col">
                <b>Assignation</b>
                <span className="text-caption text-fg-subtle">Si l’impayé subsiste après le délai</span>
              </span>
            </li>
            <li className="flex items-center gap-2 border-t border-line py-2">
              <Icon icon={Mail} className="text-fg-subtle" />
              <span className="flex grow flex-col">
                <b>Relances du dossier</b>
                <span className="text-caption text-fg-subtle">{data.relances.filter((relance) => relance.echeanceId === echeanceId).length} relance(s) tracée(s)</span>
              </span>
              <Button variant="link" size="sm" onClick={() => { navigate(financesPaths.relance(echeanceId)); }}>
                Aperçu
              </Button>
            </li>
          </ul>
          {dossier.plan ? (
            <ol aria-label="Échéancier proposé" className="flex flex-col rounded-md border border-line text-body">
              {dossier.plan.lignes.map((line, index) => (
                <li key={line.date} className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5 first:border-t-0">
                  <span className="text-fg-muted">{index + 1}. {formatDate(line.date)}</span>
                  <b>{money(line.montant)}</b>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      </div>

      {diligence ? (
        <DiligenceDialog
          open
          today={data.today}
          pending={exec.pending}
          error={exec.error}
          onClose={() => { setDiligence(false); exec.reset(); }}
          onSubmit={(values) => { exec.run({ type: 'addDiligence', dossierId: dossier.id, ...values }, { onDone: () => { setDiligence(false); } }); }}
        />
      ) : null}
      <PlanDialog
        open={plan}
        reste={Math.max(reste, 0)}
        today={data.today}
        money={money}
        pending={exec.pending}
        error={exec.error}
        onClose={() => { setPlan(false); exec.reset(); }}
        onSubmit={(values) => { exec.run({ type: 'proposePlan', echeanceId, ...values }, { onDone: () => { setPlan(false); } }); }}
      />
      <BillFeesDialog
        open={billing}
        today={data.today}
        amount={money(totals.nonRefactures)}
        pending={exec.pending}
        error={exec.error}
        onClose={() => { setBilling(false); exec.reset(); }}
        onSubmit={(echeanceDate) => { exec.run({ type: 'billDossierFees', dossierId: dossier.id, echeance: echeanceDate }, { onDone: () => { setBilling(false); } }); }}
      />
    </>
  );
}
