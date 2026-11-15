"use client";

import { useCallback } from "react";
import { useToast } from "./Toast";

function fileName(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "document"}.txt`;
}

export function useDownload() {
  const { notify } = useToast();
  return useCallback(
    (title: string) => {
      const blob = new Blob([`${title}\n\nFichier de démonstration : le document réel est fourni par l'agence.\n`], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(title);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify(`« ${title} » téléchargé, fichier de démonstration.`);
    },
    [notify],
  );
}
