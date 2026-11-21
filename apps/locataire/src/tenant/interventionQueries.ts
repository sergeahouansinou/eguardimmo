'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveBlob } from './download';
import {
  cancelIntervention,
  confirmVisit,
  fetchIntervention,
  fetchInterventionsPage,
  fetchPhoto,
  fetchReportOptions,
  postComment,
  reportIntervention,
  requestReschedule,
  uploadPhoto,
} from './interventionRequests';
import type { ReportInput, VisitSlot } from './interventionModel';
import { tenantKeys } from './keys';
import { useTenantSession } from './session';

export function useInterventions() {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.interventions,
    queryFn: ({ pageParam }) => fetchInterventionsPage(client, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useIntervention(id: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.intervention(id), queryFn: () => fetchIntervention(client, id) });
}

export function useReportOptions() {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.reportOptions, queryFn: () => fetchReportOptions(client), staleTime: 60_000 });
}

function useInterventionMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => queryClient.invalidateQueries({ queryKey: tenantKeys.interventions }),
  });
}

export interface PhotoFailure {
  name: string;
}

export interface ReportResult {
  id: string;
  failed: File[];
}

export function useReportIntervention() {
  const { client } = useTenantSession();
  return useInterventionMutation(async ({ input, photos, existingId }: { input: ReportInput; photos: File[]; existingId: string | null }): Promise<ReportResult> => {
    const id = existingId ?? (await reportIntervention(client, input)).id;
    const failed: File[] = [];
    for (const photo of photos) {
      try {
        await uploadPhoto(client, id, photo);
      } catch {
        failed.push(photo);
      }
    }
    return { id, failed };
  });
}

export function useAddPhotos() {
  const { client } = useTenantSession();
  return useInterventionMutation(async ({ id, photos }: { id: string; photos: File[] }): Promise<File[]> => {
    const failed: File[] = [];
    for (const photo of photos) {
      try {
        await uploadPhoto(client, id, photo);
      } catch {
        failed.push(photo);
      }
    }
    return failed;
  });
}

export const useComment = () => {
  const { client } = useTenantSession();
  return useInterventionMutation(({ id, text }: { id: string; text: string }) => postComment(client, id, text));
};

export const useCancelIntervention = () => {
  const { client } = useTenantSession();
  return useInterventionMutation((id: string) => cancelIntervention(client, id));
};

export const useConfirmVisit = () => {
  const { client } = useTenantSession();
  return useInterventionMutation(({ id, visitId }: { id: string; visitId: string }) => confirmVisit(client, id, visitId));
};

export const useRequestReschedule = () => {
  const { client } = useTenantSession();
  return useInterventionMutation(({ id, visitId, requestedOn, slot }: { id: string; visitId: string; requestedOn: string; slot: VisitSlot }) =>
    requestReschedule(client, id, visitId, { requestedOn, slot }),
  );
};

export function usePhotoDownload() {
  const { client } = useTenantSession();
  return useMutation({
    mutationFn: async ({ path, filename }: { path: string; filename: string }) => {
      saveBlob(await fetchPhoto(client, path), filename);
    },
  });
}
