"use client";

import { AttachmentList, AttachmentPicker, PageHeader, useAttachments, useCreateSupportTicket } from "@eguardimmo/messagerie";
import { Alert, Button, Card, Icon, Select, TextField, Textarea } from "@eguardimmo/ui";
import { Bug } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AIDE_CRUMB } from "./RaccourcisPage";
import { BUG_AREAS, BUG_FIELDS, BUG_AREA_LABELS, BUG_SEVERITIES, BUG_SEVERITY_LABELS, EMPTY_BUG_REPORT, bugReportSchema, bugReportToTicket } from "./schemas";
import type { BugReport } from "./schemas";

type Errors = Partial<Record<keyof BugReport, string>>;

const AREA_OPTIONS = BUG_AREAS.map((value) => ({ value, label: BUG_AREA_LABELS[value] }));
const SEVERITY_OPTIONS = BUG_SEVERITIES.map((value) => ({ value, label: BUG_SEVERITY_LABELS[value] }));

function pick<T extends string>(candidates: readonly T[], value: string): T | undefined {
  return candidates.find((candidate): candidate is T => candidate === value);
}

export function SignalerPage() {
  const create = useCreateSupportTicket();
  const attachments = useAttachments();
  const [report, setReport] = useState<BugReport>(EMPTY_BUG_REPORT);
  const [errors, setErrors] = useState<Errors>({});
  const [reference, setReference] = useState<string | null>(null);

  const update = (patch: Partial<BugReport>) => {
    setReport((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !(key in patch))));
  };

  const submit = () => {
    const parsed = bugReportSchema.safeParse(report);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = pick(BUG_FIELDS, String(issue.path[0]));
        if (key && next[key] === undefined) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    const { subject, body } = bugReportToTicket(parsed.data);
    create.mutate(
      { category: "autre", subject, body, attachments: attachments.files },
      {
        onSuccess: (ticket) => {
          setReference(ticket.reference);
          setReport(EMPTY_BUG_REPORT);
          attachments.clear();
        },
      },
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Signaler un problème"
        subtitle="Un affichage incorrect, un calcul étonnant, une page qui ne répond plus : dites-nous ce qui s’est passé."
        breadcrumb={[AIDE_CRUMB, { label: "Signaler un problème" }]}
      />
      {reference ? (
        <Alert tone="success" title="Signalement envoyé">
          Votre signalement porte la référence {reference}.{" "}
          <Link href="/aide/support" className="font-medium underline underline-offset-3">
            Suivre mes demandes
          </Link>
        </Alert>
      ) : null}
      <Card className="max-w-3xl">
        <form
          noValidate
          aria-label="Signaler un problème"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Zone concernée"
              placeholder="Choisir une zone"
              options={AREA_OPTIONS}
              value={report.area}
              onValueChange={(value) => {
                const area = pick(BUG_AREAS, value);
                if (area) update({ area });
              }}
            />
            <Select
              label="Gravité"
              placeholder="Choisir une gravité"
              options={SEVERITY_OPTIONS}
              value={report.severity}
              onValueChange={(value) => {
                const severity = pick(BUG_SEVERITIES, value);
                if (severity) update({ severity });
              }}
            />
          </div>
          <TextField
            label="Résumé"
            placeholder="Ex. Le total des loyers de novembre est faux"
            value={report.summary}
            maxLength={120}
            onChange={(event) => { update({ summary: event.target.value }); }}
            {...(errors.summary ? { error: errors.summary } : {})}
          />
          <Textarea
            label="Étapes pour reproduire"
            placeholder="Ex. 1. Ouvrir Finances. 2. Filtrer sur novembre. 3. Le total affiche 0 €."
            rows={5}
            value={report.steps}
            onChange={(event) => { update({ steps: event.target.value }); }}
            {...(errors.steps ? { error: errors.steps } : {})}
          />
          <Textarea
            label="Résultat attendu (facultatif)"
            placeholder="Ex. Le total devrait correspondre aux loyers encaissés."
            rows={3}
            value={report.expected}
            onChange={(event) => { update({ expected: event.target.value }); }}
            {...(errors.expected ? { error: errors.expected } : {})}
          />
          <div className="flex flex-col gap-2">
            <AttachmentPicker attachments={attachments} variant="zone" disabled={create.isPending} />
            <AttachmentList files={attachments.files} onRemove={attachments.remove} />
          </div>
          {create.isError ? (
            <Alert tone="danger" title="Envoi impossible">
              Votre signalement n’a pas pu être envoyé. Réessayez dans un instant.
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" loading={create.isPending}>
              <Icon icon={Bug} />
              Envoyer le signalement
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
