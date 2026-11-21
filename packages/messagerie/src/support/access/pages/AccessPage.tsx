'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, ConfirmDialog, Icon, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../../components/parts';
import { accessErrorMessage } from '../api/errors';
import { AcceptDialog } from '../components/AcceptDialog';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { GrantCard } from '../components/GrantCard';
import { useSupportAccessConfig } from '../context';
import { ACCESS_PRIVACY_TEXT } from '../copy';
import type { AccessGrant, AccessStatus } from '../model';
import { useAccessList, useAccessSummary, useRefuseAccess, useRevokeAccess } from '../queries';

type AccessTab = 'requested' | 'active' | 'all';
const STATUS_OF: Record<AccessTab, AccessStatus | null> = { requested: 'requested', active: 'active', all: null };
const EMPTY: Record<AccessTab, { title: string; hint?: string }> = {
  requested: { title: 'Aucune demande d’accès à traiter', hint: 'Le support demande votre accord avant de consulter vos données.' },
  active: { title: 'Aucun accès en cours' },
  all: { title: 'Aucun accès du support pour le moment' },
};

function GrantList({ tab, onAccept, onRefuse, onRevoke, busy }: { tab: AccessTab; busy: boolean; onAccept: (g: AccessGrant) => void; onRefuse: (g: AccessGrant) => void; onRevoke: (g: AccessGrant) => void }) {
  const list = useAccessList(STATUS_OF[tab]);
  if (list.data === undefined) {
    return list.isError ? (
      <ErrorBlock message={accessErrorMessage(list.error)} onRetry={() => { void list.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement des accès du support" />
    );
  }
  const items = list.data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <EmptyBlock title={EMPTY[tab].title} {...(EMPTY[tab].hint ? { hint: EMPTY[tab].hint } : {})} />;
  return (
    <>
      <ul aria-label="Accès du support" className="flex min-w-0 flex-col gap-3">
        {items.map((grant) => (
          <GrantCard key={grant.id} grant={grant} busy={busy} onAccept={onAccept} onRefuse={onRefuse} onRevoke={onRevoke} />
        ))}
      </ul>
      {list.hasNextPage ? (
        <div>
          <Button variant="secondary" loading={list.isFetchingNextPage} onClick={() => { void list.fetchNextPage(); }}>
            Afficher plus d’accès
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function SupportAccessPage() {
  const { canManage, useProof } = useSupportAccessConfig();
  const proof = useProof();
  const summary = useAccessSummary();
  const refuse = useRefuseAccess();
  const revoke = useRevokeAccess();
  const [tab, setTab] = useState<AccessTab>('requested');
  const [toAccept, setToAccept] = useState<AccessGrant | null>(null);
  const [toRefuse, setToRefuse] = useState<AccessGrant | null>(null);
  const [toRevoke, setToRevoke] = useState<AccessGrant | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const header = <AccessHeader />;

  if (!canManage) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {header}
        <Alert tone="info" title="Réservé au propriétaire et aux administrateurs">
          Seuls le propriétaire et les administrateurs de l’organisation décident des accès du support à ses données.
        </Alert>
      </div>
    );
  }

  const confirm = (grant: AccessGrant | null, mutate: typeof refuse.mutate, close: () => void) => {
    if (grant === null) return;
    setFailure(null);
    mutate(grant.id, {
      onSuccess: close,
      onError: (error) => {
        close();
        setFailure(accessErrorMessage(error));
      },
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {header}
      <EmergencyBanner emergencies={summary?.emergencies ?? []} />
      {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
      <div className="flex max-w-3xl min-w-0 flex-col gap-3">
        <Tabs value={tab} defaultValue={tab} onValueChange={(value) => { setTab(value === 'active' || value === 'all' ? value : 'requested'); }}>
          <TabList aria-label="Filtrer les accès du support">
            <Tab value="requested" {...(summary === undefined ? {} : { count: summary.pending })}>À traiter</Tab>
            <Tab value="active">En cours</Tab>
            <Tab value="all">Historique</Tab>
          </TabList>
          <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
            <GrantList
              tab={tab}
              busy={refuse.isPending || revoke.isPending}
              onAccept={setToAccept}
              onRefuse={setToRefuse}
              onRevoke={setToRevoke}
            />
          </TabPanel>
        </Tabs>
        <p className="flex items-start gap-1.5 text-caption text-fg-muted">
          <Icon icon={Info} size={14} className="mt-0.5 shrink-0" />
          <span>{ACCESS_PRIVACY_TEXT}</span>
        </p>
      </div>
      <AcceptDialog grant={toAccept} proof={proof} onClose={() => { setToAccept(null); }} />
      <ConfirmDialog
        open={toRefuse !== null}
        onOpenChange={(open) => { if (!open) setToRefuse(null); }}
        title="Refuser l’accès du support ?"
        description="Le support ne pourra pas consulter vos données pour cette demande. Il pourra en faire une nouvelle demande."
        confirmLabel="Refuser l’accès"
        loading={refuse.isPending}
        onConfirm={() => { confirm(toRefuse, refuse.mutate, () => { setToRefuse(null); }); }}
      />
      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(open) => { if (!open) setToRevoke(null); }}
        title="Révoquer l’accès du support ?"
        description="Le support ne pourra plus consulter vos données, immédiatement."
        confirmLabel="Révoquer l’accès"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={() => { confirm(toRevoke, revoke.mutate, () => { setToRevoke(null); }); }}
      />
      {proof.dialog}
    </div>
  );
}

function AccessHeader() {
  return (
    <header className="flex min-w-0 flex-col gap-0.5">
      <h1 className="text-page-title text-fg [overflow-wrap:anywhere]">Accès du support à vos données</h1>
      <p className="text-body text-fg-muted">Le support demande votre accord avant de consulter les données de l’organisation.</p>
    </header>
  );
}
