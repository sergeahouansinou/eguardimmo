"use client";

import { FileDrop } from "@/features/kit/FileDrop";
import { FormSection } from "@/components/ui/FormSection";
import { MANDATE_FILE_RULES } from "../mandateFiles";

export function AvenantSignedFile({ file, error, onFile }: { file: File | null; error: string | undefined; onFile: (file: File | null) => void }) {
  return (
    <FormSection title="Avenant signé">
      <FileDrop
        title="Avenant signé par le mandant *"
        hint="PDF, JPG, PNG ou WebP, 10 Mo au maximum. Il est analysé par l'antivirus, puis partagé d'office avec le mandant."
        rules={MANDATE_FILE_RULES}
        file={file}
        onFileChange={onFile}
        browseLabel="Joindre l'avenant signé"
        {...(error ? { error } : {})}
      />
    </FormSection>
  );
}
