'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Mail, Minus, Plus, Printer } from 'lucide-react';
import { Button, Icon, IconButton } from '@eguardimmo/ui';
import { EmptyBlock, PageHeader, QueryState, Switch } from '../kit';
import type { ScreenProps } from '../kit';
import { downloadCsv } from '../analytique/csv';
import { formatStamp } from '../analytique/format';
import { MODELED_SLUG, reportHref } from './catalog';
import { buildLoyers, decodeFilters, encodeFilters, loyersDataset, scopeLabel } from './loyers';
import type { LoyersView } from './loyers';
import { PAPER_HEIGHT, PAPER_WIDTH, ReportPaper } from './ReportPaper';
import type { PaperOptions } from './ReportPaper';
import { EmailDialog } from './SendDialogs';
import { useLoyersData } from './source';

const PRINT_CSS =
  '@page{size:A4;margin:0}@media print{html,body{height:auto!important;overflow:visible!important}body *{visibility:hidden;overflow:visible!important}[data-print-root],[data-print-root] *{visibility:visible}[data-print-root]{position:absolute;left:0;top:0;display:block!important;transform:none!important}[data-print-page]{display:flex!important;break-after:page;border:0!important}}';

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

const print = () => { window.print(); };

export interface ApercuRapportPageProps extends ScreenProps {
  search?: string;
}

export function ApercuRapportPage({ Link, navigate, search = '' }: ApercuRapportPageProps) {
  const query = useLoyersData();
  const filters = useMemo(() => decodeFilters(new URLSearchParams(search)), [search]);
  const view = useMemo(() => (query.data ? buildLoyers(query.data, filters) : null), [query.data, filters]);
  const [options, setOptions] = useState<PaperOptions>({ annex: true, letterhead: true, hideZero: false });
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [emailing, setEmailing] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const title = view ? `Loyers encaissés ${view.period.title}` : 'Loyers encaissés';
  const pages = options.annex ? 2 : 1;
  const current = Math.min(page, pages);
  const backHref = `${reportHref(MODELED_SLUG)}?${encodeFilters(filters)}`;

  const fit = () => {
    const width = stage.current?.clientWidth ?? 0;
    setZoom(width > 0 ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(((width - 32) / PAPER_WIDTH) * 100))) : 100);
  };

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Rapports', href: '/rapports' }, { label: 'Loyers encaissés', href: backHref }, { label: 'Aperçu PDF' }]}
        title={title}
        description="Aperçu du rapport avant téléchargement ou envoi."
        actions={
          <>
            <Button variant="ghost" onClick={() => { setEmailing(true); }}>
              <Icon icon={Mail} />
              Envoyer par e-mail
            </Button>
            <Button
              variant="secondary"
              disabled={!view?.hasData}
              onClick={() => { if (view) downloadCsv('loyers-encaisses', loyersDataset(view)); }}
            >
              <Icon icon={Download} />
              Exporter en Excel
            </Button>
            <Button disabled={!view?.hasData} onClick={print}>
              <Icon icon={Printer} />
              Télécharger le PDF
            </Button>
          </>
        }
      />
      <QueryState query={query} errorTitle="L’aperçu n’a pas pu être chargé">
        {(data) =>
          view?.hasData ? (
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section aria-label="Aperçu du PDF" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
                <div role="toolbar" aria-label="Outils de l’aperçu" className="flex h-11 items-center gap-1 overflow-x-auto border-b border-line px-2 text-caption font-medium whitespace-nowrap text-fg-muted">
                  <IconButton label="Page précédente" icon={ChevronLeft} disabled={current <= 1} onClick={() => { setPage(current - 1); }} />
                  <span aria-live="polite">{`Page ${String(current)} / ${String(pages)}`}</span>
                  <IconButton label="Page suivante" icon={ChevronRight} disabled={current >= pages} onClick={() => { setPage(current + 1); }} />
                  <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
                  <IconButton label="Réduire" icon={Minus} disabled={zoom <= ZOOM_MIN} onClick={() => { setZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP)); }} />
                  <span className="min-w-11 text-center tabular-nums">{`${String(zoom)} %`}</span>
                  <IconButton label="Agrandir" icon={Plus} disabled={zoom >= ZOOM_MAX} onClick={() => { setZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP)); }} />
                  <Button variant="ghost" size="sm" onClick={fit}>Ajuster</Button>
                  <span className="flex-1" />
                  <IconButton label="Imprimer" icon={Printer} onClick={print} />
                  <IconButton label="Télécharger le PDF" icon={Download} onClick={print} />
                </div>
                <div ref={stage} className="flex justify-start overflow-auto bg-muted p-4 sm:justify-center">
                  <div style={{ width: PAPER_WIDTH * (zoom / 100), height: PAPER_HEIGHT * (zoom / 100) }} className="shrink-0">
                    <div data-print-root="" style={{ transform: `scale(${String(zoom / 100)})`, transformOrigin: 'top left', width: PAPER_WIDTH }}>
                      <ReportPaper
                        view={view}
                        scope={scopeLabel(data, filters)}
                        generated={formatStamp(data.generatedAt).replace(', ', ' à ')}
                        options={options}
                        pages={pages}
                        current={current}
                      />
                    </div>
                  </div>
                </div>
              </section>
              <Side view={view} options={options} onOptions={setOptions} pages={pages} onEdit={() => { navigate(backHref); }} scope={scopeLabel(data, filters)} />
            </div>
          ) : (
            <EmptyBlock
              title="Aucune donnée à afficher"
              action={
                <Button variant="secondary" size="sm" onClick={() => { navigate(reportHref(MODELED_SLUG)); }}>
                  Modifier les paramètres
                </Button>
              }
            >
              Aucun avis d’échéance ne correspond aux paramètres de ce rapport.
            </EmptyBlock>
          )
        }
      </QueryState>
      <EmailDialog open={emailing} onOpenChange={setEmailing} subject={title} />
    </>
  );
}

function Side({
  view,
  options,
  onOptions,
  pages,
  onEdit,
  scope,
}: {
  view: LoyersView;
  options: PaperOptions;
  onOptions: (next: PaperOptions) => void;
  pages: number;
  onEdit: () => void;
  scope: string;
}) {
  const card = 'flex flex-col gap-2 rounded-lg border border-line bg-surface p-4';
  return (
    <aside className="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="apercu-parametres" className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 id="apercu-parametres" className="text-block-title">Paramètres</h2>
          <Button variant="ghost" size="sm" onClick={onEdit}>Modifier</Button>
        </div>
        <dl className="grid grid-cols-[104px_1fr] gap-x-2 gap-y-1 text-body">
          <dt className="text-fg-subtle">Période</dt>
          <dd>{view.period.title}</dd>
          <dt className="text-fg-subtle">Biens</dt>
          <dd>{scope}</dd>
          <dt className="text-fg-subtle">Regroupement</dt>
          <dd>{view.groups.some((group) => group.label !== null) ? 'Par immeuble' : 'Aucun'}</dd>
        </dl>
      </section>
      <section aria-labelledby="apercu-options" className={card}>
        <h2 id="apercu-options" className="text-block-title">Options du PDF</h2>
        <Switch label="Détail mensuel en annexe" checked={options.annex} onCheckedChange={(annex) => { onOptions({ ...options, annex }); }} />
        <Switch label="Papier à en-tête" checked={options.letterhead} onCheckedChange={(letterhead) => { onOptions({ ...options, letterhead }); }} />
        <Switch label="Masquer les lignes à zéro" checked={options.hideZero} onCheckedChange={(hideZero) => { onOptions({ ...options, hideZero }); }} />
      </section>
      <section aria-labelledby="apercu-contenu" className={card}>
        <h2 id="apercu-contenu" className="text-block-title">Contenu</h2>
        <dl className="flex flex-col text-body">
          {[
            ['Pages', pages],
            ['Lots', view.totals.lots],
            ['Paiements', view.totals.payments],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
