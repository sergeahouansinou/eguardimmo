"use client";

import { downloadDemoPdf } from "@eguardimmo/shell";
import { useToast } from "@eguardimmo/ui";

function fileName(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "document"}.pdf`;
}

export function useDemoDownload() {
  const toast = useToast();
  return (title: string) => {
    downloadDemoPdf(fileName(title), title);
    toast.show({ tone: "success", title: "Téléchargement lancé", description: `« ${title} » téléchargé, fichier de démonstration.` });
  };
}
