'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Icon, Select, Textarea } from '@eguardimmo/ui';
import { Send } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { FailureAlert } from '@/components/FailureAlert';
import { FileDrop } from '@/components/FileDrop';
import { useFlash } from '@/components/flash';
import { PHOTO_RULES } from '@/lib/files';
import { useAttemptKey } from '@/tenant/clientId';
import { INSPECTION_WORDING, REMARK_KIND_VIEW } from '@/tenant/inspectionLabels';
import { useCreateRemark } from '@/tenant/inspectionQueries';
import { REMARK_KINDS } from '@/tenant/inspectionSchemas';
import type { RemarkKind } from '@/tenant/inspectionSchemas';
import { BODY_MAX, MAX_PHOTOS, remarkFormSchema } from './remarkFormSchema';
import type { RemarkValues } from './remarkFormSchema';

const isRemarkKind = (value: string): value is RemarkKind => REMARK_KINDS.some((kind) => kind === value);

export function RemarkForm({ inspectionId, kinds }: { inspectionId: string; kinds: readonly RemarkKind[] }) {
  const create = useCreateRemark();
  const attemptKey = useAttemptKey();
  const show = useFlash((state) => state.show);
  const form = useForm<RemarkValues>({
    resolver: zodResolver(remarkFormSchema),
    defaultValues: { kind: kinds.length === 1 ? (kinds[0] ?? '') : '', body: '', photos: [] },
  });
  const { register, handleSubmit, formState, control, setValue, reset } = form;
  const kind = useWatch({ control, name: 'kind' });

  const submit = handleSubmit((values) => {
    if (!isRemarkKind(values.kind)) return;
    const photos = values.photos;
    const clientId = attemptKey([inspectionId, values.kind, values.body, ...photos.map((photo) => `${photo.name}:${String(photo.size)}`)].join('|'));
    create.mutate(
      { inspectionId, kind: values.kind, body: values.body, photos, clientId },
      {
        onSuccess: () => {
          reset({ kind: kinds.length === 1 ? (kinds[0] ?? '') : '', body: '', photos: [] });
          show({ tone: 'success', title: 'Remarque envoyée', detail: 'Votre agence en a été informée.', path: `/etats-des-lieux/${inspectionId}` });
        },
      },
    );
  });

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      {create.isError ? <FailureAlert title="La remarque n’a pas pu être envoyée" error={create.error} wording={INSPECTION_WORDING} /> : null}
      <Select
        label="Nature de la remarque *"
        placeholder="Choisir la nature"
        hint={isRemarkKind(kind) ? REMARK_KIND_VIEW[kind].detail : undefined}
        value={kind}
        options={kinds.map((item) => ({ value: item, label: REMARK_KIND_VIEW[item].label }))}
        onValueChange={(value) => { setValue('kind', value, { shouldValidate: formState.isSubmitted }); }}
        error={formState.errors.kind?.message}
      />
      <Textarea
        label="Votre remarque *"
        placeholder="La fenêtre de la chambre ne ferme pas complètement depuis l’entrée dans les lieux."
        rows={4}
        maxLength={BODY_MAX}
        {...register('body')}
        error={formState.errors.body?.message}
      />
      <Controller
        control={control}
        name="photos"
        render={({ field, fieldState }) => (
          <FileDrop
            title={`Joindre des photos (${String(MAX_PHOTOS)} au maximum)`}
            rules={PHOTO_RULES}
            multiple
            files={field.value}
            onFilesChange={(files) => { field.onChange(files); }}
            error={fieldState.error?.message}
          />
        )}
      />
      <div className="flex justify-end">
        <Button type="submit" loading={create.isPending}>
          <Icon icon={Send} />
          Envoyer la remarque
        </Button>
      </div>
    </form>
  );
}
