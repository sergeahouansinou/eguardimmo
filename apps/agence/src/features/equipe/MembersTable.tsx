import { Avatar, Badge, Button } from "@eguardimmo/ui";
import { DataTable } from "@/features/kit";
import type { Column } from "@/features/kit";
import { STATUS_BADGES, fullName, initialsOfMember, lastLoginLabel, twoFactorLabel } from "./memberLabels";
import { ROLE_LABELS } from "./rights";
import type { Member } from "./schemas";

export interface MembersTableProps {
  members: readonly Member[];
  onEdit: (member: Member) => void;
  onResend: (member: Member) => void;
  resendingId: string | null;
}

export function MembersTable({ members, onEdit, onResend, resendingId }: MembersTableProps) {
  const columns: readonly Column<Member>[] = [
    {
      id: "member",
      header: "Collaborateur",
      role: "title",
      cell: (member) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar initials={initialsOfMember(member)} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">
              {fullName(member)}
              {member.isCurrentUser ? <span className="text-caption font-normal text-fg-subtle"> (vous)</span> : null}
            </span>
            <span className="truncate text-caption font-normal text-fg-subtle">{member.email}</span>
          </span>
        </span>
      ),
    },
    {
      id: "role",
      header: "Rôle",
      cell: (member) => <Badge tone={member.role === "titulaire" ? "info" : "neutral"}>{ROLE_LABELS[member.role]}</Badge>,
    },
    { id: "portfolio", header: "Portefeuille", cell: (member) => member.portfolioLabel },
    { id: "twoFactor", header: "Double auth.", cell: twoFactorLabel },
    { id: "lastLogin", header: "Dernière connexion", cell: lastLoginLabel },
    {
      id: "status",
      header: "État",
      role: "status",
      cell: (member) => {
        const badge = STATUS_BADGES[member.status];
        return <Badge tone={badge.tone}>{badge.label}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Action",
      role: "action",
      hideHeader: true,
      cell: (member) =>
        member.isCurrentUser ? null : (
          <span className="flex flex-wrap gap-1.5">
            {member.status === "invited" ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Renvoyer l'invitation à ${fullName(member)}`}
                loading={resendingId === member.id}
                onClick={() => {
                  onResend(member);
                }}
              >
                Renvoyer
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Modifier ${fullName(member)}`}
              onClick={() => {
                onEdit(member);
              }}
            >
              Modifier
            </Button>
          </span>
        ),
    },
  ];

  return <DataTable caption="Liste des collaborateurs" columns={columns} rows={members} getRowId={(member) => member.id} />;
}
