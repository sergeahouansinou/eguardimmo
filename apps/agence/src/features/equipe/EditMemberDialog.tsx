import { Alert, Button, Dialog, DialogClose, DialogContent, Select } from "@eguardimmo/ui";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { DialogBody, DialogFooter, useNotify } from "@/features/kit";
import { messageOf } from "@/features/shared/errors";
import { useReactivateMember, useUpdateMember } from "./hooks";
import { MandantPicker } from "./MandantPicker";
import { fullName } from "./memberLabels";
import { INVITABLE_ROLE_IDS, ROLE_LABELS, ROLE_SUMMARIES } from "./rights";
import type { InvitableRoleId } from "./rights";
import type { Member, PortfolioMode } from "./schemas";

const ROLE_OPTIONS = INVITABLE_ROLE_IDS.map((role) => ({ value: role, label: ROLE_LABELS[role], description: ROLE_SUMMARIES[role] }));

function asInvitable(value: string): InvitableRoleId {
  return INVITABLE_ROLE_IDS.find((role) => role === value) ?? "gestionnaire";
}

export interface EditMemberDialogProps {
  member: Member;
  onClose: () => void;
  onDeactivate: (member: Member) => void;
  onCancelInvitation: (member: Member) => void;
}

export function EditMemberDialog({ member, onClose, onDeactivate, onCancelInvitation }: EditMemberDialogProps) {
  const notify = useNotify();
  const update = useUpdateMember();
  const reactivate = useReactivateMember();
  const [role, setRole] = useState<InvitableRoleId>(member.role === "titulaire" ? "gestionnaire" : member.role);
  const [mode, setMode] = useState<PortfolioMode>(member.portfolioMode);
  const [mandantIds, setMandantIds] = useState<readonly string[]>(member.mandantIds);
  const [error, setError] = useState<string | null>(null);
  const [mandantError, setMandantError] = useState<string | undefined>(undefined);
  const inactive = member.status === "inactive";

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMandantError(undefined);
    if (role === "gestionnaire" && mode === "chosen" && mandantIds.length === 0) {
      setMandantError("Choisissez au moins un mandant.");
      return;
    }
    try {
      await update.mutateAsync({ id: member.id, role, portfolioMode: mode, mandantIds: [...mandantIds] });
      notify.success("Modifications enregistrées", fullName(member));
      onClose();
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  const restore = async () => {
    setError(null);
    try {
      await reactivate.mutateAsync(member.id);
      notify.success("Collaborateur réactivé", fullName(member));
      onClose();
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title={`Modifier ${fullName(member)}`} description={member.email}>
        {inactive ? (
          <>
            <DialogBody>
              <p className="text-body text-fg-muted">Ce collaborateur est désactivé : il n'a plus accès à l'espace et ne compte plus dans les places de la formule.</p>
              {error ? <Alert tone="danger">{error}</Alert> : null}
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Fermer</Button>
              </DialogClose>
              <Button loading={reactivate.isPending} onClick={() => void restore()}>
                Réactiver le collaborateur
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)} noValidate>
            <DialogBody>
              <Select
                label="Rôle"
                placeholder="Choisir un rôle"
                options={ROLE_OPTIONS}
                value={role}
                onValueChange={(value) => {
                  setRole(asInvitable(value));
                }}
              />
              {role === "gestionnaire" ? (
                <MandantPicker
                  mode={mode}
                  mandantIds={mandantIds}
                  onModeChange={setMode}
                  onMandantIdsChange={setMandantIds}
                  error={mandantError}
                />
              ) : (
                <p className="text-caption text-fg-subtle">Ce rôle voit tout le portefeuille, dans la limite de ses droits.</p>
              )}
              {error ? <Alert tone="danger">{error}</Alert> : null}
            </DialogBody>
            <DialogFooter>
              {member.status === "invited" ? (
                <Button
                  variant="ghost"
                  className="mr-auto"
                  onClick={() => {
                    onCancelInvitation(member);
                  }}
                >
                  Annuler l'invitation
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="mr-auto"
                  onClick={() => {
                    onDeactivate(member);
                  }}
                >
                  Désactiver le collaborateur
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="secondary">Annuler</Button>
              </DialogClose>
              <Button type="submit" loading={update.isPending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
