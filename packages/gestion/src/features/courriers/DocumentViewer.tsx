'use client';

import { Download, Maximize2, Minus, Plus, Printer } from 'lucide-react';
import { Button, Icon, IconButton } from '@eguardimmo/ui';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNotify } from '../locataires/kit';

const PAGE_WIDTH = 794;
const ZOOMS = [0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5];

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 0; }
  html, body, body * { overflow: visible !important; }
  body * { visibility: hidden !important; }
  [data-print-area], [data-print-area] * { visibility: visible !important; }
  [data-print-zoom] { zoom: 1 !important; }
  [data-print-area] {
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 210mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    color-scheme: light;
    background: Canvas !important;
    color: CanvasText !important;
  }
  [data-print-area] * { color: inherit !important; background-color: transparent !important; border-color: currentcolor !important; }
}
`;

export function DocumentViewer({ title, children }: { title: string; children: ReactNode }) {
  const notify = useNotify();
  const stage = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitted, setFitted] = useState(true);
  const [stageWidth, setStageWidth] = useState(PAGE_WIDTH);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => { setStageWidth(element.clientWidth); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, []);

  const fitZoom = Math.min(1, Math.max(0.3, (stageWidth - 32) / PAGE_WIDTH));
  const scale = fitted ? fitZoom : zoom;
  const percent = Math.round(scale * 100);

  const step = (direction: 1 | -1) => {
    const current = fitted ? fitZoom : zoom;
    const next = direction === 1 ? ZOOMS.find((value) => value > current + 0.001) : [...ZOOMS].reverse().find((value) => value < current - 0.001);
    if (next === undefined) return;
    setFitted(false);
    setZoom(next);
  };

  const print = () => { window.print(); };
  const download = () => {
    notify({ title: 'Enregistrer en PDF', description: 'Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ».' });
    window.print();
  };

  return (
    <section aria-label={`Aperçu, ${title}`} className="flex min-w-0 flex-col gap-2">
      <style>{PRINT_CSS}</style>
      <div role="toolbar" aria-label="Outils du document" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-body text-fg-muted" aria-live="polite">Page 1 sur 1</span>
          <span aria-hidden="true" className="text-fg-disabled">·</span>
          <IconButton label="Réduire le zoom" icon={Minus} onClick={() => { step(-1); }} />
          <span className="min-w-12 text-center text-body tabular-nums text-fg" aria-live="polite">{`${String(percent)} %`}</span>
          <IconButton label="Agrandir le zoom" icon={Plus} onClick={() => { step(1); }} />
          <IconButton label="Ajuster à la largeur" icon={Maximize2} onClick={() => { setFitted(true); }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={print}>
            <Icon icon={Printer} />
            Imprimer
          </Button>
          <Button onClick={download}>
            <Icon icon={Download} />
            Télécharger en PDF
          </Button>
        </div>
      </div>
      <div ref={stage} className="min-w-0 overflow-auto rounded-lg border border-line bg-muted p-4">
        <div data-print-zoom style={{ zoom: scale }} className="mx-auto" >
          {children}
        </div>
      </div>
    </section>
  );
}

export function Paper({ label, children }: { label: string; children: ReactNode }) {
  return (
    <article
      data-print-area
      data-paper=""
      aria-label={label}
      className="mx-auto flex min-h-[1123px] w-[794px] flex-col gap-6 border border-line p-14 text-body shadow-sm"
    >
      {children}
    </article>
  );
}

export const BAILLEUR = {
  name: 'SCI Les Tilleuls',
  address: '12 rue des Lilas',
  city: '75011 Paris',
  email: 'gestion@example.com',
} as const;

export function PaperHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="flex flex-col">
        <b className="text-block-title">{BAILLEUR.name}</b>
        <span className="text-body text-fg-muted">{BAILLEUR.address}</span>
        <span className="text-body text-fg-muted">{BAILLEUR.city}</span>
        <span className="text-body text-fg-muted">{BAILLEUR.email}</span>
      </div>
      {right ? <div className="flex flex-col items-end text-right">{right}</div> : null}
    </header>
  );
}
