"use client";

import { useAfterHydration } from "@eguardimmo/shell";
import type { ClientQuery } from "@eguardimmo/shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { useAgenceSource } from "./source";
import type { AgenceSource } from "./source";

export const AGENCE_KEY = "agence-lots" as const;

export function agenceKey(lot: string, ...parts: readonly unknown[]): readonly unknown[] {
  return [AGENCE_KEY, lot, ...parts];
}

export function useAgenceQuery<S extends z.ZodType>(
  key: readonly unknown[],
  schema: S,
  load: (source: AgenceSource) => Promise<unknown>,
): ClientQuery<z.output<S>> {
  const source = useAgenceSource();
  return useAfterHydration(
    useQuery({
      queryKey: key,
      queryFn: async (): Promise<z.output<S>> => schema.parse(await load(source)),
    }),
  );
}

export function useAgenceMutation<Input, Output = unknown>(run: (source: AgenceSource, input: Input) => Promise<Output>) {
  const source = useAgenceSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => run(source, input),
    onSuccess: () => client.invalidateQueries({ queryKey: [AGENCE_KEY] }),
  });
}
