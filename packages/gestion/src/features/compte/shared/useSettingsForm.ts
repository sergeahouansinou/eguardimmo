'use client';

import { useState } from 'react';
import type { z } from 'zod';
import { pushFlash } from '../../outils/kit';

export interface SettingsForm<T> {
  value: T | undefined;
  update: (patch: Partial<T>) => void;
  reset: () => void;
  submit: () => void;
  saving: boolean;
  failed: boolean;
  errors: Record<string, string>;
  dirty: boolean;
}

export interface SettingsFormOptions<T> {
  saved: T | undefined;
  schema: z.ZodType<T>;
  save: (value: T) => Promise<unknown>;
  success: string;
}

export function useSettingsForm<T extends object>({ saved, schema, save, success }: SettingsFormOptions<T>): SettingsForm<T> {
  const [edits, setEdits] = useState<T | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const value = edits ?? saved;

  const submit = () => {
    if (!value) return;
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join('.');
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFailed(false);
    setSaving(true);
    void save(parsed.data)
      .then(() => {
        setEdits(null);
        pushFlash(success);
      })
      .catch(() => {
        setFailed(true);
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return {
    value,
    update: (patch) => {
      const base = edits ?? saved;
      if (!base) return;
      setEdits({ ...base, ...patch });
      setErrors({});
    },
    reset: () => {
      setEdits(null);
      setErrors({});
      setFailed(false);
    },
    submit,
    saving,
    failed,
    errors,
    dirty: edits !== null,
  };
}
