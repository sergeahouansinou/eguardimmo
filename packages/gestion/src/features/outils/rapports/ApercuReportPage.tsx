'use client';

import { useMemo, useState } from 'react';
import { Download, Mail, Printer } from 'lucide-react';
import { Button, Icon } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, PageHeader, QueryState, Switch } from '../kit';
import type { ScreenProps } from '../kit';
import { downloadCsv } from '../analytique/csv';
import { formatStamp } from '../analytique/format';
import { findReport, reportHref } from './catalog';
import { findDefinition } from './definitions';
import { buildReport, decodeReportFilters, encodeReportFilters, hasSummedColumns, reportDataset, scopeOf, withoutZeroRows } from './engine/engine';
import { GenericPaper, pageCountOf } from './GenericPaper';
import type { GenericPaperOptions } from './GenericPaper';
import { PaperViewer, printDocument } from './PaperViewer';
import { EmailDialog } from './SendDialogs';
import { useReportsData } from './source';

export interface ApercuReportPageProps extends ScreenProps {
  slug: string;
  search?: string;
}

export function ApercuReportPage({ Link, navigate, slug, search = '' }: ApercuReportPageProps) {
  const definition = findDefinition(slug);
  const report = findReport(slug);
  const query = useReportsData();
  const filters = useMemo(() => (definition ? decodeReportFilters(definition, new URLSearchParams(search)) : null), [definition, search]);
  const [options, setOptions] = useState<GenericPaperOptions>({ letterhead: true, hideZero: false });
  const [page, setPage] = useState(1);
  const [emailing, setEmailing] = useState(false);

  const view = useMemo(() => {
    if (!definition || !filters || !query.data) return null;
    const built = buildReport(definition, query.data, filters);
    return options.hideZero ? withoutZeroRows(built) : built;
  }, [definition, filters, query.data, options.hideZero]);

  if (!definition || !report || !filters) {
    return (
      <>
        <PageHeader Link={Link} crumbs={[{ label: 'Outils' }, { label: 'Rapports', href: '/rapports' }, { label: 'Rapport introuvable' }]} title="Rapport introuvable" />
        <ErrorBlock title="Ce rapport n’existe pas ou n’est plus disponible." />
      </>
    );
  }

  const title = view ? `${report.label} ${view.period.title}`.trim() : report.label;
  const backHref = `${reportHref(slug)}?${encodeReportFilters(filters)}`;
  const pages = view?.hasData ? pageCountOf(view) : 1;
  const current = Math.min(page, pages);
  const ready = view?.hasData === true;

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Rapports', href: '/rapports' }, { label: report.label, href: backHref }, { label: 'Aperçu PDF' }]}
        title={definition.periods ? title : report.label}
        description="Aperçu du rapport avant téléchargement ou envoi."
        actions={
          <>
            <Button variant="ghost" onClick={() => { setEmailing(true); }}>
              <Icon icon={Mail} />
              Envoyer par e-mail
            </Button>
            <Button variant="secondary" disabled={!ready} onClick={() => { if (view) downloadCsv(slug, reportDataset(view)); }}>
              <Icon icon={Download} />
              Exporter en Excel
            </Button>
            <Button disabled={!ready} onClick={printDocument}>
              <Icon icon={Printer} />
              Télécharger le PDF
            </Button>
          </>
        }
      />
      <QueryState query={query} errorTitle="L’aperçu n’a pas pu être chargé" loadingLabel="Chargement de l’aperçu">
        {(data) =>
          view && ready ? (
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <PaperViewer pages={pages} current={current} onPageChange={setPage}>
                <GenericPaper view={view} scope={scopeOf(definition, data, filters)} generated={formatStamp(data.generatedAt).replace(', ', ' à ')} options={options} current={current} />
              </PaperViewer>
              <aside className="flex min-w-0 flex-col gap-3">
                <section aria-labelledby="apercu-parametres" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 id="apercu-parametres" className="text-block-title">Paramètres</h2>
                    <Button variant="ghost" size="sm" onClick={() => { navigate(backHref); }}>Modifier</Button>
                  </div>
                  <dl className="grid grid-cols-[104px_1fr] gap-x-2 gap-y-1 text-body">
                    <dt className="text-fg-subtle">Période</dt>
                    <dd>{definition.periods ? view.period.title : 'Situation à date'}</dd>
                    <dt className="text-fg-subtle">Périmètre</dt>
                    <dd>{scopeOf(definition, data, filters)}</dd>
                    <dt className="text-fg-subtle">Regroupement</dt>
                    <dd>{view.groups.some((group) => group.label !== null) ? (definition.groups.find((group) => group.value === filters.group)?.label.replace('Regrouper par : ', '') ?? 'Aucun') : 'Aucun'}</dd>
                  </dl>
                </section>
                <section aria-labelledby="apercu-options" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
                  <h2 id="apercu-options" className="text-block-title">Options du PDF</h2>
                  <Switch label="Papier à en-tête" checked={options.letterhead} onCheckedChange={(letterhead) => { setOptions({ ...options, letterhead }); }} />
                  {hasSummedColumns(definition) ? (
                    <Switch label="Masquer les lignes à zéro" checked={options.hideZero} onCheckedChange={(hideZero) => { setOptions({ ...options, hideZero }); }} />
                  ) : null}
                </section>
                <section aria-labelledby="apercu-contenu" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
                  <h2 id="apercu-contenu" className="text-block-title">Contenu</h2>
                  <dl className="flex flex-col text-body">
                    {[
                      ['Pages', pages],
                      ['Lignes', view.rows.length],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
                        <dt className="text-fg-muted">{label}</dt>
                        <dd className="font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </aside>
            </div>
          ) : (
            <EmptyBlock
              title="Aucune donnée à afficher"
              action={
                <Button variant="secondary" size="sm" onClick={() => { navigate(reportHref(slug)); }}>
                  Modifier les paramètres
                </Button>
              }
            >
              {definition.emptyHint}
            </EmptyBlock>
          )
        }
      </QueryState>
      <EmailDialog open={emailing} onOpenChange={setEmailing} subject={title} />
    </>
  );
}
