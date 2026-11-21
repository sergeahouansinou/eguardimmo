import { Alert } from "@eguardimmo/ui";
import { agencyLabel, formatDay } from "../format";
import type { OwnerAccess } from "../model";

export function ReadOnlyBanner({ access }: { access: OwnerAccess }) {
  if (!access.readOnly && !access.inGrace) return null;
  if (access.inGrace) {
    const until = access.accessUntil === null ? "" : ` jusqu’au ${formatDay(access.accessUntil)}`;
    return (
      <Alert tone="warning" title={`Accès en lecture seule${until}`}>
        Votre mandat chez {agencyLabel(access.agencyName)} est terminé : vous pouvez consulter vos informations pendant cette période, sans pouvoir agir.
      </Alert>
    );
  }
  return (
    <Alert tone="info" title="Accès en lecture seule">
      Votre rôle sur ce mandat est en lecture seule : vous consultez les informations partagées par {agencyLabel(access.agencyName)}, sans pouvoir agir.
    </Alert>
  );
}
