"use client";

import { Button, Icon } from "@eguardimmo/ui";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { describeFailure } from "../errors";
import { useOwnerSession } from "../session";
import { fetchFile, saveBlob } from "./download";
import type { FileFormat } from "./download";

export interface DownloadActionProps {
  path: string;
  filename: string;
  format: FileFormat;
  label: string;
  ariaLabel?: string;
  variant?: "primary" | "secondary" | "link";
}

export function DownloadAction({ path, filename, format, label, ariaLabel, variant = "secondary" }: DownloadActionProps) {
  const { client } = useOwnerSession();
  const download = useMutation({
    mutationFn: async () => {
      saveBlob(await fetchFile(client, path, format), filename);
    },
  });
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={variant === "link" ? "sm" : "md"}
        loading={download.isPending}
        aria-label={ariaLabel}
        onClick={() => {
          download.mutate();
        }}
      >
        <Icon icon={Download} />
        {label}
      </Button>
      {download.isError ? (
        <span role="alert" className="text-caption text-fg-danger">
          {describeFailure(download.error).message}
        </span>
      ) : null}
    </span>
  );
}
