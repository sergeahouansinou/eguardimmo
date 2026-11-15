import { Badge, Button, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import { DataTable, DialogBody, DialogFooter } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatDateTime } from "@/features/shared/dates";
import type { LoginEvent } from "./securitySchemas";

const COLUMNS: readonly Column<LoginEvent>[] = [
  { id: "at", header: "Date", role: "title", cell: (event) => formatDateTime(event.at) },
  { id: "device", header: "Appareil", cell: (event) => event.device },
  {
    id: "outcome",
    header: "Résultat",
    role: "status",
    cell: (event) =>
      event.outcome === "success" ? (
        <Badge tone={event.newDevice ? "info" : "success"}>{event.newDevice ? "Nouvel appareil" : "Réussie"}</Badge>
      ) : (
        <Badge tone="danger">Échec</Badge>
      ),
  },
];

export function LoginLogDialog({ log, onClose }: { log: readonly LoginEvent[]; onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title="Journal de connexion" description="Vos connexions et tentatives de connexion récentes.">
        <DialogBody>
          <div className="max-h-[50vh] overflow-y-auto">
            <DataTable caption="Journal de connexion" columns={COLUMNS} rows={log} getRowId={(event) => event.id} />
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Fermer</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
