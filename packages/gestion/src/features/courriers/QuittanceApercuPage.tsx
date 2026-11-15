'use client';

import { Alert, Badge } from '@eguardimmo/ui';
import { useLeaseLookups } from '../baux/BauxParts';
import { BAILLEUR, DocumentViewer, Paper, PaperHeader } from './DocumentViewer';
import { RecordGate } from './RecordGate';
import { useReceipts } from './hooks';
import { courriersPaths } from './paths';
import type { Receipt } from './schemas';
import { LedgerLines, LinkButton, PageHeader } from '../locataires/kit';
import { formatDateFr, monthLabel } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';

const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Quittances', href: courriersPaths.quittances }];

export function QuittanceApercuPage({ id }: { id: string }) {
  const receipts = useReceipts();
  return (
    <RecordGate
      query={receipts}
      find={(item) => item.id === id && item.number !== null}
      crumbs={crumbs}
      title="Quittance"
      missing={{ title: 'Quittance introuvable', description: 'Elle n’existe pas ou n’a pas encore été émise.', backHref: courriersPaths.quittances, backLabel: 'Retour aux quittances' }}
    >
      {(receipt) => <ReceiptSheet receipt={receipt} />}
    </RecordGate>
  );
}

function ReceiptSheet({ receipt }: { receipt: Receipt }) {
  const lookups = useLeaseLookups();
  const total = receipt.rent + receipt.charges;
  const number = receipt.number ?? '';
  const tenant = `${lookups.tenantCivility(receipt.tenantId)} ${lookups.tenantName(receipt.tenantId)}`.trim();
  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: number }]}
        title={`Quittance ${number}`}
        subtitle={`${monthLabel(receipt.month)}, ${lookups.tenantName(receipt.tenantId)}`}
        actions={<LinkButton href={courriersPaths.quittances}>Retour aux quittances</LinkButton>}
      />
      {receipt.cancellation ? (
        <Alert tone="danger" title={`Quittance annulée le ${formatDateFr(receipt.cancellation.on)}`}>
          {`Motif : ${receipt.cancellation.reason}. Le document d’origine reste consultable ci-dessous, marqué annulé.`}
        </Alert>
      ) : null}
      <DocumentViewer title={number}>
        <Paper label={`Quittance de loyer ${number}`}>
          <PaperHeader
            right={
              <>
                <b className="text-block-title">Quittance de loyer</b>
                <span className="text-body text-fg-muted">{`N° ${number}`}</span>
                {receipt.cancellation ? <Badge tone="danger">{`ANNULÉE le ${formatDateFr(receipt.cancellation.on)}`}</Badge> : null}
              </>
            }
          />
          <div className="flex flex-col">
            <b className="text-body-strong">{tenant}</b>
            <span className="text-body text-fg-muted">{lookups.unitLabel(receipt.unitId)}</span>
          </div>
          <p className="text-body">{`Je soussigné, ${BAILLEUR.name}, bailleur, déclare avoir reçu de ${tenant} la somme de ${money(total)} au titre du loyer et des charges pour la période de ${monthLabel(receipt.month).toLowerCase()}, et lui en donne quittance, sous réserve de tous mes droits.`}</p>
          <LedgerLines
            lines={[
              { label: 'Loyer', value: money(receipt.rent) },
              { label: 'Provision pour charges', value: money(receipt.charges) },
            ]}
            total={{ label: 'Total réglé', value: money(total) }}
          />
          <p className="text-caption text-fg-subtle">Cette quittance annule tous les reçus partiels éventuellement délivrés pour la même période.</p>
          <footer className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-3 text-caption text-fg-subtle">
            <span>{`Émise le ${formatDateFr(receipt.issuedOn)}${receipt.cancellation ? `, annulée le ${formatDateFr(receipt.cancellation.on)}` : ''}`}</span>
            <span>{receipt.sentOn ? `Envoyée le ${formatDateFr(receipt.sentOn)}` : 'Non envoyée'}</span>
          </footer>
        </Paper>
      </DocumentViewer>
    </>
  );
}
