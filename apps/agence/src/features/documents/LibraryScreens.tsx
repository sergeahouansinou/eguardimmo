"use client";

import { DocumentsLibraryAddPage, DocumentsLibraryPage } from "@eguardimmo/gestion";
import { useMemo } from "react";
import { bindLot } from "@/features/gestion/bind";
import { usePortefeuille } from "@/features/portefeuille/queries";

function useMandateChoices() {
  const portefeuille = usePortefeuille().data;
  return useMemo(() => {
    const mandats = portefeuille?.data.mandats ?? [];
    return {
      options: mandats
        .filter((mandat) => mandat.archived !== true)
        .map((mandat) => ({ value: mandat.id, label: [mandat.number, portefeuille?.mandant(mandat.mandantId)?.name].filter(Boolean).join(" · ") })),
      labelOf: (mandateId: string): string | null => {
        const mandat = portefeuille?.mandat(mandateId);
        return mandat ? `Mandat ${mandat.number}` : null;
      },
    };
  }, [portefeuille]);
}

export const DocumentsLibraryScreen = bindLot(function DocumentsLibraryScreen() {
  const { labelOf } = useMandateChoices();
  return <DocumentsLibraryPage mandateLabelOf={labelOf} />;
});

export const DocumentsLibraryAddScreen = bindLot(function DocumentsLibraryAddScreen() {
  const { options } = useMandateChoices();
  return <DocumentsLibraryAddPage mandateOptions={options} />;
});
