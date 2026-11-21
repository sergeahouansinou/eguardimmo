'use client';

import { LifeBuoy, Mail, Siren } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardTitle, Icon, TextField } from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import { useHelpCenter } from '../data/queries';
import type { HelpContactRow } from '../data/schemas';
import { useOptionalSupportConfig } from '../support/context';
import { ContactSupportDialog } from './ContactSupportDialog';
import { FaqAccordion, filterHelp } from './FaqAccordion';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './parts';

function ContactRows({ rows }: { rows: HelpContactRow[] }) {
  return (
    <dl className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3 text-body">
          <dt className="shrink-0 text-fg-subtle">{row.label}</dt>
          <dd className="min-w-0 text-right text-fg">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ContactSupportAction() {
  const support = useOptionalSupportConfig();
  if (support === null) return <ContactSupportDialog />;
  return (
    <Button asChild>
      <support.Link href={support.routes.newRequest}>
        <Icon icon={LifeBuoy} />
        Écrire au support
      </support.Link>
    </Button>
  );
}

export function HelpCenter() {
  const { profile, routes, Link } = useMessagerieConfig();
  const help = useHelpCenter();
  const [search, setSearch] = useState('');

  if (help.data === undefined) {
    return help.isError ? (
      <ErrorBlock message="Impossible de charger l’aide." onRetry={help.refetch} />
    ) : (
      <LoadingBlock label="Chargement de l’aide" />
    );
  }

  const data = help.data;
  const categories = filterHelp(data.categories, search);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="max-w-md">
          <TextField
            label="Rechercher dans l’aide"
            type="search"
            placeholder={profile.help.searchPlaceholder}
            value={search}
            onChange={(event) => { setSearch(event.target.value); }}
          />
        </div>
        {categories.length === 0 ? (
          <EmptyBlock title="Aucune réponse ne correspond" hint="Essayez un autre mot-clé ou contactez-nous directement." />
        ) : (
          <FaqAccordion categories={categories} />
        )}
      </div>
      <aside aria-label="Nous contacter" className="flex min-w-0 flex-col gap-3">
        <Card>
          <CardTitle as="h2">{data.contactTitle}</CardTitle>
          <ContactRows rows={data.contact} />
          <div className="flex flex-wrap gap-2 pt-1">
            {profile.help.writeLabel ? (
              <Button asChild variant="secondary">
                <Link href={routes.newMessage}>
                  <Icon icon={Mail} />
                  {profile.help.writeLabel}
                </Link>
              </Button>
            ) : null}
            {profile.help.supportTicket ? <ContactSupportAction /> : null}
          </div>
        </Card>
        {data.emergencyTitle && data.emergency.length > 0 ? (
          <Card>
            <CardTitle as="h2" className="flex items-center gap-1.5">
              <Icon icon={Siren} />
              {data.emergencyTitle}
            </CardTitle>
            <ContactRows rows={data.emergency} />
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
