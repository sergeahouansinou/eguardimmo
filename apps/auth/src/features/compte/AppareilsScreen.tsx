"use client";

import { Button, Card } from "@eguardimmo/ui";
import { useState } from "react";
import { StatusPill } from "./parts";
import { useSecurity, useSignOutDevice, useSignOutOtherDevices } from "@/features/auth/queries";
import type { Device } from "@/features/auth/schemas";
import { useAuthSource } from "@/features/auth/source";
import { formatActivity } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { ConfirmDialog } from "./ConfirmDialog";
import { useNoticeStore } from "./noticeStore";
import { PageHead } from "./parts";
import { QueryState } from "./QueryState";

const TYPE_LABELS: Record<Device["type"], string> = { mobile: "Application mobile", navigateur: "Navigateur" };

export function AppareilsScreen() {
  const source = useAuthSource();
  const security = useSecurity();
  const signOutDevice = useSignOutDevice();
  const signOutOthers = useSignOutOtherDevices();
  const show = useNoticeStore((state) => state.show);
  const [confirming, setConfirming] = useState(false);
  const devices = security.data?.devices ?? [];
  const others = devices.filter((device) => !device.current);

  const failure = () => {
    show({ tone: "danger", title: "Opération impossible pour le moment.", message: "Réessayez dans un instant." });
  };

  return (
    <>
      <PageHead
        crumbs={[{ label: "Mon compte", href: ROUTES.compte }, { label: "Appareils" }]}
        title="Appareils connectés"
        description="Déconnectez un appareil que vous ne reconnaissez pas."
        actions={
          <Button variant="secondary" disabled={others.length === 0} onClick={() => { setConfirming(true); }}>
            Déconnecter les autres appareils
          </Button>
        }
      />
      <QueryState isPending={security.isPending} isError={security.isError} refetch={security.refetch} label="appareils">
        <Card aria-label="Appareils" className="p-0">
          <table className="w-full text-left text-body">
            <thead className="sr-only md:not-sr-only">
              <tr className="border-b border-line text-caption text-fg-subtle">
                <th scope="col" className="px-4 py-2 font-medium">Appareil</th>
                <th scope="col" className="px-4 py-2 font-medium">Type</th>
                <th scope="col" className="px-4 py-2 font-medium">Dernière activité</th>
                <th scope="col" className="px-4 py-2 font-medium"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="block border-b border-line px-4 py-3 last:border-b-0 md:table-row md:p-0">
                  <td className="block font-medium text-fg md:table-cell md:px-4 md:py-3">{device.name}</td>
                  <td className="block text-caption text-fg-subtle md:table-cell md:px-4 md:py-3 md:text-body md:text-fg-muted">
                    {TYPE_LABELS[device.type]}
                  </td>
                  <td className="block text-caption text-fg-subtle md:table-cell md:px-4 md:py-3 md:text-body md:text-fg-muted">
                    {device.current ? (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        En cours <StatusPill tone="info">Cet appareil</StatusPill>
                      </span>
                    ) : (
                      formatActivity(device.lastActivityAt, source.now())
                    )}
                  </td>
                  <td className="mt-2 block md:mt-0 md:table-cell md:px-4 md:py-3 md:text-right">
                    {device.current ? null : (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Déconnecter ${device.name}`}
                        loading={signOutDevice.isPending && signOutDevice.variables === device.id}
                        onClick={() => {
                          signOutDevice
                            .mutateAsync(device.id)
                            .then(() => { show({ tone: "success", title: `${device.name} déconnecté.` }); })
                            .catch(failure);
                        }}
                      >
                        Déconnecter
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </QueryState>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Déconnecter les autres appareils ?"
        description="Seul cet appareil restera connecté. Les autres devront saisir de nouveau leurs identifiants."
        confirmLabel="Déconnecter"
        tone="danger"
        pending={signOutOthers.isPending}
        onConfirm={() => {
          signOutOthers
            .mutateAsync(undefined)
            .then(() => {
              setConfirming(false);
              show({ tone: "success", title: "Les autres appareils ont été déconnectés." });
            })
            .catch(() => {
              setConfirming(false);
              failure();
            });
        }}
      />
    </>
  );
}
