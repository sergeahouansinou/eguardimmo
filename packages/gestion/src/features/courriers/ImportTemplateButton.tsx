'use client';

import { Button } from '@eguardimmo/ui';
import { useRef } from 'react';
import { useCreateTemplate } from './hooks';
import { TEMPLATE_FILE_MAX_BYTES, parseTemplateFile } from './templateExchange';
import { errorMessage, useNotify } from '../locataires/kit';

export function ImportTemplateButton() {
  const input = useRef<HTMLInputElement>(null);
  const notify = useNotify();
  const create = useCreateTemplate();

  const fail = (description: string) => { notify({ tone: 'danger', title: 'Import impossible', description }); };

  const importFile = async (file: File) => {
    if (file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
      fail('Ce type de fichier n’est pas accepté. Choisissez un fichier .json exporté depuis l’application.');
      return;
    }
    if (file.size > TEMPLATE_FILE_MAX_BYTES) {
      fail(`Le fichier dépasse ${String(TEMPLATE_FILE_MAX_BYTES / 1024)} Ko.`);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      fail(errorMessage(error));
      return;
    }
    const result = parseTemplateFile(text);
    if (!result.ok) {
      fail(result.message);
      return;
    }
    try {
      const saved = await create.mutateAsync({ input: result.input });
      notify({ title: 'Modèle importé', description: saved.name });
    } catch (error) {
      fail(errorMessage(error));
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Fichier de modèle à importer"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importFile(file);
        }}
      />
      <Button variant="secondary" loading={create.isPending} onClick={() => { input.current?.click(); }}>Importer un modèle</Button>
    </>
  );
}
