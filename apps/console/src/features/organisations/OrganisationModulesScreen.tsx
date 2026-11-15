'use client';

import { Alert, Badge, Button, Icon, Switch } from '@eguardimmo/ui';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { errorMessage } from '@/console/hooks/core';
import { useSetOrganisationModules } from '@/console/hooks/mutations';
import { useOrganisationModules } from '@/console/hooks/queries';
import type { OrganisationModules } from '@/console/schemas';
import { formatInteger } from '@/lib/format';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';

type ModuleEntry = OrganisationModules['groups'][number]['modules'][number];

export function OrganisationModulesScreen({ id }: { id: string }) {
  const query = useOrganisationModules(id);
  return (
    <QueryState
      query={query}
      label="Les modules de l’organisation"
      notFound={{
        title: 'Organisation introuvable',
        description: 'Cette organisation n’existe pas ou n’est plus visible depuis la console.',
        backHref: '/organisations',
        backLabel: 'Retour aux organisations',
      }}
    >
      {(data) => <ModulesForm id={id} data={data} />}
    </QueryState>
  );
}

function dependentsOf(target: string, all: readonly ModuleEntry[]): string[] {
  const result = new Set<string>();
  const queue = [target];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const entry of all) {
      if (entry.requires.includes(current ?? '') && !result.has(entry.id)) {
        result.add(entry.id);
        queue.push(entry.id);
      }
    }
  }
  return [...result];
}

function requirementsOf(target: string, all: readonly ModuleEntry[]): string[] {
  const byId = new Map(all.map((entry) => [entry.id, entry]));
  const result = new Set<string>();
  const queue = [target];
  while (queue.length > 0) {
    const entry = byId.get(queue.shift() ?? '');
    for (const required of entry?.requires ?? []) {
      if (!result.has(required)) {
        result.add(required);
        queue.push(required);
      }
    }
  }
  return [...result];
}

function ModulesForm({ id, data }: { id: string; data: OrganisationModules }) {
  const router = useRouter();
  const notify = useNotify();
  const save = useSetOrganisationModules(id);
  const all = useMemo(() => data.groups.flatMap((group) => group.modules), [data]);
  const names = useMemo(() => new Map(all.map((module) => [module.id, module.name])), [all]);
  const [enabled, setEnabled] = useState(() => new Set(all.filter((module) => module.enabled).map((module) => module.id)));
  const columns = useMemo(() => {
    const half = Math.ceil(data.groups.length / 2);
    return [data.groups.slice(0, half), data.groups.slice(half)];
  }, [data.groups]);
  const [cascade, setCascade] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const toggle = (module: ModuleEntry, next: boolean) => {
    const updated = new Set(enabled);
    if (next) {
      const added = requirementsOf(module.id, all).filter((required) => !updated.has(required));
      updated.add(module.id);
      added.forEach((required) => updated.add(required));
      setCascade(added.length > 0 ? `${module.name} nécessite ${added.map((item) => names.get(item) ?? item).join(' et ')} : réactivés aussi.` : null);
    } else {
      const removed = dependentsOf(module.id, all).filter((dependent) => updated.has(dependent));
      updated.delete(module.id);
      removed.forEach((dependent) => updated.delete(dependent));
      setCascade(removed.length > 0 ? `${module.name} est désactivé : ${removed.map((item) => names.get(item) ?? item).join(' et ')} le sont aussi.` : null);
    }
    setEnabled(updated);
  };

  const submit = () => {
    setFailure(null);
    save.mutate([...enabled], {
      onSuccess: () => {
        notify.success('Modules enregistrés', 'Le changement est consigné au journal d’audit.');
        router.push(`/organisations/${id}`);
      },
      onError: (error) => { setFailure(errorMessage(error)); },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[
          { label: 'Organisations', href: '/organisations' },
          { label: data.organisation.name, href: `/organisations/${id}` },
          { label: 'Modules' },
        ]}
        title="Modules activés"
        badges={<Badge tone="info">{`${formatInteger(enabled.size)} sur ${formatInteger(data.total)}`}</Badge>}
        subtitle={`${data.organisation.name} · un module désactivé disparaît du menu de l’organisation, ses données sont conservées.`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={`/organisations/${id}`}>Annuler</Link>
            </Button>
            <Button loading={save.isPending} onClick={submit}>
              <Icon icon={Check} />
              Enregistrer
            </Button>
          </>
        }
      />
      <Alert tone="info">
        Les dépendances sont appliquées : désactiver Baux masque aussi Quittances et Impayés. Chaque changement est consigné dans le journal d’audit.
      </Alert>
      <div aria-live="polite">{cascade ? <Alert tone="warning">{cascade}</Alert> : null}</div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {columns.map((groups, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-4">
            {groups.map((group) => (
              <Section
                key={group.group}
                id={`groupe-${group.group}`}
                title={group.label}
                aside={<span className="text-caption text-fg-subtle">{`${String(group.modules.length)} modules`}</span>}
              >
                <ul>
                  {group.modules.map((module) => (
                    <li key={module.id} className="flex min-h-12 items-center gap-3 border-t border-line py-2 first:border-t-0">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body-strong text-fg">{module.name}</span>
                        <span className="text-caption text-fg-subtle">{module.description}</span>
                      </span>
                      {module.degraded ? <Badge tone="warning">Dégradé</Badge> : null}
                      {module.mandatory ? <Badge tone="neutral">Obligatoire</Badge> : null}
                      <Switch
                        label={`Module ${module.name}`}
                        hideLabel
                        disabled={module.mandatory}
                        checked={enabled.has(module.id)}
                        onCheckedChange={(next) => { toggle(module, next); }}
                      />
                    </li>
                  ))}
                </ul>
              </Section>
            ))}
          </div>
        ))}
      </div>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
    </div>
  );
}
