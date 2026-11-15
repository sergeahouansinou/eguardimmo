"use client";

import { Badge, Button, Icon } from "@eguardimmo/ui";
import type { BadgeTone } from "@eguardimmo/ui";
import { Download } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { rentStateLabel } from "../data/derive";
import type { RentState } from "../data/derive";
import type { Intervention } from "../data/schemas";
import { useDownload } from "./useDownload";

export function RentStateBadge({ state }: { state: RentState }) {
  const tone: BadgeTone = state.kind === "paid" ? "success" : state.kind === "overdue" ? "danger" : "neutral";
  return <Badge tone={tone}>{rentStateLabel(state)}</Badge>;
}

export function DownloadButton({ title, label = "Télécharger" }: { title: string; label?: string }) {
  const download = useDownload();
  return (
    <Button variant="link" size="sm" aria-label={`${label} : ${title}`} onClick={() => { download(title); }}>
      {label}
    </Button>
  );
}

export function PrimaryDownload({ title, label }: { title: string; label: string }) {
  const download = useDownload();
  return (
    <Button onClick={() => { download(title); }}>
      <Icon icon={Download} />
      {label}
    </Button>
  );
}

export function SecondaryDownload({ title, label }: { title: string; label: string }) {
  const download = useDownload();
  return (
    <Button variant="secondary" onClick={() => { download(title); }}>
      <Icon icon={Download} />
      {label}
    </Button>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="link" size="sm" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export const INTERVENTION_STATUS: Record<Intervention["status"], { label: string; tone: BadgeTone }> = {
  quote_pending: { label: "Devis à valider", tone: "warning" },
  quote_accepted: { label: "Devis accepté", tone: "info" },
  quote_refused: { label: "Devis refusé", tone: "neutral" },
  done: { label: "Terminée", tone: "success" },
};
