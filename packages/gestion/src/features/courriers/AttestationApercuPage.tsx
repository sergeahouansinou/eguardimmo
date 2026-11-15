'use client';

import { useAttestations } from '../baux/hooks';
import { paymentMethodLabel } from '../baux/schemas';
import type { Attestation } from '../baux/schemas';
import { useLeaseLookups } from '../baux/BauxParts';
import { BAILLEUR, DocumentViewer, Paper, PaperHeader } from './DocumentViewer';
import { RecordGate } from './RecordGate';
import { courriersPaths } from './paths';
import { LedgerLines, LinkButton, PageHeader } from '../locataires/kit';
import { formatDateFr, longDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { bauxPaths } from '../baux/paths';

const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }];

export function AttestationApercuPage({ id }: { id: string }) {
  const attestations = useAttestations();
  return (
    <RecordGate
      query={attestations}
      find={(item) => item.id === id}
      crumbs={crumbs}
      title="Attestation de restitution"
      missing={{ title: 'Attestation introuvable', description: 'Elle n’existe pas ou le lien est incorrect.', backHref: bauxPaths.list, backLabel: 'Retour aux baux' }}
    >
      {(attestation) => <AttestationSheet attestation={attestation} />}
    </RecordGate>
  );
}

function AttestationSheet({ attestation }: { attestation: Attestation }) {
  const lookups = useLeaseLookups();
  const deductions = attestation.deductions.reduce((sum, line) => sum + line.amount, 0);
  const tenant = `${attestation.tenantCivility} ${attestation.tenantName}`.trim();
  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: attestation.number }]}
        title={`Attestation ${attestation.number}`}
        subtitle={`${attestation.tenantName}, bail ${attestation.leaseReference}`}
        actions={<LinkButton href={bauxPaths.detail(attestation.leaseId)}>Voir le bail</LinkButton>}
      />
      <DocumentViewer title={attestation.number}>
        <Paper label={`Attestation de restitution ${attestation.number}`}>
          <PaperHeader right={<><b className="text-block-title">Attestation de restitution</b><span className="text-body text-fg-muted">{`N° ${attestation.number}`}</span></>} />
          <div className="flex flex-col">
            <b className="text-body-strong">{tenant}</b>
            <span className="text-body text-fg-muted">{lookups.unitLabel(attestation.unitId)}</span>
          </div>
          <p className="text-body">{`Je soussigné, ${BAILLEUR.name}, atteste que le dépôt de garantie de ${money(attestation.deposit)}, reçu le ${formatDateFr(attestation.depositReceivedOn)}, a été décompté puis restitué à ${tenant} à l’issue du bail ${attestation.leaseReference} (du ${formatDateFr(attestation.leaseStart)} au ${formatDateFr(attestation.leaseEnd)}). L’état des lieux de sortie a été établi le ${formatDateFr(attestation.exitDate)}.`}</p>
          <LedgerLines
            lines={[
              { label: 'Dépôt de garantie versé', value: money(attestation.deposit) },
              ...attestation.deductions.map((line) => ({ label: `${line.label}${line.reference === '' ? '' : `, ${line.reference}`}`, value: money(-line.amount) })),
              ...(attestation.unpaid > 0 ? [{ label: 'Loyers impayés', value: money(-attestation.unpaid) }] : []),
            ]}
            total={{ label: `Montant restitué, par ${paymentMethodLabel[attestation.paymentMethod].toLowerCase()}`, value: money(attestation.returned) }}
          />
          <p className="text-caption text-fg-subtle">{`Retenues totales : ${money(deductions + attestation.unpaid)}. Cette attestation vaut décompte définitif du dépôt de garantie.`}</p>
          <footer className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3 text-caption text-fg-subtle">
            <span>{`Établie le ${longDateFr(attestation.issuedOn)}`}</span>
            <span>{`Empreinte du document : ${attestation.fingerprint}`}</span>
          </footer>
        </Paper>
      </DocumentViewer>
    </>
  );
}
