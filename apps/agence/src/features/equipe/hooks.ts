import { agenceKey, useAgenceMutation, useAgenceQuery } from "@/features/query";
import { equipeOverviewSchema } from "./schemas";
import type { InviteInput, UpdateMemberInput } from "./schemas";

export function useEquipe() {
  return useAgenceQuery(agenceKey("equipe", "overview"), equipeOverviewSchema, (source) => source.equipe.overview());
}

export function useInviteMember() {
  return useAgenceMutation((source, input: InviteInput) => source.equipe.invite(input));
}

export function useUpdateMember() {
  return useAgenceMutation((source, input: UpdateMemberInput) => source.equipe.updateMember(input));
}

export function useDeactivateMember() {
  return useAgenceMutation((source, memberId: string) => source.equipe.deactivate(memberId));
}

export function useReactivateMember() {
  return useAgenceMutation((source, memberId: string) => source.equipe.reactivate(memberId));
}

export function useCancelInvitation() {
  return useAgenceMutation((source, memberId: string) => source.equipe.cancelInvitation(memberId));
}

export function useResendInvitation() {
  return useAgenceMutation((source, memberId: string) => source.equipe.resendInvitation(memberId));
}
