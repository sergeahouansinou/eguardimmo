"use client";

import { shellKeys, useAfterHydration } from "@eguardimmo/shell";
import type { ClientQuery } from "@eguardimmo/shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfieSource } from "./source";
import type { ConfieSource } from "./source";
import type { DocumentInput, IbanInput, MandateEndInput, PreferencesInput, ProfileInput, QuoteDecisionInput } from "./inputs";
import { confieSchema } from "./schemas";
import type { ConfieData } from "./schemas";
import { ConfieError } from "./store";

export const confieKeys = {
  data: ["confie", "data"] as const,
};

export function useConfie(): ClientQuery<ConfieData> {
  const source = useConfieSource();
  return useAfterHydration(
    useQuery({
      queryKey: confieKeys.data,
      queryFn: async () => confieSchema.parse(await source.snapshot()),
    }),
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof ConfieError ? error.message : "L'opération a échoué, réessayez dans un instant.";
}

function useConfieMutation<TInput>(run: (source: ConfieSource, input: TInput) => Promise<void>) {
  const source = useConfieSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => run(source, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: confieKeys.data }),
        client.invalidateQueries({ queryKey: shellKeys.data }),
      ]);
    },
  });
}

export const useDecideQuote = () => useConfieMutation((source, input: QuoteDecisionInput) => source.decideQuote(input));
export const useRequestMandateEnd = () => useConfieMutation((source, input: MandateEndInput) => source.requestMandateEnd(input));
export const useCancelMandateEnd = () => useConfieMutation<undefined>((source) => source.cancelMandateEnd());
export const useUpdateProfile = () => useConfieMutation((source, input: ProfileInput) => source.updateProfile(input));
export const useRequestIbanChange = () => useConfieMutation((source, input: IbanInput) => source.requestIbanChange(input));
export const useAddDocument = () => useConfieMutation((source, input: DocumentInput) => source.addDocument(input));
export const useSavePreferences = () => useConfieMutation((source, input: PreferencesInput) => source.savePreferences(input));
export const useMarkReportViewed = () => useConfieMutation((source, reportId: string) => source.markReportViewed(reportId));
