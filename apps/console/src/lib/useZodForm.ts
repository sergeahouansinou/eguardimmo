'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

export function useZodForm<Input extends FieldValues, Output extends FieldValues>(
  schema: z.ZodType<Output, Input>,
  defaultValues: DefaultValues<Input>,
): UseFormReturn<Input, unknown, Output> {
  return useForm<Input, unknown, Output>({ resolver: zodResolver(schema), defaultValues });
}
