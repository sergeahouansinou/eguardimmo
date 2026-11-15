"use client";

import { PageHeader } from "@eguardimmo/messagerie";
import { Badge, Card, SegmentedControl } from "@eguardimmo/ui";
import type { BadgeTone } from "@eguardimmo/ui";
import Link from "next/link";
import { useState } from "react";
import { CHANGELOG } from "./changelog";
import { AIDE_CRUMB } from "./RaccourcisPage";
import type { ChangelogEntry } from "./schemas";

type Filter = "all" | ChangelogEntry["kind"];

const KIND_LABELS: Record<ChangelogEntry["kind"], string> = { nouveau: "Nouveau", amelioration: "Amélioration", correctif: "Correctif" };
const KIND_TONES: Record<ChangelogEntry["kind"], BadgeTone> = { nouveau: "success", amelioration: "info", correctif: "neutral" };
const FILTERS = [
  { value: "all", label: "Tout" },
  { value: "nouveau", label: "Nouveautés" },
  { value: "amelioration", label: "Améliorations" },
  { value: "correctif", label: "Correctifs" },
];

function isFilter(value: string): value is Filter {
  return FILTERS.some((filter) => filter.value === value);
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function NouveautesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const entries = [...CHANGELOG]
    .filter((entry) => filter === "all" || entry.kind === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Nouveautés"
        subtitle="Les dernières évolutions de votre espace bailleur."
        breadcrumb={[AIDE_CRUMB, { label: "Nouveautés" }]}
      />
      <SegmentedControl
        label="Type de nouveauté"
        options={FILTERS}
        value={filter}
        onValueChange={(value) => {
          if (isFilter(value)) setFilter(value);
        }}
      />
      {entries.length === 0 ? (
        <p role="status" className="rounded-lg border border-dashed border-line-control p-4 text-body text-fg-muted">
          Aucune nouveauté de ce type pour le moment.
        </p>
      ) : (
        <ol aria-label="Nouveautés" className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={KIND_TONES[entry.kind]}>{KIND_LABELS[entry.kind]}</Badge>
                  <time dateTime={entry.date} className="text-caption text-fg-subtle">
                    {dateFormat.format(new Date(`${entry.date}T12:00:00Z`))}
                  </time>
                </div>
                <h2 className="text-block-title text-fg">{entry.title}</h2>
                <p className="text-body text-fg-muted">{entry.summary}</p>
                {entry.href ? (
                  <Link
                    href={entry.href}
                    aria-label={`Voir la page : ${entry.title}`}
                    className="w-fit text-body font-medium text-action-on-subtle underline underline-offset-3"
                  >
                    Voir la page
                  </Link>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
