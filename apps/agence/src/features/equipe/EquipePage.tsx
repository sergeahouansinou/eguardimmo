"use client";

import { Alert, Button, Card, EmptyState, Pagination, Select, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { UsersRound } from "lucide-react";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { SearchField } from "@/components/ui/SearchField";
import { ActionDialog, LinkButton, PageFrame, useNotify, usePagination } from "@/features/kit";
import { matchesQuery } from "@/lib/text";
import { messageOf } from "@/features/shared/errors";
import { EditMemberDialog } from "./EditMemberDialog";
import { useCancelInvitation, useDeactivateMember, useEquipe, useResendInvitation } from "./hooks";
import { MembersTable } from "./MembersTable";
import { fullName } from "./memberLabels";
import { INVITABLE_ROLE_IDS, ROLE_LABELS } from "./rights";
import type { EquipeOverview, Member } from "./schemas";
import { seatMessage } from "./seats";

type TabId = "all" | "active" | "invited";
type Confirmation = { kind: "deactivate" | "cancel"; member: Member } | null;

const PAGE_SIZE = 10;

const ROLE_FILTER_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "titulaire", label: ROLE_LABELS.titulaire },
  ...INVITABLE_ROLE_IDS.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

function inTab(member: Member, tab: TabId): boolean {
  if (tab === "active") return member.status === "active";
  if (tab === "invited") return member.status === "invited";
  return true;
}

function EquipeContent({ overview }: { overview: EquipeOverview }) {
  const notify = useNotify();
  const resend = useResendInvitation();
  const deactivate = useDeactivateMember();
  const cancel = useCancelInvitation();
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const { members } = overview;
  const visible = members.filter(
    (member) => inTab(member, tab) && (role === "all" || member.role === role) && matchesQuery(query, fullName(member), member.email),
  );
  const pagination = usePagination(visible, PAGE_SIZE);
  const counts = {
    all: members.length,
    active: members.filter((member) => inTab(member, "active")).length,
    invited: members.filter((member) => inTab(member, "invited")).length,
  };

  const resendTo = async (member: Member) => {
    try {
      await resend.mutateAsync(member.id);
      notify.success("Invitation renvoyée", member.email);
    } catch (failure) {
      notify.error("Invitation non renvoyée", messageOf(failure));
    }
  };

  const confirm = async () => {
    if (!confirmation) return;
    setConfirmError(null);
    try {
      if (confirmation.kind === "deactivate") {
        await deactivate.mutateAsync(confirmation.member.id);
        notify.success("Collaborateur désactivé", fullName(confirmation.member));
      } else {
        await cancel.mutateAsync(confirmation.member.id);
        notify.success("Invitation annulée", confirmation.member.email);
      }
      setConfirmation(null);
    } catch (failure) {
      setConfirmError(messageOf(failure));
    }
  };

  return (
    <PageFrame
      crumbs={[{ label: "Compte" }, { label: "Équipe" }]}
      title="Équipe"
      description="Collaborateurs du cabinet. Le rôle limite ce que chacun voit et modifie."
      actions={
        <>
          <LinkButton href="/equipe/roles" variant="ghost">
            Rôles et droits
          </LinkButton>
          <LinkButton href="/equipe/invitation" variant="primary">
            Inviter un collaborateur
          </LinkButton>
        </>
      }
    >
      <Alert tone="info">{seatMessage(overview.seats)}</Alert>
      <Card role="region" aria-label="Liste des collaborateurs">
        <Tabs
          value={tab}
          defaultValue="all"
          onValueChange={(value) => {
            setTab(value === "active" || value === "invited" ? value : "all");
          }}
        >
          <TabList aria-label="Filtrer par état">
            <Tab value="all" count={counts.all}>
              Tous
            </Tab>
            <Tab value="active" count={counts.active}>
              Actifs
            </Tab>
            <Tab value="invited" count={counts.invited}>
              Invitations
            </Tab>
          </TabList>
          <TabPanel value={tab} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <SearchField
                label="Rechercher un collaborateur"
                placeholder="Nom, e-mail"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                className="w-full sm:w-64"
              />
              <Select label="Rôle" placeholder="Tous" options={ROLE_FILTER_OPTIONS} value={role} onValueChange={setRole} className="w-full sm:w-44" />
            </div>
            {visible.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="Aucun collaborateur"
                description="Aucun collaborateur ne correspond à ces filtres."
              >
                {query || role !== "all" ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setRole("all");
                    }}
                  >
                    Réinitialiser les filtres
                  </Button>
                ) : null}
              </EmptyState>
            ) : (
              <>
                <MembersTable
                  members={pagination.slice}
                  onEdit={setEditing}
                  onResend={(member) => void resendTo(member)}
                  resendingId={resend.isPending ? resend.variables : null}
                />
                <Pagination
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  total={pagination.total}
                  onPageChange={pagination.setPage}
                  label="Pagination des collaborateurs"
                />
              </>
            )}
          </TabPanel>
        </Tabs>
      </Card>
      {editing ? (
        <EditMemberDialog
          member={editing}
          onClose={() => {
            setEditing(null);
          }}
          onDeactivate={(member) => {
            setEditing(null);
            setConfirmation({ kind: "deactivate", member });
          }}
          onCancelInvitation={(member) => {
            setEditing(null);
            setConfirmation({ kind: "cancel", member });
          }}
        />
      ) : null}
      <ActionDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmation(null);
            setConfirmError(null);
          }
        }}
        tone="danger"
        title={confirmation?.kind === "cancel" ? "Annuler l'invitation ?" : "Désactiver ce collaborateur ?"}
        description={
          confirmation?.kind === "cancel"
            ? `Le lien envoyé à ${confirmation.member.email} ne fonctionnera plus. La place est libérée.`
            : confirmation
              ? `${fullName(confirmation.member)} perd l'accès à l'espace. Ses données restent conservées et la place est libérée.`
              : ""
        }
        confirmLabel={confirmation?.kind === "cancel" ? "Annuler l'invitation" : "Désactiver"}
        cancelLabel="Retour"
        loading={deactivate.isPending || cancel.isPending}
        error={confirmError}
        onConfirm={() => void confirm()}
      />
    </PageFrame>
  );
}

export function EquipePage() {
  const query = useEquipe();
  return (
    <QueryState query={query} label="L'équipe">
      {(overview) => <EquipeContent overview={overview} />}
    </QueryState>
  );
}
