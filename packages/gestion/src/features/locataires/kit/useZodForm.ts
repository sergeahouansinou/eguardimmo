'use client';

import { useState } from 'react';
import type { z } from 'zod';

export interface ZodForm<T extends Record<string, unknown>, O> {
  values: T;
  setValue: <K extends keyof T>(name: K, value: T[K]) => void;
  touch: (name: keyof T) => void;
  error: (name: keyof T) => string | undefined;
  submit: () => O | null;
  reset: (values: T) => void;
}

export function useZodForm<T extends Record<string, unknown>, O>(schema: z.ZodType<O, T>, initial: T): ZodForm<T, O> {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<ReadonlySet<keyof T>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const parsed = schema.safeParse(values);
  const messages = new Map<string, string>();
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !messages.has(field)) messages.set(field, issue.message);
    }
  }

  return {
    values,
    setValue: (name, value) => { setValues((current) => ({ ...current, [name]: value })); },
    touch: (name) => { setTouched((current) => new Set(current).add(name)); },
    error: (name) => {
      if (typeof name !== 'string') return undefined;
      return submitted || touched.has(name) ? messages.get(name) : undefined;
    },
    submit: () => {
      setSubmitted(true);
      return parsed.success ? parsed.data : null;
    },
    reset: (next) => {
      setValues(next);
      setTouched(new Set());
      setSubmitted(false);
    },
  };
}
