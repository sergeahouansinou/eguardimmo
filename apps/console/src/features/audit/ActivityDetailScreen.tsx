'use client';

import { Alert, Badge } from '@eguardimmo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useActivityEntry } from '@/console/hooks/activity';
import type { ActivityEntry } from '@/console/schemas';
import { formatDateTimeSeconds } from '@/lib/format';
import { PageHeader } from '@/ui/PageHeader';
import { KeyValueList, Section } from '@/ui/Section';
import { ActivityState } from './ActivityState';
import { REDACTED_TEXT, actorText } from './activityLabels';

const journal = (params: Record<string, string>): string => `/audit?${new URLSearchParams(params).toString()}`;

function Code({ children }: { children: ReactNode }) {
  return <code className="text-caption break-all">{children}</code>;
}

function optional(label: string, value: ReactNode | null): { label: string; value: ReactNode }[] {
  return value === null ? [] : [{ label, value }];
}

export function ActivityDetailScreen({ id }: { id: string }) {
  const query = useActivityEntry(id);
  return (
    <ActivityState
      query={query}
      label="L’entrée"
      notFound={{
        title: 'Entrée introuvable',
        description: 'Cette entrée n’existe pas dans le journal d’audit.',
        backHref: '/audit',
        backLabel: 'Retour au journal d’audit',
      }}
    >
      {(entry) => <Content entry={entry} />}
    </ActivityState>
  );
}

function Content({ entry }: { entry: ActivityEntry }) {
  const { actor, subject } = entry;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Journal d’audit', href: '/audit' }, { label: entry.action }]}
        title={entry.action}
        badges={<Badge tone="success">Consignée</Badge>}
        subtitle={`${formatDateTimeSeconds(entry.occurredAt)} (heure de Paris)`}
      />
      <Alert tone="info">Cette entrée est en ajout seul : elle ne peut être ni modifiée ni supprimée.</Alert>
      {entry.redacted ? (
        <Alert tone="warning" title={REDACTED_TEXT}>
          Le détail de cette entrée appartient à une organisation : il n’est visible qu’avec un accès de support accordé par elle, ou un accès d’urgence.
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section id="entree" title="Entrée">
          <KeyValueList
            items={[
              { label: 'Identifiant', value: <Code>{entry.id}</Code> },
              { label: 'Horodatage', value: formatDateTimeSeconds(entry.occurredAt) },
              { label: 'Action', value: <Code>{entry.action}</Code> },
              ...optional(
                'Entité',
                subject === null ? null : (
                  <span className="flex flex-col gap-0.5">
                    <Code>{subject.type}</Code>
                    {subject.id ? (
                      <Link href={journal({ subject_type: subject.type, subject_id: subject.id })} className="underline underline-offset-3">
                        <Code>{subject.id}</Code>
                        {' '}
                        <span className="text-caption">Historique de l’entité</span>
                      </Link>
                    ) : null}
                  </span>
                ),
              ),
              ...optional(
                'Organisation',
                entry.organizationId === null ? null : (
                  <Link href={journal({ organization: entry.organizationId })} className="underline underline-offset-3">
                    <Code>{entry.organizationId}</Code>
                  </Link>
                ),
              ),
              ...optional(
                'Requête',
                entry.requestId === null ? null : (
                  <Link href={journal({ request_id: entry.requestId })} className="underline underline-offset-3">
                    <Code>{entry.requestId}</Code>
                  </Link>
                ),
              ),
              ...optional('Route', entry.route === null ? null : <Code>{entry.route}</Code>),
            ]}
          />
        </Section>
        <Section id="auteur" title="Auteur">
          <KeyValueList
            items={[
              { label: 'Personne', value: actorText(entry) },
              ...optional('Adresse e-mail', actor?.email ?? null),
              ...optional(
                'Identifiant',
                actor === null ? null : (
                  <Link href={journal({ actor: actor.id })} className="underline underline-offset-3">
                    <Code>{actor.id}</Code>
                  </Link>
                ),
              ),
              { label: 'Adresse IP', value: entry.redacted ? 'Masqué' : (entry.ip ?? '—') },
              { label: 'Navigateur', value: entry.redacted ? 'Masqué' : (entry.userAgent ?? '—') },
            ]}
          />
        </Section>
        <Section id="avant-apres" title="Avant et après" className="xl:col-span-2">
          {entry.redacted ? (
            <p className="text-body text-fg-subtle">{REDACTED_TEXT}</p>
          ) : entry.changes.length === 0 ? (
            <p className="text-body text-fg-subtle">Aucune modification de valeur pour cette entrée.</p>
          ) : (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            <div role="region" aria-label="Valeurs modifiées, défilement horizontal" tabIndex={0} className="relative overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              <table aria-label="Valeurs modifiées" className="w-full border-collapse text-left text-body">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="h-8 px-2 text-caption font-medium text-fg-subtle">Champ</th>
                    <th scope="col" className="h-8 px-2 text-caption font-medium text-fg-subtle">Avant</th>
                    <th scope="col" className="h-8 px-2 text-caption font-medium text-fg-subtle">Après</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.changes.map((change) => (
                    <tr key={change.field} className="border-b border-line last:border-b-0">
                      <th scope="row" className="px-2 py-1.5 font-medium">{change.field}</th>
                      <td className="px-2 py-1.5 break-all">{change.before}</td>
                      <td className="px-2 py-1.5 break-all">{change.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        {!entry.redacted && entry.metadata.length > 0 ? (
          <Section id="contexte" title="Contexte" className="xl:col-span-2">
            <KeyValueList items={entry.metadata.map((item) => ({ label: item.key, value: <span className="break-all">{item.value}</span> }))} />
          </Section>
        ) : null}
      </div>
    </div>
  );
}
