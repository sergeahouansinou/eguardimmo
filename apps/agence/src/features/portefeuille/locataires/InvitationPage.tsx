"use client";

import { Alert, Button, Card, CardTitle, ConfirmDialog, Select, Tab, TabList, TabPanel, Tabs, Textarea, TextField, useToast } from "@eguardimmo/ui";
import { Copy, Link2, Mail, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { DataList } from "@/components/ui/DataList";
import type { DataColumn } from "@/components/ui/DataList";
import { FormSection } from "@/components/ui/FormSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SectionCard } from "@/components/ui/SectionCard";
import { agenceRoutes, bailHref, locataireHref } from "@/espace/routes";
import { useSchemaForm } from "@/features/kit/form";
import { formatDay } from "@/lib/dates";
import { DEFAULT_INVITATION_MESSAGE, invitationFormSchema } from "../forms";
import { INVITATION_SEGMENTS, invitationPill, invitationStatus } from "../invitations";
import type { InvitationSegment } from "../invitations";
import { useCancelInvitation, useCreateInvitation, usePortefeuille, useResendInvitation } from "../queries";
import type { Portefeuille } from "../selectors";
import type { Invitation } from "../schemas";
import { INVITATION_VALIDITY_DAYS, PortefeuilleError } from "../source";

const SERVER_FIELDS = ["email", "bailId"] as const;
type ServerField = (typeof SERVER_FIELDS)[number];
const isServerField = (field: string | undefined): field is ServerField => SERVER_FIELDS.some((name) => name === field);

export function InvitationPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La page d'invitation des locataires">
      {(index) => <Invitations index={index} />}
    </QueryState>
  );
}

function Invitations({ index }: { index: Portefeuille }) {
  const { data } = index;
  const params = useSearchParams();
  const toast = useToast();
  const create = useCreateInvitation();
  const resend = useResendInvitation();
  const cancel = useCancelInvitation();
  const [failure, setFailure] = useState<string>();
  const [created, setCreated] = useState<Invitation>();
  const [segment, setSegment] = useState<InvitationSegment>("toutes");
  const [cancelling, setCancelling] = useState<Invitation>();

  const candidates = data.baux.filter((bail) => bail.status !== "termine" && index.locataire(bail.locataireId)?.spaceActive === false);
  const requested = params.get("bail") ?? "";
  const initialBail = candidates.find((bail) => bail.id === requested);
  const { register, control, handleSubmit, watch, setValue, reset, setError, getValues, formState: { errors } } = useSchemaForm(invitationFormSchema, {
    email: initialBail ? (index.locataire(initialBail.locataireId)?.email ?? "") : "",
    bailId: initialBail?.id ?? "",
    message: DEFAULT_INVITATION_MESSAGE,
  });
  const values = watch();
  const bail = index.bail(values.bailId);
  const bien = bail ? index.bien(bail.bienId) : undefined;
  const tenant = bail ? index.locataire(bail.locataireId) : undefined;

  const bailOptions = candidates.map((item) => {
    const lot = index.bien(item.bienId);
    const person = index.locataire(item.locataireId);
    return { value: item.id, label: `${item.number}, ${lot?.name ?? "Lot inconnu"}`, description: person ? `${person.name} · ${person.email}` : "Locataire inconnu" };
  });

  const submit = handleSubmit(async (formValues) => {
    setFailure(undefined);
    try {
      const invitation = await create.mutateAsync(formValues);
      setCreated(invitation);
      toast.show({ title: "Invitation envoyée", description: `Un lien d'activation valable ${String(INVITATION_VALIDITY_DAYS)} jours part vers ${invitation.email}.` });
      reset({ email: "", bailId: "", message: DEFAULT_INVITATION_MESSAGE });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "L'envoi a échoué.";
      if (error instanceof PortefeuilleError && isServerField(error.field)) setError(error.field, { message });
      else setFailure(message);
    }
  });

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.show({ title: "Lien copié", description: "Collez-le dans un message au locataire." });
    } catch {
      toast.show({ tone: "danger", title: "Copie impossible", description: "Votre navigateur refuse l'accès au presse-papiers : sélectionnez le lien et copiez-le à la main." });
    }
  };

  const resendOne = async (invitation: Invitation) => {
    try {
      const updated = await resend.mutateAsync(invitation.id);
      toast.show({ title: "Invitation renvoyée", description: `Nouveau délai de ${String(INVITATION_VALIDITY_DAYS)} jours, jusqu'au ${formatDay(updated.expiresIso)}.` });
    } catch (error: unknown) {
      toast.show({ tone: "danger", title: "Renvoi impossible", description: error instanceof Error ? error.message : "Le renvoi a échoué." });
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await cancel.mutateAsync(cancelling.id);
      toast.show({ title: "Invitation annulée", description: `Le lien envoyé à ${cancelling.email} ne fonctionne plus.` });
    } catch (error: unknown) {
      toast.show({ tone: "danger", title: "Annulation impossible", description: error instanceof Error ? error.message : "L'annulation a échoué." });
    }
    setCancelling(undefined);
  };

  const rows = [...data.invitations]
    .reverse()
    .map((invitation) => ({ invitation, status: invitationStatus(invitation, data.todayIso) }));
  const counts = (value: InvitationSegment) => (value === "toutes" ? rows.length : rows.filter((row) => row.status === value).length);
  const shown = rows.filter((row) => segment === "toutes" || row.status === segment);

  const columns: DataColumn<(typeof rows)[number]>[] = [
    {
      id: "tenant",
      header: "Locataire",
      strong: true,
      cell: ({ invitation }) => {
        const person = index.locataire(index.bail(invitation.bailId)?.locataireId ?? "");
        return person ? (
          <Link href={locataireHref(person.id)} className="hover:underline">
            {invitation.name}
          </Link>
        ) : (
          invitation.name
        );
      },
    },
    { id: "email", header: "E-mail", cell: ({ invitation }) => invitation.email },
    {
      id: "bail",
      header: "Bail",
      cell: ({ invitation }) => {
        const target = index.bail(invitation.bailId);
        return target ? (
          <Link href={bailHref(target.id)} className="hover:underline">
            {`${target.number}, ${index.bien(target.bienId)?.name ?? ""}`}
          </Link>
        ) : (
          "—"
        );
      },
    },
    { id: "sent", header: "Envoyée le", cell: ({ invitation }) => formatDay(invitation.sentIso) },
    { id: "expires", header: "Valable jusqu'au", cell: ({ invitation }) => formatDay(invitation.expiresIso) },
    { id: "state", header: "Statut", cell: ({ status }) => <PillBadge pill={invitationPill(status)} /> },
    {
      id: "action",
      header: "Action",
      cell: ({ invitation, status }) => (
        <RowMenu
          label={`Actions pour l'invitation de ${invitation.name}`}
          items={[
            ...(status === "envoyee" ? [{ id: "copier", label: "Copier le lien", icon: Copy, onSelect: () => { void copyLink(invitation.link); } }] : []),
            ...(status !== "acceptee" ? [{ id: "renvoyer", label: "Renvoyer l'invitation", icon: RefreshCw, onSelect: () => { void resendOne(invitation); } }] : []),
            ...(status === "envoyee" ? [{ id: "annuler", label: "Annuler l'invitation", icon: XCircle, tone: "danger" as const, separatorBefore: true, onSelect: () => { setCancelling(invitation); } }] : []),
            ...(status === "acceptee" ? [{ id: "bail", label: "Voir le bail", href: bailHref(invitation.bailId) }] : []),
          ]}
        />
      ),
    },
  ];

  const firstName = tenant?.name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Locataires", href: agenceRoutes.locataires }, { label: "Inviter un locataire" }]}
        title="Inviter un locataire"
        description="Le locataire active son espace pour suivre ses loyers, télécharger ses quittances et écrire à l'agence."
      />
      {failure ? <Alert tone="danger" title="Envoi impossible">{failure}</Alert> : null}
      {created ? (
        <Alert tone="success" title={`Invitation envoyée à ${created.email}`}>
          <p>{`Lien d'activation de démonstration, valable jusqu'au ${formatDay(created.expiresIso)} :`}</p>
          <p className="my-1 [overflow-wrap:anywhere] font-medium text-fg">{created.link}</p>
          <Button variant="secondary" size="sm" onClick={() => { void copyLink(created.link); }}>
            Copier le lien
          </Button>
        </Alert>
      ) : null}

      <form onSubmit={(event) => { void submit(event); }} noValidate className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <FormSection title="Destinataire">
            <Controller
              control={control}
              name="bailId"
              render={({ field }) => (
                <Select
                  label="Bail concerné *"
                  placeholder="Choisir un bail, ex. : B-2026-016, Apt 5"
                  options={bailOptions}
                  value={field.value}
                  onValueChange={(next) => {
                    field.onChange(next);
                    const person = index.locataire(index.bail(next)?.locataireId ?? "");
                    if (person && getValues("email").trim() === "") setValue("email", person.email, { shouldValidate: false });
                  }}
                  searchable
                  searchPlaceholder="Rechercher un bail ou un locataire"
                  emptyLabel="Aucun locataire sans espace"
                  hint="Seuls les locataires qui n'ont pas encore activé leur espace sont proposés."
                  {...(errors.bailId?.message ? { error: errors.bailId.message } : {})}
                />
              )}
            />
            <TextField label="E-mail du locataire *" type="email" placeholder="chloe.martin@example.com" {...register("email")} {...(errors.email?.message ? { error: errors.email.message } : {})} />
          </FormSection>
          <FormSection title="Message">
            <Textarea label="Message d'accompagnement *" placeholder="Bonjour, activez votre espace locataire…" rows={4} {...register("message")} {...(errors.message?.message ? { error: errors.message.message } : {})} />
          </FormSection>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" asChild>
              <Link href={agenceRoutes.locataires}>Annuler</Link>
            </Button>
            <Button type="submit" loading={create.isPending} className="gap-1.5">
              <Link2 aria-hidden="true" className="size-4" />
              Envoyer l&apos;invitation
            </Button>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="group" aria-label="Aperçu du message">
            <CardTitle as="h2">Aperçu du message</CardTitle>
            <div className="flex flex-col gap-2 rounded-sm border border-line bg-muted p-3 text-body text-fg">
              <div className="flex items-center gap-1.5 text-caption text-fg-subtle">
                <Mail aria-hidden="true" className="size-3.5" />
                <span>{`À : ${values.email.trim() || "locataire@example.com"}`}</span>
              </div>
              <strong className="text-body-strong">{`${data.agencyName} vous invite sur eGuardImmo`}</strong>
              <p>{firstName ? `Bonjour ${firstName},` : "Bonjour,"}</p>
              <p className="whitespace-pre-line [overflow-wrap:anywhere]">{values.message.trim() || DEFAULT_INVITATION_MESSAGE}</p>
              {bien ? <p className="text-caption text-fg-muted">{`Logement : ${bien.name}, ${bien.street}, ${bien.postalCode} ${bien.city}`}</p> : null}
              <span className="inline-flex h-8 w-fit items-center rounded-md bg-action px-3 text-body font-semibold text-on-action">Activer mon espace</span>
              <p className="text-caption text-fg-subtle">{`Ce lien est personnel et valable ${String(INVITATION_VALIDITY_DAYS)} jours.`}</p>
            </div>
          </Card>
        </aside>
      </form>

      <SectionCard title="Invitations envoyées">
        <Tabs value={segment} defaultValue="toutes" onValueChange={(next) => { setSegment(next as InvitationSegment); }}>
          <TabList aria-label="Statuts d'invitation">
            {INVITATION_SEGMENTS.map((item) => (
              <Tab key={item.value} value={item.value} count={counts(item.value)}>
                {item.label}
              </Tab>
            ))}
          </TabList>
          <TabPanel value={segment}>
            <DataList
              label="Invitations envoyées"
              rows={shown}
              columns={columns}
              rowKey={(row) => row.invitation.id}
              resetKey={segment}
              emptyTitle="Aucune invitation"
              emptyDescription="Aucune invitation ne correspond à ce statut."
            />
          </TabPanel>
        </Tabs>
      </SectionCard>

      <ConfirmDialog
        open={cancelling !== undefined}
        onOpenChange={(open) => { if (!open) setCancelling(undefined); }}
        title="Annuler l'invitation ?"
        description={cancelling ? `Le lien envoyé à ${cancelling.email} cessera de fonctionner. Vous pourrez renvoyer une invitation plus tard.` : ""}
        confirmLabel="Annuler l'invitation"
        cancelLabel="Conserver"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => { void confirmCancel(); }}
      />
    </>
  );
}
