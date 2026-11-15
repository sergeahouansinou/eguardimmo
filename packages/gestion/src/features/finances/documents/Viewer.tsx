'use client';

import { ChevronLeft, ChevronRight, Download, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card, CardHeader, CardTitle, IconButton } from '@eguardimmo/ui';
import { shortHash } from '../seal';
import { useFinancesSource } from '../source';

const ZOOMS = [50, 75, 100, 125, 150, 200] as const;

const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  [data-print-area], [data-print-area] * { visibility: visible !important; }
  [data-print-area] { position: absolute; inset: 0; width: 100%; margin: 0; border: 0; zoom: 1 !important; }
}`;

export function DocumentViewer({ title, children, side, autoPrint = false }: { title: string; children: ReactNode; side: ReactNode; autoPrint?: boolean }) {
  const [zoom, setZoom] = useState<number>(100);
  const index = ZOOMS.findIndex((value) => value === zoom);
  const print = () => {
    window.print();
  };
  useEffect(() => {
    if (autoPrint) window.print();
  }, [autoPrint]);

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <style>{PRINT_CSS}</style>
      <section aria-label={title} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-muted print:border-0">
        <div role="toolbar" aria-label="Outils de l’aperçu" className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-2 py-1 print:hidden">
          <IconButton label="Page précédente" icon={ChevronLeft} disabled />
          <span className="text-caption text-fg-muted">Page 1 / 1</span>
          <IconButton label="Page suivante" icon={ChevronRight} disabled />
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
          <IconButton label="Réduire" icon={ZoomOut} disabled={index <= 0} onClick={() => { setZoom(ZOOMS[Math.max(0, index - 1)] ?? 100); }} />
          <span className="min-w-10 text-center text-caption text-fg-muted" aria-live="polite">{zoom} %</span>
          <IconButton label="Agrandir" icon={ZoomIn} disabled={index >= ZOOMS.length - 1} onClick={() => { setZoom(ZOOMS[Math.min(ZOOMS.length - 1, index + 1)] ?? 100); }} />
          <Button variant="ghost" size="sm" onClick={() => { setZoom(100); }}>Ajuster</Button>
          <span className="grow" />
          <IconButton label="Imprimer" icon={Printer} onClick={print} />
          <IconButton label="Télécharger le PDF" icon={Download} onClick={print} />
        </div>
        <div className="overflow-auto p-3 sm:p-6">
          <article data-print-area="" style={{ zoom: zoom / 100 }} className="mx-auto flex w-full max-w-[720px] flex-col gap-3 rounded-md border border-line bg-surface p-6 text-fg shadow-none">
            {children}
          </article>
        </div>
      </section>
      <aside className="flex min-w-0 flex-col gap-3 print:hidden">{side}</aside>
    </div>
  );
}

export function SideCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

export function KeyValues({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-2 gap-y-1 text-body">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-fg-subtle">{label}</dt>
          <dd className="min-w-0 text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SealCard({ kind, id, hash, at }: { kind: 'facture' | 'recu'; id: string; hash: string; at: string }) {
  const source = useFinancesSource();
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'ko' | 'error'>('idle');
  const verify = () => {
    setState('checking');
    source.verifySeal(kind, id).then(
      (valid) => { setState(valid ? 'ok' : 'ko'); },
      () => { setState('error'); },
    );
  };
  return (
    <SideCard
      title="Scellement"
      action={
        <Button variant="link" size="sm" loading={state === 'checking'} onClick={verify}>
          Vérifier
        </Button>
      }
    >
      <KeyValues items={[['Empreinte', <span key="h" className="font-mono text-caption">{shortHash(hash)}</span>], ['Horodatage', at]]} />
      {state === 'ok' ? <p role="status" className="text-caption text-success-fg">Empreinte conforme : le document n’a pas été modifié.</p> : null}
      {state === 'ko' ? <p role="alert" className="text-caption text-fg-danger">Empreinte non conforme : le document a été modifié.</p> : null}
      {state === 'error' ? <p role="alert" className="text-caption text-fg-danger">La vérification n’a pas pu être effectuée.</p> : null}
    </SideCard>
  );
}
