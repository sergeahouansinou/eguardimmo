import { SegmentedControl, Select, Textarea } from "@eguardimmo/ui";
import type { SegmentedControlProps, SelectProps, TextareaProps } from "@eguardimmo/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Control, DefaultValues, FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import type { z } from "zod";
import { DemoServerError } from "@/features/shared/errors";
import { CheckCards, RadioCards } from "./OptionCards";
import type { CheckCardsProps, RadioCardsProps } from "./OptionCards";
import { SwitchRow } from "./SwitchRow";
import type { SwitchRowProps } from "./SwitchRow";

export function useSchemaForm<Input extends FieldValues, Output>(schema: z.ZodType<Output, Input>, defaultValues: DefaultValues<Input>) {
  return useForm<Input, undefined, Output>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
}

export function applyServerError<T extends FieldValues>(setError: UseFormSetError<T>, error: unknown): string | null {
  if (!(error instanceof DemoServerError)) return error instanceof Error ? error.message : null;
  const entries = Object.entries(error.fieldErrors);
  entries.forEach(([field, message]) => {
    setError(field as FieldPath<T>, { type: "server", message });
  });
  return entries.length === 0 ? error.message : null;
}

interface Bound<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function FormSelect<T extends FieldValues>({
  control,
  name,
  ...props
}: Bound<T> & Omit<SelectProps, "value" | "onValueChange" | "error">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select {...props} value={asString(field.value)} onValueChange={field.onChange} error={fieldState.error?.message} />
      )}
    />
  );
}

export function FormSwitch<T extends FieldValues>({
  control,
  name,
  ...props
}: Bound<T> & Omit<SwitchRowProps, "checked" | "onCheckedChange">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <SwitchRow {...props} checked={field.value === true} onCheckedChange={field.onChange} />}
    />
  );
}

export function FormRadioCards<T extends FieldValues>({
  control,
  name,
  ...props
}: Bound<T> & Omit<RadioCardsProps, "value" | "onValueChange" | "error">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <RadioCards {...props} value={asString(field.value)} onValueChange={field.onChange} error={fieldState.error?.message} />
      )}
    />
  );
}

export function FormSegmented<T extends FieldValues>({
  control,
  name,
  ...props
}: Bound<T> & Omit<SegmentedControlProps, "value" | "onValueChange">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <SegmentedControl {...props} value={asString(field.value)} onValueChange={field.onChange} />}
    />
  );
}

export function FormCheckCards<T extends FieldValues>({
  control,
  name,
  ...props
}: Bound<T> & Omit<CheckCardsProps, "values" | "onValuesChange" | "error">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value: unknown = field.value;
        const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
        return <CheckCards {...props} values={values} onValuesChange={field.onChange} error={fieldState.error?.message} />;
      }}
    />
  );
}

export function FormTextarea<T extends FieldValues>({
  control,
  name,
  ...props
}: Bound<T> & Omit<TextareaProps, "value" | "onChange" | "error" | "name">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Textarea
          {...props}
          name={field.name}
          onBlur={field.onBlur}
          value={asString(field.value)}
          onChange={field.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
