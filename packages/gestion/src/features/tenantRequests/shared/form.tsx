'use client';

import { Select } from '@eguardimmo/ui';
import type { SelectProps } from '@eguardimmo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { Control, DefaultValues, FieldPath, FieldValues } from 'react-hook-form';
import type { z } from 'zod';

export function useTenantRequestsForm<Input extends FieldValues, Output>(schema: z.ZodType<Output, Input>, defaultValues: DefaultValues<Input>) {
  return useForm<Input, undefined, Output>({ resolver: zodResolver(schema), defaultValues, mode: 'onSubmit', reValidateMode: 'onChange' });
}

export function FormSelect<T extends FieldValues, Output>({ control, name, ...props }: { control: Control<T, undefined, Output>; name: FieldPath<T> } & Omit<SelectProps, 'value' | 'onValueChange' | 'error'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select {...props} value={typeof field.value === 'string' ? field.value : ''} onValueChange={field.onChange} error={fieldState.error?.message} />
      )}
    />
  );
}
