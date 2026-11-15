'use client';

import { Button } from '@eguardimmo/ui';
import { useLeaseLookups } from '../baux/BauxParts';
import { noticeTotal } from './AvisEcheancePage';
import { DocumentViewer, Paper, PaperHeader } from './DocumentViewer';
import { RecordGate } from './RecordGate';
import { useNotices, useSendNotice } from './hooks';
import { courriersPaths } from './paths';
import type { Notice } from './schemas';
import { LedgerLines, LinkButton, PageHeader, errorMessage, useNotify } from '../locataires/kit';
import { formatDateFr, longDateFr, monthLabel } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';

const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Avis d’échéance', href: courriersPaths.notices }];

export function AvisEcheanceApercuPage({ id }: { id: string }) {
  const notices = useNotices();
  return (
    <RecordGate
      query={notices}
      find={(item) => item.id === id}
      crumbs={crumbs}
      title="Avis d’échéance"
      missing={{ title: 'Avis introuvable', description: 'Il a peut-être été supprimé ou le lien est incorrect.', backHref: courriersPaths.notices, backLabel: 'Retour aux avis' }}
    >
      {(notice) => <NoticeSheet notice={notice} />}
    </RecordGate>
  );
}

function NoticeSheet({ notice }: { notice: Notice }) {
  const lookups = useLeaseLookups();
  const send = useSendNotice();
  const notify = useNotify();
  const tenant = `${lookups.tenantCivility(notice.tenantId)} ${lookups.tenantName(notice.tenantId)}`.trim();
  const label = `${lookups.tenantName(notice.tenantId)}, ${monthLabel(notice.month)}`;

  const sendNotice = async () => {
    try {
      await send.mutateAsync(notice.id);
      notify({ title: 'Avis envoyé', description: label });
    } catch (error) {
      notify({ tone: 'danger', title: 'Envoi impossible', description: errorMessage(error) });
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label }]}
        title={`Avis d’échéance, ${monthLabel(notice.month)}`}
        subtitle={lookups.tenantName(notice.tenantId)}
        actions={
          <>
            <LinkButton href={courriersPaths.notices}>Retour aux avis</LinkButton>
            {notice.sentOn ? null : <Button loading={send.isPending} onClick={() => { void sendNotice(); }}>Envoyer à {lookups.tenantName(notice.tenantId)}</Button>}
          </>
        }
      />
      <DocumentViewer title={label}>
        <Paper label={`Avis d’échéance ${label}`}>
          <PaperHeader right={<><b className="text-block-title">Avis d’échéance</b><span className="text-body text-fg-muted">{monthLabel(notice.month)}</span></>} />
          <div className="flex flex-col">
            <b className="text-body-strong">{tenant}</b>
            <span className="text-body text-fg-muted">{lookups.unitLabel(notice.unitId)}</span>
          </div>
          <p className="text-body">{`Voici le détail de la somme à régler avant le ${longDateFr(notice.due)} pour le logement ${lookups.unitLabel(notice.unitId)}.`}</p>
          <LedgerLines
            lines={[
              { label: 'Loyer', value: money(notice.rent) },
              { label: 'Provision pour charges', value: money(notice.charges) },
              ...(notice.arrears > 0 ? [{ label: 'Reliquat des mois précédents', value: money(notice.arrears) }] : []),
            ]}
            total={{ label: 'Total à régler', value: money(noticeTotal(notice)) }}
          />
          <p className="text-caption text-fg-subtle">Règlement par virement bancaire. Une quittance vous sera adressée après réception du paiement.</p>
          <footer className="mt-auto border-t border-line pt-3 text-caption text-fg-subtle">{notice.sentOn ? `Envoyé le ${formatDateFr(notice.sentOn)}` : 'Pas encore envoyé'}</footer>
        </Paper>
      </DocumentViewer>
    </>
  );
}
