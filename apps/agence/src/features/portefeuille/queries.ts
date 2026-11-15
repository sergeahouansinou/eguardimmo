"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAfterHydration } from "@eguardimmo/shell";
import type { ClientQuery } from "@eguardimmo/shell";
import { indexPortefeuille } from "./selectors";
import type { Portefeuille } from "./selectors";
import { parsePortefeuille, usePortefeuilleSource } from "./source";
import type { NewBail, NewMandant, NewMandat, PatchKind } from "./source";
import type { Termination } from "./schemas";

export const portefeuilleKeys = {
  all: ["agence", "portefeuille"] as const,
};

export function usePortefeuille(): ClientQuery<Portefeuille> {
  const source = usePortefeuilleSource();
  return useAfterHydration(
    useQuery({
      queryKey: portefeuilleKeys.all,
      queryFn: async () => indexPortefeuille(parsePortefeuille(await source.load())),
    }),
  );
}

function useInvalidating<TInput, TResult>(run: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: portefeuilleKeys.all }),
  });
}

export function useCreateMandant() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: NewMandant) => source.createMandant(input));
}

export function useCreateMandat() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: NewMandat) => source.createMandat(input));
}

export function useRenewMandat() {
  const source = usePortefeuilleSource();
  return useInvalidating((id: string) => source.renewMandat(id));
}

export function useTerminateMandat() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: { id: string; termination: Termination }) => source.terminateMandat(input.id, input.termination));
}

export function useCreateBail() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: NewBail) => source.createBail(input));
}

export function usePatchEntity() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: { kind: PatchKind; id: string; patch: Record<string, unknown> }) =>
    source.patch(input.kind, input.id, input.patch),
  );
}
