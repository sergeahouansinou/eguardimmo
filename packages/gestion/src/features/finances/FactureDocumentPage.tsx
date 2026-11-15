'use client';

import { useState } from 'react';
import { Download, ReceiptText, Send } from 'lucide-react';
import { Alert, Button, ConfirmDialog, Icon } from '@eguardimmo/ui';
import { FactureSide, FactureSheet } from './documents/FactureDocument';
import { DocumentViewer } from './documents/Viewer';
import { FINANCES_ROUTES, NotFoundBlock, PageHeader, QueryGate, useExec } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';

export function FactureDocumentPage({ Link, navigate, factureId, autoPrint = false }: ScreenProps & { factureId: string; autoPrint?: boolean }) {
  const query = useFinances();
  const exec = useExec({ navigate });
  const [crediting, setCrediting] = useState(false);
  const facture = query.data?.factures.find((item) => item.id === factureId);
  const dossier = facture?.dossierId ? query.data?.dossiers.find((item) => item.id === facture.dossierId) : undefined;
  const title = !facture ? 'Facture' : dossier ? 'Facture des frais de recouvrement' : `${facture.type === 'avoir' ? 'Avoir' : 'Facture'} ${facture.numero}`;

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Factures', href: FINANCES_ROUTES.factures }, { label: facture?.numero ?? factureId }]}
        title={title}
        description={dossier ? 'Adressée au locataire avec les justificatifs du carnet du commissaire de justice.' : 'Document émis et scellé, numéroté en continu.'}
        actions={
          facture ? (
            <>
              {facture.type === 'facture' && !facture.avoirId ? (
                <Button variant="ghost" onClick={() => { setCrediting(true); }}>
                  <Icon icon={ReceiptText} />
                  Émettre un avoir
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => { window.print(); }}>
                <Icon icon={Download} />
                Télécharger
              </Button>
              <Button loading={exec.pending} onClick={() => { exec.run({ type: 'sendInvoice', factureId: facture.id }); }}>
                <Icon icon={Send} />
                Envoyer par e-mail
              </Button>
            </>
          ) : null
        }
      />
      {exec.error ? (
        <Alert tone="danger" title="L’opération n’a pas été enregistrée">
          {exec.error.message}
        </Alert>
      ) : null}
      <QueryGate query={query} errorTitle="La facture n’a pas pu être chargée">
        {(data) => {
          const found = data.factures.find((item) => item.id === factureId);
          if (!found) return <NotFoundBlock Link={Link} title="Facture introuvable" backHref={FINANCES_ROUTES.factures} backLabel="Retour aux factures" />;
          return (
            <DocumentViewer title="Aperçu du PDF" autoPrint={autoPrint} side={<FactureSide data={data} facture={found} />}>
              <FactureSheet data={data} facture={found} />
            </DocumentViewer>
          );
        }}
      </QueryGate>
      <ConfirmDialog
        open={crediting}
        onOpenChange={setCrediting}
        title="Émettre un avoir ?"
        description={facture ? `Un avoir annule la facture ${facture.numero} : il reçoit son propre numéro et la facture reste consultable.` : ''}
        confirmLabel="Émettre l’avoir"
        tone="danger"
        loading={exec.pending}
        onConfirm={() => { if (facture) exec.run({ type: 'creditInvoice', factureId: facture.id }, { redirect: 'result', onDone: () => { setCrediting(false); }, onError: () => { setCrediting(false); } }); }}
      />
    </>
  );
}
