'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, SubmitEvent } from 'react';
import type { z } from 'zod';

type StringKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T] & string;

export interface FieldProps {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error: string | undefined;
}

export interface ZodForm<S extends z.ZodType<unknown, object>> {
  values: z.input<S>;
  set: <K extends keyof z.input<S>>(key: K, value: z.input<S>[K]) => void;
  field: (key: StringKeys<z.input<S>>) => FieldProps;
  error: (key: keyof z.input<S> & string) => string | undefined;
  reset: (next: z.input<S>) => void;
  hasErrors: boolean;
  submit: (onValid: (data: z.output<S>, submitter: HTMLElement | null) => void) => (event: SubmitEvent<HTMLFormElement>) => void;
}

export function useZodForm<S extends z.ZodType<unknown, object>>(schema: S, initial: z.input<S>): ZodForm<S> {
  const [values, setValues] = useState<z.input<S>>(initial);
  const [attempted, setAttempted] = useState(false);

  const result = useMemo(() => schema.safeParse(values), [schema, values]);
  const errors = useMemo(() => {
    const map = new Map<string, string>();
    if (!attempted || result.success) return map;
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (!map.has(key)) map.set(key, issue.message);
    }
    return map;
  }, [attempted, result]);

  const assign = (key: string, value: unknown) => {
    setValues((current) => Object.assign({}, current, { [key]: value }));
  };

  return {
    values,
    set: (key, value) => {
      assign(String(key), value);
    },
    field: (key) => {
      const current: unknown = values[key];
      return {
        value: typeof current === 'string' ? current : '',
        onChange: (event) => {
          assign(key, event.target.value);
        },
        error: errors.get(key),
      };
    },
    error: (key) => errors.get(key),
    reset: (next) => {
      setValues(next);
      setAttempted(false);
    },
    hasErrors: errors.size > 0,
    submit: (onValid) => (event) => {
      event.preventDefault();
      setAttempted(true);
      if (result.success) onValid(result.data, event.nativeEvent.submitter);
    },
  };
}
