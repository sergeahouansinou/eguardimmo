"use client";

import { useToast } from "@eguardimmo/ui";

export function useDemoDownload() {
  const toast = useToast();
  return (title: string) => {
    toast.show({
      tone: "info",
      title: "Téléchargement indisponible en démonstration",
      description: `« ${title} » sera fourni par l'API lorsqu'elle sera branchée.`,
    });
  };
}
