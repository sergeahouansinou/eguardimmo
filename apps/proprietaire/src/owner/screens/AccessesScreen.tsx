"use client";

import { Alert, Button, EmptyState } from "@eguardimmo/ui";
import { Link2Off, Unlink, UserRound } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/features/confie/ui/ConfirmDialog";
import { ListRow, RowList } from "@/features/confie/ui/ListRow";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { describeFailure } from "../errors";
import { ROLE_LABELS, agencyLabel, formatDay } from "../format";
import type { OwnerLink } from "../model";
import { useDetach, useLinks } from "../queries";
import { FailureNotice, Loading } from "./FailureNotice";

function linkTitle(link: OwnerLink): string {
  return `${link.mandantName} · ${agencyLabel(link.agencyName)}`;
}

export function AccessesScreen() {
  const links = useLinks();
  const detach = useDetach();
  const [target, setTarget] = useState<OwnerLink | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const close = (open: boolean) => {
    if (open) return;
    setTarget(null);
    detach.reset();
  };

  const confirm = () => {
    if (target === null) return;
    const label = linkTitle(target);
    detach.mutate(target.id, {
      onSuccess: () => {
        setDone(label);
        setTarget(null);
      },
    });
  };

  const failure = detach.isError ? describeFailure(detach.error) : null;

  return (
    <>
      <PageHeader title="Mes accès" subtitle="Les mandats auxquels votre compte est relié" />
      {done ? (
        <Alert tone="success" title="Accès retiré">
          Votre compte n’est plus relié à {done}. L’agence ne partage plus ces informations avec vous.
        </Alert>
      ) : null}
      {links.data === undefined ? (
        links.isError ? (
          <FailureNotice title="Vos accès n’ont pas pu être chargés" error={links.error} onRetry={() => void links.refetch()} />
        ) : (
          <Loading label="Chargement de vos accès" />
        )
      ) : links.data.length === 0 ? (
        <EmptyState
          icon={Link2Off}
          title="Aucun accès"
          description="Votre compte n’est relié à aucun mandat. Pour en ouvrir un, utilisez le lien d’invitation envoyé par votre agence."
        />
      ) : (
        <Section title="Accès ouverts">
          <RowList label="Accès ouverts">
            {links.data.map((link) => (
              <ListRow
                key={link.id}
                icon={UserRound}
                title={linkTitle(link)}
                detail={
                  <span className="mt-1 flex flex-col items-start gap-2">
                    <span>{`${ROLE_LABELS[link.role]} · relié le ${formatDay(link.linkedAt)}`}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Me détacher de ${linkTitle(link)}`}
                      onClick={() => {
                        setTarget(link);
                      }}
                    >
                      <Unlink aria-hidden className="size-3.5" />
                      Me détacher
                    </Button>
                  </span>
                }
              />
            ))}
          </RowList>
        </Section>
      )}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={close}
        title="Me détacher de ce mandat ?"
        description={
          target
            ? `Vous perdrez l’accès aux informations de ${linkTitle(target)}. Une nouvelle invitation de l’agence sera nécessaire pour le retrouver.`
            : ""
        }
        confirmLabel="Me détacher"
        tone="danger"
        pending={detach.isPending}
        error={failure?.message ?? null}
        onConfirm={confirm}
      />
    </>
  );
}
