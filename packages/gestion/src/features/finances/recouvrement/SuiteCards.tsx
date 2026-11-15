'use client';

import { CalendarClock, Gavel, ListChecks, Mail } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Icon } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import type { DossierTotals } from '../derive';
import { financesPaths } from '../paths';
import type { Dossier, FinancesData } from '../schemas';

export function SuiteCards({
  data,
  dossier,
  totals,
  solde,
  relanceEcheanceId,
  money,
  Link,
  onBill,
  onPlan,
  onPreview,
}: {
  data: FinancesData;
  dossier: Dossier;
  totals: DossierTotals;
  solde: boolean;
  relanceEcheanceId: string | null;
  money: (minor: number) => string;
  Link: LinkComponent;
  onBill: () => void;
  onPlan: () => void;
  onPreview: (echeanceId: string) => void;
}) {
  const factures = data.factures.filter((facture) => facture.dossierId === dossier.id && facture.type === 'facture').sort((x, y) => x.numero.localeCompare(y.numero));
  const lastFacture = factures[factures.length - 1];
  const echeanceIds = new Set(dossier.creances.filter((creance) => creance.kind === 'echeance').map((creance) => creance.refId));
  const relances = data.relances.filter((relance) => echeanceIds.has(relance.echeanceId)).length;
  return (
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
            <Button size="sm" variant="secondary" onClick={onBill}>
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
              <Button variant="link" size="sm" onClick={onPlan}>
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
              <span className="text-caption text-fg-subtle">{relances} relance(s) tracée(s)</span>
            </span>
            {relanceEcheanceId ? (
              <Button variant="link" size="sm" onClick={() => { onPreview(relanceEcheanceId); }}>
                Aperçu
              </Button>
            ) : null}
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
  );
}
