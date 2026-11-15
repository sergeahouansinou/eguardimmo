import { Badge, Button, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import { DataTable, DialogBody, DialogFooter } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatDateTime } from "@/features/shared/dates";
import type { Device } from "./securitySchemas";

export interface DevicesDialogProps {
  devices: readonly Device[];
  onClose: () => void;
  onSignOut: (device: Device) => void;
}

export function DevicesDialog({ devices, onClose, onSignOut }: DevicesDialogProps) {
  const columns: readonly Column<Device>[] = [
    { id: "label", header: "Appareil", role: "title", cell: (device) => device.label },
    { id: "lastSeen", header: "Dernière activité", cell: (device) => formatDateTime(device.lastSeen) },
    {
      id: "status",
      header: "Session",
      role: "status",
      cell: (device) => (device.current ? <Badge tone="info">Cette session</Badge> : null),
    },
    {
      id: "actions",
      header: "Action",
      role: "action",
      hideHeader: true,
      cell: (device) =>
        device.current ? null : (
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Déconnecter ${device.label}`}
            onClick={() => {
              onSignOut(device);
            }}
          >
            Déconnecter
          </Button>
        ),
    },
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title="Appareils connectés" description="Déconnectez un appareil que vous ne reconnaissez pas.">
        <DialogBody>
          <DataTable caption="Appareils connectés" columns={columns} rows={devices} getRowId={(device) => device.id} />
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
