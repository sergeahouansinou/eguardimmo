"use client";

import { Alert, Badge, Button, EmptyState, Select, Switch } from "@eguardimmo/ui";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { ActionDialog, DataTable, PageFrame, useNotify } from "@/features/kit";
import type { Column } from "@/features/kit";
import { errorMessage } from "@/features/org/errors";
import { useModuleAccess } from "@/features/org/access";
import { LoadingPanel, QueryFailure } from "@/features/org/QueryBoundary";
import { FieldDialog } from "./FieldDialog";
import { useArchiveField, useCustomFields } from "./hooks";
import { CHOICE_TYPES, ENTITY_LABELS, TYPE_LABELS, VOCABULARY_LABELS } from "./labels";
import { ENTITIES } from "./schemas";
import type { CustomField, Entity } from "./schemas";

const ENTITY_OPTIONS = ENTITIES.map((value) => ({ value, label: ENTITY_LABELS[value] }));

function isEntity(value: string): value is Entity {
  return (ENTITIES as readonly string[]).includes(value);
}

function typeDetail(field: CustomField): string | null {
  if (field.type === "term" && field.vocabulary !== null) return VOCABULARY_LABELS[field.vocabulary];
  if (CHOICE_TYPES.includes(field.type)) return `${String(field.options.length)} option${field.options.length > 1 ? "s" : ""}`;
  return null;
}

interface Handlers {
  onEdit: (field: CustomField) => void;
  onToggle: (field: CustomField) => void;
}

function columns(canWrite: boolean, handlers: Handlers): readonly Column<CustomField>[] {
  const base: Column<CustomField>[] = [
    {
      id: "label",
      header: "Champ",
      role: "title",
      cell: (field) => (
        <span className="flex flex-col">
          <span>{field.labels.fr ?? Object.values(field.labels)[0] ?? field.key}</span>
          <span className="text-caption font-normal text-fg-subtle">{field.key}</span>
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (field) => (
        <span className="flex flex-col">
          <span>{TYPE_LABELS[field.type]}</span>
          {typeDetail(field) === null ? null : <span className="text-caption text-fg-subtle">{typeDetail(field)}</span>}
        </span>
      ),
    },
    { id: "required", header: "Obligatoire", cell: (field) => (field.required ? <Badge tone="info">Obligatoire</Badge> : <span className="text-fg-subtle">Facultatif</span>) },
    { id: "status", header: "Statut", role: "status", cell: (field) => (field.archived ? <Badge tone="neutral">Archivé</Badge> : <Badge tone="success">Actif</Badge>) },
  ];
  if (!canWrite) return base;
  return [
    ...base,
    {
      id: "action",
      header: "Actions",
      role: "action",
      hideHeader: true,
      cell: (field) => (
        <span className="flex flex-wrap gap-2">
          {field.archived ? null : (
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                handlers.onEdit(field);
              }}
            >
              Modifier <span className="sr-only">le champ {field.key}</span>
            </Button>
          )}
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              handlers.onToggle(field);
            }}
          >
            {field.archived ? "Restaurer " : "Archiver "}
            <span className="sr-only">le champ {field.key}</span>
          </Button>
        </span>
      ),
    },
  ];
}

export function ChampsPage() {
  const access = useModuleAccess();
  const notify = useNotify();
  const archive = useArchiveField();
  const [entity, setEntity] = useState<Entity>("unit");
  const [showArchived, setShowArchived] = useState(false);
  const fields = useCustomFields(entity, showArchived);
  const [editing, setEditing] = useState<{ field: CustomField | null } | null>(null);
  const [toggling, setToggling] = useState<CustomField | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const confirmToggle = async () => {
    if (toggling === null) return;
    setFailure(null);
    try {
      await archive.mutateAsync(toggling);
      notify.success(toggling.archived ? "Champ restauré" : "Champ archivé", toggling.labels.fr ?? toggling.key);
      setToggling(null);
    } catch (error: unknown) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <PageFrame
      crumbs={[{ label: "Réglages" }, { label: "Champs personnalisés" }]}
      title="Champs personnalisés"
      description="Ajoutez à chaque objet les informations propres à votre agence. Un champ archivé n’apparaît plus dans les formulaires, mais ses valeurs sont conservées."
      actions={
        access.settings ? (
          <Button
            onClick={() => {
              setEditing({ field: null });
            }}
          >
            Nouveau champ
          </Button>
        ) : undefined
      }
    >
      {access.settings ? null : (
        <Alert tone="info" title="Lecture seule">
          Seuls le titulaire et les administrateurs de l’agence créent, modifient ou archivent les champs personnalisés.
        </Alert>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs">
          <Select
            label="Objet"
            placeholder="Choisir un objet"
            options={ENTITY_OPTIONS}
            value={entity}
            onValueChange={(value) => {
              if (isEntity(value)) setEntity(value);
            }}
          />
        </div>
        <Switch label="Afficher les champs archivés" checked={showArchived} onCheckedChange={setShowArchived} />
      </div>
      {fields.isError ? (
        <QueryFailure error={fields.error} label="Les champs personnalisés" onRetry={fields.refetch} />
      ) : fields.isPending || fields.data === undefined ? (
        <LoadingPanel label="Les champs personnalisés" />
      ) : fields.data.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title="Aucun champ personnalisé" description={`Aucun champ n’est défini pour les objets « ${ENTITY_LABELS[entity].toLowerCase()} ».`} />
      ) : (
        <DataTable
          caption={`Champs personnalisés : ${ENTITY_LABELS[entity].toLowerCase()}`}
          columns={columns(access.settings, { onEdit: (field) => { setEditing({ field }); }, onToggle: setToggling })}
          rows={fields.data}
          getRowId={(field) => field.id}
        />
      )}
      {editing === null ? null : (
        <FieldDialog
          open
          entity={entity}
          field={editing.field}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
      <ActionDialog
        open={toggling !== null}
        onOpenChange={(open) => {
          if (open) return;
          setToggling(null);
          setFailure(null);
        }}
        title={toggling?.archived === true ? "Restaurer ce champ ?" : "Archiver ce champ ?"}
        description={
          toggling?.archived === true
            ? "Le champ réapparaît dans les formulaires, avec ses valeurs d’origine."
            : "Le champ disparaît des formulaires. Ses valeurs sont conservées et reviennent si vous le restaurez."
        }
        confirmLabel={toggling?.archived === true ? "Restaurer" : "Archiver"}
        loading={archive.isPending}
        error={failure}
        onConfirm={() => {
          void confirmToggle();
        }}
      />
    </PageFrame>
  );
}
