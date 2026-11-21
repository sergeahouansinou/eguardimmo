"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useAfterHydration } from "@eguardimmo/shell";
import type { ClientQuery } from "@eguardimmo/shell";
import { indexPortefeuille } from "./selectors";
import type { Portefeuille } from "./selectors";
import { mandatSchema } from "./schemas";
import type { Mandat, Termination } from "./schemas";
import { PortefeuilleError, parsePortefeuille, usePortefeuilleSource } from "./source";
import type { MandatDocument, ShareableKind } from "./api/apiDocuments";
import type { TermDefaults, TermDefaultsInput } from "./api/apiDefaults";
import type { MandatEndRequest, MandatFormOptions, MandatOperations, NewAvenant, NewBail, NewBien, NewInvitation, NewMandant, NewMandat, PatchKind, SendAvisInput } from "./source";

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

export interface MandatDetailQuery {
  data: Mandat | undefined;
  isPending: boolean;
  isError: boolean;
}

export function useMandatDetail(id: string): MandatDetailQuery {
  const source = usePortefeuilleSource();
  const load = source.mandatDetail;
  const query = useQuery({
    queryKey: [...portefeuilleKeys.all, "mandat", id],
    queryFn: async () => (load ? mandatSchema.parse(await load(id)) : undefined),
    enabled: load !== undefined && id !== "",
  });
  return { data: query.data, isPending: load !== undefined && id !== "" && query.isPending, isError: query.isError };
}

export type EndRequestState = { kind: "disabled" } | { kind: "loading" } | { kind: "unverifiable"; retry: () => void } | { kind: "absent" } | { kind: "request"; request: MandatEndRequest };

const endRequestKey = (id: string) => [...portefeuilleKeys.all, "end-request", id] as const;

export function useMandatEndRequest(id: string): EndRequestState {
  const source = usePortefeuilleSource();
  const load = source.mandatEndRequest;
  const query = useQuery({
    queryKey: endRequestKey(id),
    queryFn: () => (load ? load(id) : Promise.resolve(null)),
    enabled: load !== undefined && id !== "",
    retry: false,
  });
  if (load === undefined) return { kind: "disabled" };
  if (query.isError) return { kind: "unverifiable", retry: () => { void query.refetch(); } };
  if (query.data === undefined) return { kind: "loading" };
  return query.data === null ? { kind: "absent" } : { kind: "request", request: query.data };
}

export function useDismissEndRequest(id: string) {
  const source = usePortefeuilleSource();
  const client = useQueryClient();
  const key = endRequestKey(id);
  return useMutation({
    mutationFn: (note: string | null) => {
      if (!source.dismissEndRequest) return Promise.reject(new PortefeuilleError("Cette action n’est pas disponible.", undefined, "unavailable"));
      return source.dismissEndRequest(id, note);
    },
    onSuccess: (request) => {
      client.setQueryData(key, request);
      return client.invalidateQueries({ queryKey: portefeuilleKeys.all, predicate: (query) => query.queryKey.join("|") !== key.join("|") });
    },
    onError: () => client.invalidateQueries({ queryKey: portefeuilleKeys.all }),
  });
}

export function useMandatFormOptions(): { data: MandatFormOptions | undefined; isPending: boolean; isError: boolean } {
  const source = usePortefeuilleSource();
  const load = source.formOptions;
  const query = useQuery({
    queryKey: [...portefeuilleKeys.all, "form-options"],
    queryFn: () => (load ? load() : Promise.resolve(undefined)),
    enabled: load !== undefined,
  });
  return { data: query.data, isPending: load !== undefined && query.isPending, isError: query.isError };
}

export function usePortefeuilleAccess(): { canWrite: boolean } {
  return { canWrite: usePortefeuilleSource().canWrite };
}

export function useReloadPortefeuille(): () => Promise<void> {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: portefeuilleKeys.all });
}

export function useMandatOperations(): MandatOperations | undefined {
  const source = usePortefeuilleSource();
  return source.canWrite ? source.operations : undefined;
}

export function useMandatAction() {
  const source = usePortefeuilleSource();
  return useInvalidating(async (run: (operations: MandatOperations) => Promise<void>) => {
    if (!source.operations) throw new PortefeuilleError("Cette action n’est pas disponible.", undefined, "unavailable");
    await run(source.operations);
  });
}

function useInvalidating<TInput, TResult>(run: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: portefeuilleKeys.all }),
    onError: (error) => (error instanceof PortefeuilleError && error.kind === "stale_version" ? client.invalidateQueries({ queryKey: portefeuilleKeys.all }) : undefined),
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

export function useCreateBien() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: NewBien) => source.createBien(input));
}

export function useCreateAvenant() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: NewAvenant) => source.createAvenant(input));
}

export function useCreateInvitation() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: NewInvitation) => source.createInvitation(input));
}

export function useResendInvitation() {
  const source = usePortefeuilleSource();
  return useInvalidating((id: string) => source.resendInvitation(id));
}

export function useCancelInvitation() {
  const source = usePortefeuilleSource();
  return useInvalidating((id: string) => source.cancelInvitation(id));
}

export function useSendAvis() {
  const source = usePortefeuilleSource();
  return useInvalidating((input: SendAvisInput) => source.sendAvis(input));
}

export type TermDefaultsState = { kind: "disabled" } | { kind: "loading" } | { kind: "unverifiable"; retry: () => void } | { kind: "ready"; defaults: TermDefaults | null; canSave: boolean; reload: () => Promise<void> };

export function useTermDefaults(): TermDefaultsState {
  const operations = usePortefeuilleSource().termDefaults;
  const query = useQuery({
    queryKey: [...portefeuilleKeys.all, "term-defaults"],
    queryFn: () => (operations ? operations.load() : Promise.resolve(null)),
    enabled: operations !== undefined,
    retry: false,
  });
  if (operations === undefined) return { kind: "disabled" };
  if (query.isError) return { kind: "unverifiable", retry: () => { void query.refetch(); } };
  if (query.data === undefined) return { kind: "loading" };
  return { kind: "ready", defaults: query.data, canSave: operations.canSave, reload: async () => {
      await query.refetch();
    } };
}

export function useSaveTermDefaults() {
  const operations = usePortefeuilleSource().termDefaults;
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { lockVersion: number | null; values: TermDefaultsInput }) => {
      if (!operations) throw new PortefeuilleError("Cette action n’est pas disponible.", undefined, "unavailable");
      return operations.save(input.lockVersion, input.values);
    },
    onSuccess: (saved) => client.setQueryData([...portefeuilleKeys.all, "term-defaults"], saved),
  });
}

const documentsKey = (mandatId: string) => [...portefeuilleKeys.all, "documents", mandatId] as const;

export function useMandatDocuments(mandatId: string): { data: MandatDocument[] | undefined; isPending: boolean; isError: boolean; refetch: () => void; enabled: boolean } {
  const operations = usePortefeuilleSource().documents;
  const query = useQuery({
    queryKey: documentsKey(mandatId),
    queryFn: () => (operations ? operations.list(mandatId) : Promise.resolve([])),
    enabled: operations !== undefined && mandatId !== "",
    retry: false,
  });
  return { data: query.data, isPending: operations !== undefined && query.isPending, isError: query.isError, refetch: () => { void query.refetch(); }, enabled: operations !== undefined };
}

export function useMandatDocumentActions(mandatId: string) {
  const operations = usePortefeuilleSource().documents;
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: documentsKey(mandatId) });
  const need = (): NonNullable<typeof operations> => {
    if (!operations) throw new PortefeuilleError("Cette action n’est pas disponible.", undefined, "unavailable");
    return operations;
  };
  return {
    upload: useMutation({ mutationFn: (file: File) => need().upload(mandatId, file) }),
    share: useMutation({ mutationFn: (input: { storedFileId: string; kind: ShareableKind }) => need().share(mandatId, input.storedFileId, input.kind), onSuccess: refresh }),
    unshare: useMutation({ mutationFn: (documentId: string) => need().unshare(mandatId, documentId), onSuccess: refresh }),
  };
}

export function useMandatFileUpload(): (mandatId: string, file: File) => Promise<string> {
  const operations = usePortefeuilleSource().documents;
  const cache = useRef<{ mandatId: string; file: File; id: string } | null>(null);
  return async (mandatId, file) => {
    const cached = cache.current;
    if (cached?.mandatId === mandatId && cached.file === file) return cached.id;
    if (!operations) throw new PortefeuilleError("Cette action n’est pas disponible.", undefined, "unavailable");
    const id = await operations.upload(mandatId, file);
    cache.current = { mandatId, file, id };
    return id;
  };
}
