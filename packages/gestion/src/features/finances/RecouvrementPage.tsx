'use client';

import { BookOpen, CalendarClock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Alert, Badge, Button, Card, CardTitle, ConfirmDialog, Icon, StatCard } from '@eguardimmo/ui';
import { downloadText } from './csv';
import { formatDate } from './dates';
import { bailOf, creancesActives, dossierSteps, dossierTotals } from './derive';
import { pushFlash } from './flash';
import { FINANCES_ROUTES, NotFoundBlock, PageHeader, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import type { Dossier, FinancesData, Liasse, Transmission } from './schemas';
import { financesPaths } from './paths';
import { useContacts } from '../suivi/contacts/source';
import { PlanDialog } from './impayes/PlanDialog';
import { BillFeesDialog } from './recouvrement/BillFeesDialog';
import { CarnetCard } from './recouvrement/CarnetCard';
import { creanceOptions, firstEcheanceId } from './recouvrement/creances';
import { CreancesCard } from './recouvrement/CreancesCard';
import { DiligenceDialog } from './recouvrement/DiligenceDialog';
import { EnvoisCard } from './recouvrement/EnvoisCard';
import { OpenDossierDialog } from './recouvrement/OpenDossierDialog';
import { buildPieces, formatOctets } from './recouvrement/pieces';
import { PiecesCard } from './recouvrement/PiecesCard';
import { SuiteCards } from './recouvrement/SuiteCards';
import { TransmitDialog } from './recouvrement/TransmitDialog';

export function RecouvrementPage({ Link, navigate, dossierId }: ScreenProps & { dossierId: string }) {
  const query = useFinances();
  return (
    <QueryGate query={query} errorTitle="Le dossier n’a pas pu être chargé">
      {(data) => {
        const dossier = data.dossiers.find((item) => item.id === dossierId);
        if (!dossier || !bailOf(data, dossier.bailId)) {
          return (
            <>
              <PageHeader Link={Link} crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Impayés', href: FINANCES_ROUTES.impayes }, { label: 'Recouvrement' }]} title="Recouvrement" />
              <NotFoundBlock Link={Link} title="Dossier introuvable" backHref={FINANCES_ROUTES.impayes} backLabel="Retour aux impayés" />
            </>
          );
        }
        return <RecouvrementContent data={data} dossier={dossier} Link={Link} navigate={navigate} />;
      }}
    </QueryGate>
  );
}

function manifestOf(dossier: Dossier, liasse: Liasse): string {
  const lines = liasse.pieces.map((piece, index) => `${String(index + 1)}. ${piece.libelle} (${formatOctets(piece.octets)})`);
  return [`Dossier ${dossier.numero}`, `Envoi généré le ${formatDate(liasse.genereLe)}`, `${String(liasse.pieces.length)} pièces, ${formatOctets(liasse.octets)}`, '', ...lines, ''].join('\r\n');
}

function RecouvrementContent({ data, dossier, Link, navigate }: ScreenProps & { data: FinancesData; dossier: Dossier }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const contacts = useContacts();
  const [diligence, setDiligence] = useState(false);
  const [plan, setPlan] = useState(false);
  const [billing, setBilling] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [transmitting, setTransmitting] = useState<Liasse | null>(null);
  const [revoking, setRevoking] = useState<Transmission | null>(null);
  const [resending, setResending] = useState<Transmission | null>(null);
  const bail = bailOf(data, dossier.bailId);
  if (!bail) return null;
  const totals = dossierTotals(data, dossier);
  const solde = totals.dette <= 0;
  const steps = dossierSteps(dossier, solde, formatDate);
  const current = steps.find((step) => step.state === 'cur');
  const removed = dossier.creances.find((creance) => creance.id === removing);
  const livreEcheanceId = firstEcheanceId(dossier) ?? data.echeances.find((echeance) => echeance.bailId === bail.id)?.id ?? null;
  const commissaires = (contacts.data ?? []).filter((contact) => contact.category === 'commissaire' && !contact.archived);
  const modal = diligence || plan || billing || adding || transmitting !== null;
  const nbCreances = creancesActives(dossier).length;

  const download = (liasse: Liasse) => {
    downloadText(`${dossier.numero}-pieces-${liasse.genereLe}.txt`, manifestOf(dossier, liasse));
    pushFlash('Téléchargement simulé en démonstration : le fichier contient la liste des pièces, pas le ZIP.');
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Impayés', href: FINANCES_ROUTES.impayes }, { label: `Dossier ${dossier.numero}` }]}
        title={`Recouvrement, ${bail.locataire}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {current ? <Badge tone="danger">{current.label}</Badge> : null}
            <Badge>Dossier {dossier.numero}</Badge>
            <span>{bail.unite}, {bail.immeuble} · bail {bail.numero} · {nbCreances} créance{nbCreances > 1 ? 's' : ''}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" disabled={solde} onClick={() => { setPlan(true); }}>
              <Icon icon={CalendarClock} />
              Proposer un échéancier
            </Button>
            {livreEcheanceId ? (
              <Button variant="secondary" onClick={() => { navigate(financesPaths.grandLivre(livreEcheanceId)); }}>
                <Icon icon={BookOpen} />
                Grand livre
              </Button>
            ) : null}
            <Button onClick={() => { setDiligence(true); }}>
              <Icon icon={Plus} />
              Ajouter une diligence
            </Button>
          </>
        }
      />
      {exec.error && !modal ? <Alert tone="danger" title="L’opération n’a pas été enregistrée">{exec.error.message}</Alert> : null}
      <section aria-label="Chiffres du dossier" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dette principale" tone="danger" value={money(totals.dette)}>
          <span className="text-caption text-fg-subtle">{nbCreances} créance{nbCreances > 1 ? 's' : ''} restant à payer</span>
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

      <CreancesCard data={data} dossier={dossier} money={money} onAdd={() => { setAdding(true); }} onRemove={setRemoving} />

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

      <PiecesCard
        pieces={buildPieces(data, dossier)}
        liasses={dossier.liasses}
        generating={exec.pending}
        onGenerate={(exclues) => { exec.run({ type: 'generateLiasse', dossierId: dossier.id, exclues }); }}
        onDownload={download}
        onTransmit={setTransmitting}
      />
      <EnvoisCard transmissions={dossier.transmissions} today={data.today} onRevoke={setRevoking} onResend={setResending} />
      <CarnetCard data={data} dossier={dossier} totals={totals} money={money} Link={Link} />
      <SuiteCards
        data={data}
        dossier={dossier}
        totals={totals}
        solde={solde}
        relanceEcheanceId={firstEcheanceId(dossier)}
        money={money}
        Link={Link}
        onBill={() => { setBilling(true); }}
        onPlan={() => { setPlan(true); }}
        onPreview={(echeanceId) => { navigate(financesPaths.relance(echeanceId)); }}
      />

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
        reste={totals.dette}
        today={data.today}
        money={money}
        pending={exec.pending}
        error={exec.error}
        onClose={() => { setPlan(false); exec.reset(); }}
        onSubmit={(values) => { exec.run({ type: 'proposePlan', dossierId: dossier.id, echeanceId: null, ...values }, { onDone: () => { setPlan(false); } }); }}
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
      {adding ? (
        <OpenDossierDialog
          title="Ajouter des créances au dossier"
          description={`Créances en retard de ${bail.locataire} qui ne sont dans aucun dossier ouvert.`}
          submitLabel="Ajouter au dossier"
          options={creanceOptions(data, bail.id)}
          initial={[]}
          money={money}
          pending={exec.pending}
          error={exec.error}
          onClose={() => { setAdding(false); exec.reset(); }}
          onSubmit={(creances) => { exec.run({ type: 'addCreances', dossierId: dossier.id, creances }, { onDone: () => { setAdding(false); } }); }}
        />
      ) : null}
      {transmitting && contacts.data ? (
        <TransmitDialog
          liasse={transmitting}
          contacts={commissaires}
          today={data.today}
          Link={Link}
          pending={exec.pending}
          error={exec.error}
          onClose={() => { setTransmitting(null); exec.reset(); }}
          onSubmit={({ contact, dureeJours, message }) => {
            exec.run(
              { type: 'transmitLiasse', dossierId: dossier.id, liasseId: transmitting.id, destinataireId: contact.id, destinataire: contact.name, email: contact.email, dureeJours, message },
              { onDone: () => { setTransmitting(null); } },
            );
          }}
        />
      ) : null}
      <ConfirmDialog
        open={removed !== undefined}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Retirer la créance du dossier ?"
        description={removed ? `« ${removed.libelle} » sort du dossier, mais reste visible à l’historique avec sa date de retrait. Elle n’est pas supprimée.` : ''}
        confirmLabel="Retirer la créance"
        tone="danger"
        loading={exec.pending}
        onConfirm={() => { if (removed) exec.run({ type: 'removeCreance', dossierId: dossier.id, creanceId: removed.id }, { onDone: () => { setRemoving(null); }, onError: () => { setRemoving(null); } }); }}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => { if (!open) setRevoking(null); }}
        title="Révoquer ce lien ?"
        description={revoking ? `${revoking.destinataire} ne pourra plus télécharger les pièces. La révocation est consignée au carnet des diligences.` : ''}
        confirmLabel="Révoquer le lien"
        tone="danger"
        loading={exec.pending}
        onConfirm={() => { if (revoking) exec.run({ type: 'revokeTransmission', dossierId: dossier.id, transmissionId: revoking.id }, { onDone: () => { setRevoking(null); }, onError: () => { setRevoking(null); } }); }}
      />
      <ConfirmDialog
        open={resending !== null}
        onOpenChange={(open) => { if (!open) setResending(null); }}
        title="Renvoyer un lien ?"
        description={resending ? `Un nouveau lien est envoyé à ${resending.destinataire}. S’il est encore actif, l’ancien lien est révoqué.` : ''}
        confirmLabel="Renvoyer un lien"
        loading={exec.pending}
        onConfirm={() => { if (resending) exec.run({ type: 'resendTransmission', dossierId: dossier.id, transmissionId: resending.id }, { onDone: () => { setResending(null); }, onError: () => { setResending(null); } }); }}
      />
    </>
  );
}
