'use client';

import { Badge, Button, EmptyState, RadioGroup, TextField } from '@eguardimmo/ui';
import { UserSearch } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import type { AccountLookup, AccountSummary } from '@/platform/accounts/accounts';
import { PageHeader } from '@/ui/PageHeader';
import { LoadingBlock, ProblemAlert } from '@/ui/PlatformState';
import { ListRow, Section } from '@/ui/Section';
import { useAccountSearch } from './hooks';
import { LOOKUP_MODES, PROFILE_LABELS } from './labels';
import type { LookupMode } from './labels';
import { buildLookup } from './lookup';

const isMode = (value: string): value is LookupMode => LOOKUP_MODES.some((mode) => mode.value === value);

export function ComptesScreen() {
  const [mode, setMode] = useState<LookupMode>('email');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [lookup, setLookup] = useState<AccountLookup | null>(null);
  const query = useAccountSearch(lookup);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const built = buildLookup(mode, value);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(undefined);
    if (lookup !== null && JSON.stringify(lookup) === JSON.stringify(built.lookup)) query.refetch();
    setLookup(built.lookup);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader Link={Link} title="Comptes et profils" subtitle="Recherche exacte par adresse e-mail ou identifiant : aucune liste de comptes n’est exposée." />
      <form noValidate onSubmit={submit} role="search" aria-label="Rechercher un compte" className="flex max-w-xl flex-col gap-3">
        <RadioGroup
          label="Rechercher par"
          options={LOOKUP_MODES.map((item) => ({ value: item.value, label: item.label }))}
          value={mode}
          onValueChange={(next) => {
            if (isMode(next)) {
              setMode(next);
              setError(undefined);
            }
          }}
        />
        <TextField
          label={mode === 'email' ? 'Adresse e-mail exacte' : 'Identifiant exact'}
          placeholder={mode === 'email' ? 'prenom.nom@exemple.fr' : 'Identifiant du compte'}
          type={mode === 'email' ? 'email' : 'text'}
          autoComplete="off"
          value={value}
          error={error}
          onChange={(event) => { setValue(event.target.value); }}
        />
        <div>
          <Button type="submit">
            Rechercher
          </Button>
        </div>
      </form>
      {lookup === null ? null : <Result query={query} />}
    </div>
  );
}

function Result({ query }: { query: ReturnType<typeof useAccountSearch> }) {
  if (query.isError) return <ProblemAlert error={query.error} label="La recherche" onRetry={query.refetch} />;
  if (query.data === undefined) return <LoadingBlock label="La recherche de compte" />;
  if (query.data.length === 0) return <EmptyState icon={UserSearch} title="Aucun compte ne correspond" description="Vérifiez l’adresse ou l’identifiant : la recherche est exacte." />;
  return (
    <Section id="resultat" title="Résultat">
      <ul>
        {query.data.map((account) => (
          <ListRow key={account.id} title={<Link href={`/comptes/${account.id}`} className="inline-flex min-h-6 items-center underline underline-offset-3">{account.name}</Link>} detail={account.email ?? 'Adresse non communiquée'} trailing={<Badges account={account} />} />
        ))}
      </ul>
    </Section>
  );
}

export function Badges({ account }: { account: AccountSummary }) {
  return (
    <span className="flex flex-wrap gap-1">
      {account.deleted ? <Badge tone="neutral">Supprimé</Badge> : null}
      {account.suspended ? <Badge tone="danger">Suspendu</Badge> : null}
      {account.isOperator ? <Badge tone="info">{PROFILE_LABELS.operator}</Badge> : null}
    </span>
  );
}
