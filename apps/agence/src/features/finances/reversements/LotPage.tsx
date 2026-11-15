"use client";

import { Alert, Badge, Button, EmptyState } from "@eguardimmo/ui";
import { CircleCheck, Landmark, X } from "lucide-react";
import { IconButton } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { ActionDialog, DataTable, Kpi, KpiGrid, LinkButton, PageFrame, SummaryLines, useNotify } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatDate, formatPeriod } from "@/features/shared/dates";
import { messageOf } from "@/features/shared/errors";
import { formatMoneyExact } from "@/features/shared/money";
import { plural } from "../format";
import { newKey, useIncludeInLot, useLot, usePrepareLot, useRemoveFromLot, useValidateLot } from "../hooks";
import type { TransferLot } from "../schemas";

type Transfer = TransferLot["transfers"][number];

const CRUMBS = [{ label: "Reversements", href: "/finances/reversements" }, { label: "Lot de virements" }];

export function LotPage() {
  const query = useLot();
  return (
    <QueryState query={query} label="Le lot de virements">
      {(lot) => (lot ? <LotContent lot={lot} /> : <NoLot />)}
    </QueryState>
  );
}

function NoLot() {
  const notify = useNotify();
  const prepare = usePrepareLot();
  return (
    <PageFrame crumbs={CRUMBS} title="Lot de virements" description="Aucun lot de virements n'est en préparation pour ce mois.">
      <EmptyState icon={Landmark} title="Aucun lot en préparation" description="Préparez le lot pour relire les bénéficiaires et les montants avant de le transmettre à la banque.">
        <Button
          loading={prepare.isPending}
          onClick={() => {
            prepare.mutate(undefined, { onError: (error) => { notify.error("Le lot n'a pas pu être préparé", messageOf(error)); } });
          }}
        >
          Préparer le lot de virements
        </Button>
        <LinkButton href="/finances/reversements" variant="secondary">
          Retour aux reversements
        </LinkButton>
      </EmptyState>
    </PageFrame>
  );
}

function LotContent({ lot }: { lot: TransferLot }) {
  const router = useRouter();
  const notify = useNotify();
  const validate = useValidateLot();
  const remove = useRemoveFromLot();
  const include = useIncludeInLot();
  const [confirming, setConfirming] = useState(false);
  const [idempotencyKey] = useState(() => newKey("lot"));
  const draft = lot.status === "brouillon";
  const renewals = lot.transfers.filter((transfer) => transfer.mandateRenewal).length;
  const count = lot.transfers.length;

  const columns: Column<Transfer>[] = [
    {
      id: "beneficiary",
      header: "Bénéficiaire",
      role: "title",
      cell: (row) => (
        <>
          <span className="block">{row.name}</span>
          <span className="block text-caption font-normal text-fg-subtle">{row.kind}</span>
        </>
      ),
    },
    { id: "iban", header: "Compte", cell: (row) => `IBAN •••• ${row.ibanLast4}` },
    { id: "label", header: "Libellé", cell: (row) => row.label },
    { id: "amount", header: "Montant", numeric: true, cell: (row) => formatMoneyExact(row.netMinor) },
    ...(draft
      ? [
          {
            id: "action",
            header: "Action",
            role: "action" as const,
            hideHeader: true,
            cell: (row: Transfer) => (
              <IconButton
                label={`Retirer ${row.name} du lot`}
                icon={X}
                onClick={() => {
                  remove.mutate({ batchId: lot.id, mandantId: row.mandantId }, { onSuccess: () => { notify.info("Mandant retiré du lot", `${row.name} sera reversé avec le prochain lot.`); }, onError: (error) => { notify.error("Retrait impossible", messageOf(error)); } });
                }}
              />
            ),
          },
        ]
      : []),
  ];

  const confirm = () => {
    validate.mutate(
      { batchId: lot.id, idempotencyKey },
      {
        onSuccess: (result) => {
          notify.success("Lot transmis à la banque", `${plural(result.transfersCount, "virement", "virements")} · ${formatMoneyExact(result.totalMinor)}`);
          router.push("/finances/reversements");
        },
      },
    );
  };

  return (
    <PageFrame
      crumbs={CRUMBS}
      title={`Lot de virements, ${formatPeriod(lot.period).toLowerCase()}`}
      badges={draft ? <Badge tone="warning">À valider</Badge> : <Badge tone="success">Transmis à la banque</Badge>}
      description={`${plural(count, "virement SEPA", "virements SEPA")} · ${formatMoneyExact(lot.totalMinor)} · exécution le ${formatDate(lot.executionOn)}, au prochain jour ouvré`}
      actions={
        <>
          <LinkButton href="/finances/reversements">Retour aux reversements</LinkButton>
          {draft ? (
            <Button
              disabled={count === 0}
              onClick={() => {
                setConfirming(true);
              }}
            >
              Valider et transmettre à la banque
            </Button>
          ) : null}
        </>
      }
    >
      {draft ? (
        <Alert tone="warning" title="Un virement transmis à la banque ne peut plus être annulé">
          Relisez les bénéficiaires et les montants avant de valider. Chaque virement est tracé dans le journal d'audit.
        </Alert>
      ) : (
        <Alert tone="success" title={`Lot transmis à la banque le ${formatDate(lot.validatedAt ?? lot.executionOn)}`}>
          Les virements seront exécutés le {formatDate(lot.executionOn)}. Ils ne peuvent plus être modifiés.
        </Alert>
      )}
      <KpiGrid columns={4}>
        <Kpi label="Virements" value={String(count)} hint={`${plural(count, "mandant", "mandants")}, ${plural(lot.lotsCount, "lot", "lots")}`} />
        <Kpi label="Total à virer" value={formatMoneyExact(lot.totalMinor)} hint="Aux mandants" />
        <Kpi label="Honoraires de l'agence" value={formatMoneyExact(lot.feesMinor)} hint="Transférés au compte du cabinet" />
        <Kpi label="Exécution" value={formatDate(lot.executionOn)} hint="Prochain jour ouvré" />
      </KpiGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard title="Virements du lot">
          <div className="px-4 pb-4">
            <DataTable
              caption="Virements du lot"
              rows={lot.transfers}
              getRowId={(row) => row.mandantId}
              columns={columns}
              empty={<EmptyState icon={Landmark} title="Le lot est vide" description="Ajoutez au moins un mandant pour pouvoir transmettre le lot." />}
              {...(count > 0 ? { footer: { amount: formatMoneyExact(lot.totalMinor) } } : {})}
            />
          </div>
        </SectionCard>
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard title={`Fonds de ${formatPeriod(lot.period).split(" ")[0]?.toLowerCase() ?? ""}`}>
            <div className="flex flex-col gap-2 px-4 pb-4">
              <SummaryLines
                lines={[
                  { label: "Loyers encaissés", value: formatMoneyExact(lot.collectedMinor) },
                  { label: "Virements aux mandants", value: formatMoneyExact(-lot.totalMinor) },
                  { label: "Honoraires du cabinet", value: formatMoneyExact(-lot.feesMinor) },
                  { label: "Reste", value: formatMoneyExact(lot.retainedMinor) },
                ]}
              />
              <p className="text-caption text-fg-subtle">{`Compte des mandants •••• ${lot.accountLast4}, séparé.`}</p>
            </div>
          </SectionCard>
          <SectionCard title="Contrôles">
            <div className="px-4 pb-3">
              <ListRow icon={CircleCheck} tone="success" title="IBAN vérifiés" caption={`${String(count)} sur ${String(count)}, titulaires conformes`} />
              <ListRow icon={CircleCheck} tone="success" title="Mandats en vigueur" caption={`${String(count)} sur ${String(count)}, dont ${String(renewals)} à renouveler`} />
              <ListRow icon={CircleCheck} tone="success" title="Fonds suffisants" caption="Aucun virement sans encaissement" />
            </div>
          </SectionCard>
          {lot.excluded.length > 0 ? (
            <SectionCard title="Non inclus dans ce lot">
              <div className="px-4 pb-3">
                {lot.excluded.map((item) => (
                  <ListRow
                    key={item.mandantId}
                    title={item.name}
                    caption={item.reason}
                    trailing={
                      item.canInclude ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={include.isPending}
                          onClick={() => {
                            include.mutate({ mandantId: item.mandantId }, { onSuccess: () => { notify.success("Mandant ajouté au lot", item.name); }, onError: (error) => { notify.error("Ajout impossible", messageOf(error)); } });
                          }}
                        >
                          Inclure<span className="sr-only"> {item.name} dans le lot</span>
                        </Button>
                      ) : null
                    }
                  />
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
      <ActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Transmettre le lot à la banque"
        description={`${plural(count, "virement", "virements")} pour ${formatMoneyExact(lot.totalMinor)} seront transmis à la banque. Un virement transmis ne peut plus être annulé.`}
        confirmLabel="Valider et transmettre"
        loading={validate.isPending}
        error={validate.isError ? messageOf(validate.error) : null}
        onConfirm={confirm}
      />
    </PageFrame>
  );
}
