"use client";

import { Button, Checkbox, Chip, ConfirmDialog, Select, StatCard, useToast } from "@eguardimmo/ui";
import { Eye, Printer, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataList } from "@/components/ui/DataList";
import type { DataColumn } from "@/components/ui/DataList";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SearchField } from "@/components/ui/SearchField";
import { agenceRoutes, bailHref, locataireHref, mandantHref } from "@/espace/routes";
import { PrintStyles } from "@/features/kit/PrintArea";
import { formatDay } from "@/lib/dates";
import { formatEuros, formatEurosExact } from "@/lib/money";
import { matchesQuery } from "@/lib/text";
import { avisLines, avisMonths, defaultAvisMonth, isAvisMonth, monthLabel } from "../avis";
import type { AvisLine } from "../avis";
import { plural } from "../labels";
import { usePortefeuille, useSendAvis } from "../queries";
import type { Portefeuille } from "../selectors";
import { AvisPaper } from "./AvisPaper";

export function AvisEcheancePage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="Les avis d'échéance">
      {(index) => <AvisEcheance index={index} />}
    </QueryState>
  );
}

function AvisEcheance({ index }: { index: Portefeuille }) {
  const { data } = index;
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const send = useSendAvis();
  const previewRef = useRef<HTMLElement>(null);

  const requestedMonth = params.get("mois") ?? "";
  const month = isAvisMonth(data.todayIso, requestedMonth) ? requestedMonth : defaultAvisMonth(data.todayIso);
  const [search, setSearch] = useState("");
  const [mandantId, setMandantId] = useState("tous");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selection, setSelection] = useState<{ month: string; ids: readonly string[] }>({ month, ids: [] });
  const [previewId, setPreviewId] = useState(params.get("bail") ?? "");
  const [confirming, setConfirming] = useState(false);

  const lines = useMemo(() => avisLines(index, month), [index, month]);
  const selected = selection.month === month ? selection.ids : [];
  const pending = lines.filter((line) => !line.avis);
  const called = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const preview = lines.find((line) => line.bail.id === previewId);

  const monthOptions = avisMonths(data.todayIso).map((value) => ({ value, label: monthLabel(value) }));
  const mandantOptions = [{ value: "tous", label: "Tous" }, ...data.mandants.filter((item) => lines.some((line) => line.mandant.id === item.id)).map((item) => ({ value: item.id, label: item.name }))];
  const filtered = lines.filter((line) => {
    if (pendingOnly && line.avis) return false;
    if (mandantId !== "tous" && line.mandant.id !== mandantId) return false;
    return matchesQuery(search, line.bail.number, line.bien.name, line.tenant.name, line.mandant.name);
  });

  const hasPreview = preview !== undefined;
  useEffect(() => {
    if (previewId !== "" && hasPreview) previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [previewId, hasPreview]);

  const changeMonth = (next: string) => {
    router.replace(`${agenceRoutes.avisEcheance}?mois=${next}`);
  };

  const toggle = (bailId: string, checked: boolean) => {
    setSelection({ month, ids: checked ? [...selected, bailId] : selected.filter((id) => id !== bailId) });
  };

  const sendNow = async (bailIds: readonly string[], resend: boolean) => {
    try {
      const result = await send.mutateAsync({ bailIds, month, resend });
      toast.show({
        title: result.sent > 1 ? `${String(result.sent)} avis envoyés` : result.sent === 1 ? "Avis envoyé" : "Aucun avis envoyé",
        description:
          result.skipped > 0
            ? `${plural(result.skipped, "avis déjà envoyé n'a pas été renvoyé", "avis déjà envoyés n'ont pas été renvoyés")}.`
            : `${monthLabel(month)} : copie déposée dans l'espace de chaque locataire.`,
      });
      setSelection({ month, ids: [] });
    } catch (error: unknown) {
      toast.show({ tone: "danger", title: "Envoi impossible", description: error instanceof Error ? error.message : "L'envoi a échoué." });
    }
    setConfirming(false);
  };

  const columns: DataColumn<AvisLine>[] = [
    {
      id: "select",
      header: "Choix",
      cell: (line) => (
        <Checkbox
          label={`Sélectionner le bail ${line.bail.number}`}
          hideLabel
          checked={selected.includes(line.bail.id)}
          disabled={line.avis !== undefined}
          onChange={(event) => { toggle(line.bail.id, event.target.checked); }}
        />
      ),
    },
    {
      id: "bail",
      header: "Bail",
      strong: true,
      cell: ({ bail, bien }) => (
        <>
          <Link href={bailHref(bail.id)} className="hover:underline">
            {bail.number}
          </Link>
          <span className="block text-caption font-normal text-fg-subtle">{bien.name}</span>
        </>
      ),
    },
    {
      id: "tenant",
      header: "Locataire",
      cell: ({ tenant }) => (
        <Link href={locataireHref(tenant.id)} className="hover:underline">
          {tenant.name}
        </Link>
      ),
    },
    {
      id: "mandant",
      header: "Mandant",
      cell: ({ mandant }) => (
        <Link href={mandantHref(mandant.id)} className="hover:underline">
          {mandant.name}
        </Link>
      ),
    },
    { id: "due", header: "Échéance", cell: ({ dueIso }) => formatDay(dueIso) },
    { id: "amount", header: "Montant charges comprises", numeric: true, cell: ({ amountMinor }) => formatEurosExact(amountMinor) },
    {
      id: "state",
      header: "État",
      cell: ({ avis }) => <PillBadge pill={avis ? { tone: "success", label: `Envoyé le ${formatDay(avis.sentIso)}` } : { tone: "warning", label: "À émettre" }} />,
    },
    {
      id: "action",
      header: "Action",
      cell: (line) => (
        <span className="flex items-center gap-1">
          <Button variant="link" size="sm" aria-label={`Voir l'aperçu de l'avis ${line.bail.number}`} onClick={() => { setPreviewId(line.bail.id); }}>
            Aperçu
          </Button>
          <RowMenu
            label={`Actions pour l'avis ${line.bail.number}`}
            items={[
              { id: "apercu", label: "Voir l'aperçu", icon: Eye, onSelect: () => { setPreviewId(line.bail.id); } },
              { id: "envoyer", label: line.avis ? "Renvoyer l'avis" : "Envoyer l'avis", icon: Send, onSelect: () => { void sendNow([line.bail.id], line.avis !== undefined); } },
              { id: "bail", label: "Voir le bail", href: bailHref(line.bail.id) },
            ]}
          />
        </span>
      ),
    },
  ];

  const allPendingSelected = pending.length > 0 && pending.every((line) => selected.includes(line.bail.id));

  return (
    <>
      <PrintStyles />
      <PageHeader
        crumbs={[{ label: "Baux", href: agenceRoutes.baux }, { label: "Avis d'échéance" }]}
        title="Avis d'échéance"
        description="Un avis prévient chaque locataire du montant et de la date du prochain terme. Il ne vaut pas quittance."
        actions={
          <Button disabled={selected.length === 0} onClick={() => { setConfirming(true); }}>
            {selected.length > 0 ? `Envoyer les avis sélectionnés, ${String(selected.length)}` : "Envoyer les avis sélectionnés"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Avis de ${monthLabel(month).toLowerCase()}`} value={lines.length}>
          <span className="text-caption text-fg-subtle">{plural(lines.length, "bail en cours", "baux en cours")}</span>
        </StatCard>
        <StatCard label="Envoyés" value={lines.length - pending.length}>
          <span className="text-caption text-fg-subtle">copie dans l&apos;espace du locataire</span>
        </StatCard>
        <StatCard label="À émettre" value={pending.length} tone={pending.length > 0 ? "danger" : "default"}>
          <span className="text-caption text-fg-subtle">à envoyer aux locataires</span>
        </StatCard>
        <StatCard label="Montant appelé" value={formatEuros(called)}>
          <span className="text-caption text-fg-subtle">charges comprises</span>
        </StatCard>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Select label="Mois" placeholder="Choisir un mois" options={monthOptions} value={month} onValueChange={changeMonth} className="w-48" />
        <SearchField label="Rechercher un avis" placeholder="Bail, lot, locataire, ex. : Apt 12" value={search} onChange={(event) => { setSearch(event.target.value); }} className="w-full sm:w-72" />
        <Select label="Mandant" placeholder="Tous" options={mandantOptions} value={mandantId} onValueChange={setMandantId} className="w-48" />
        <Chip pressed={pendingOnly} onClick={() => { setPendingOnly((current) => !current); }}>À émettre</Chip>
        <Button
          variant="secondary"
          disabled={pending.length === 0 || allPendingSelected}
          onClick={() => { setSelection({ month, ids: pending.map((line) => line.bail.id) }); }}
        >
          {`Sélectionner les avis à émettre, ${String(pending.length)}`}
        </Button>
      </div>

      <DataList
        label="Avis d'échéance du mois"
        rows={filtered}
        columns={columns}
        rowKey={(line) => line.bail.id}
        resetKey={`${month}|${search}|${mandantId}|${String(pendingOnly)}`}
        emptyTitle="Aucun avis ne correspond"
        emptyDescription="Modifiez le mois, la recherche ou retirez un filtre."
      />

      {previewId !== "" ? (
        <section ref={previewRef} aria-label="Aperçu de l'avis" className="flex min-w-0 flex-col gap-2 scroll-mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-block-title">Aperçu de l&apos;avis</h2>
            <div className="flex flex-wrap items-center gap-2">
              {preview ? (
                <Button variant="secondary" onClick={() => { void sendNow([preview.bail.id], preview.avis !== undefined); }} loading={send.isPending}>
                  {preview.avis ? "Renvoyer l'avis" : "Envoyer l'avis"}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => { window.print(); }} className="gap-1.5">
                <Printer aria-hidden="true" className="size-4" />
                Imprimer
              </Button>
              <Button variant="ghost" onClick={() => { setPreviewId(""); }}>
                Fermer l&apos;aperçu
              </Button>
            </div>
          </div>
          {preview ? (
            <AvisPaper line={preview} agencyName={data.agencyName} todayIso={data.todayIso} />
          ) : (
            <p className="py-2 text-body text-fg-subtle">{`Aucun avis ${monthLabel(month).toLowerCase()} pour le bail « ${previewId} » : il n'est pas en cours ou l'échéance est hors de sa durée.`}</p>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Envoyer ${plural(selected.length, "avis", "avis")} ?`}
        description={`Les avis de ${monthLabel(month).toLowerCase()} partent par e-mail aux locataires sélectionnés, avec une copie dans leur espace. Cette action est simulée en démonstration.`}
        confirmLabel="Envoyer les avis"
        loading={send.isPending}
        onConfirm={() => { void sendNow(selected, false); }}
      />
    </>
  );
}
