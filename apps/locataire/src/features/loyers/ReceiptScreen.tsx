'use client';

import { Button, Card, CardHeader, CardTitle, Icon, IconButton, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { ChevronLeft, ChevronRight, Download, Maximize2, Minus, Plus, Printer, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Async, NotFoundState } from '@/components/ScreenState';
import { PageHeader } from '@/components/PageHeader';
import { KeyValueList, TotalsList } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useReceipt } from '@/data/queries';
import type { Receipt } from '@/data/schemas/loyers';
import { formatDate, formatDateTime, monthOf, yearOf } from '@/lib/dates';
import { downloadDemoPdf } from '@eguardimmo/shell';
import { formatMoney } from '@/lib/money';
import { ReceiptDocument } from './ReceiptDocument';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const ZOOM_STEP = 10;

export function ReceiptScreen({ receiptId }: { receiptId: string }) {
  const receipt = useReceipt(receiptId);
  return (
    <Async query={receipt} errorTitle="La quittance n’a pas pu être chargée">
      {(data) =>
        data ? <ReceiptViewer receipt={data} /> : <NotFoundState title="Quittance introuvable" backHref="/loyers" backLabel="Revenir à mes loyers" />
      }
    </Async>
  );
}

function ReceiptViewer({ receipt }: { receipt: Receipt }) {
  const [zoom, setZoom] = useState(100);
  const [verifying, setVerifying] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const scale = zoom / 100;
  const title = `Quittance ${monthOf(receipt.installmentId)} ${String(yearOf(receipt.periodStart))}`;

  const fit = () => {
    const width = stageRef.current?.clientWidth ?? A4_WIDTH;
    setZoom(Math.max(30, Math.min(150, Math.floor(((width - 32) / A4_WIDTH) * 100))));
  };
  const print = () => { window.print(); };
  const download = () => {
    downloadDemoPdf(`${receipt.number}.pdf`, `Quittance de loyer ${receipt.number}`, [
      `${receipt.landlord.name} - ${receipt.tenantName}`,
      `Montant recu : ${formatMoney(receipt.totalReceivedCents, { fixed: true })}`,
      `Soldee le ${formatDate(receipt.paidOn)}`,
    ]);
  };

  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: 'Loyers et quittances', href: '/loyers' }, { label: 'Quittances' }, { label: receipt.number }]}
        badge={<StatusBadge tone="success">Scellée</StatusBadge>}
        subtitle="Document émis par votre bailleur lorsque l’échéance est soldée."
        actions={
          <>
            <Button variant="secondary" onClick={print}>
              <Icon icon={Printer} />
              Imprimer
            </Button>
            <Button onClick={download}>
              <Icon icon={Download} />
              Télécharger
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-label="Aperçu du PDF" className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <div role="toolbar" aria-label="Aperçu du PDF" className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-1.5 print:hidden">
            <IconButton label="Page précédente" icon={ChevronLeft} size="xs" disabled />
            <span className="text-caption text-fg-muted">Page 1 / 1</span>
            <IconButton label="Page suivante" icon={ChevronRight} size="xs" disabled />
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
            <IconButton label="Réduire" icon={Minus} size="xs" disabled={zoom <= 30} onClick={() => { setZoom(Math.max(30, zoom - ZOOM_STEP)); }} />
            <output aria-label="Niveau de zoom" className="min-w-10 text-center text-caption text-fg-muted">{zoom} %</output>
            <IconButton label="Agrandir" icon={Plus} size="xs" disabled={zoom >= 150} onClick={() => { setZoom(Math.min(150, zoom + ZOOM_STEP)); }} />
            <Button variant="ghost" size="sm" onClick={fit}>
              <Icon icon={Maximize2} />
              Ajuster
            </Button>
            <span className="flex-1" />
            <IconButton label="Imprimer la quittance" icon={Printer} size="xs" onClick={print} />
            <IconButton label="Télécharger le PDF" icon={Download} size="xs" onClick={download} />
          </div>
          <div ref={stageRef} className="overflow-auto bg-muted p-4 print:overflow-visible print:bg-surface print:p-0">
            <div
              className="print-reset mx-auto origin-top-left"
              style={{ width: A4_WIDTH * scale, height: A4_HEIGHT * scale }}
            >
              <div className="print-reset origin-top-left" style={{ width: A4_WIDTH, transform: `scale(${String(scale)})` }}>
                <ReceiptDocument receipt={receipt} />
              </div>
            </div>
          </div>
        </section>
        <aside className="flex min-w-0 flex-col gap-3 print:hidden">
          <Card role="region" aria-labelledby="qt-document" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="qt-document">Document</CardTitle>
            </CardHeader>
            <KeyValueList
              labelWidth="6.5rem"
              items={[
                { label: 'Numéro', value: receipt.number },
                { label: 'Locataire', value: receipt.tenantName },
                { label: 'Bien', value: receipt.propertyLabel.split(' · ')[0] ?? receipt.propertyLabel },
                { label: 'Montant', value: formatMoney(receipt.totalReceivedCents) },
                { label: 'État', value: <StatusBadge tone="success">Scellée</StatusBadge> },
              ]}
            />
          </Card>
          <Card role="region" aria-labelledby="qt-paiement" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="qt-paiement">Paiement</CardTitle>
            </CardHeader>
            <TotalsList
              items={[
                { label: 'Échéance', value: formatDate(receipt.periodStart) },
                { label: 'Payée le', value: formatDate(receipt.paidOn) },
                { label: 'Reste dû', value: '0 €' },
              ]}
            />
          </Card>
          <Card role="region" aria-labelledby="qt-scellement" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="qt-scellement">Scellement</CardTitle>
              <Button variant="link" size="sm" onClick={() => { setVerifying(true); }}>
                Vérifier
              </Button>
            </CardHeader>
            <KeyValueList
              labelWidth="6.5rem"
              items={[
                { label: 'Empreinte', value: receipt.seal.fingerprint },
                { label: 'Horodatage', value: formatDateTime(receipt.seal.sealedAt).replace(',', '') },
              ]}
            />
          </Card>
        </aside>
      </div>
      <Dialog open={verifying} onOpenChange={setVerifying}>
        <DialogContent
          title="Vérification du scellement"
          description="Contrôle de l’empreinte du document (simulation de démonstration)."
        >
          <div className="flex flex-col gap-3 p-4">
            <p className="flex items-start gap-2 text-body text-fg">
              <Icon icon={ShieldCheck} className="mt-0.5 text-fg-subtle" />
              <span>
                L’empreinte <b>{receipt.seal.fingerprint}</b> correspond à celle enregistrée le {formatDateTime(receipt.seal.sealedAt)} : le document n’a pas été modifié.
              </span>
            </p>
            <DialogClose asChild>
              <Button variant="secondary" className="self-end" data-autofocus>
                Fermer
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
