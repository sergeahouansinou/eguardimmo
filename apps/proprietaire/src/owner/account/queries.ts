"use client";

import { accountKeys } from "@eguardimmo/shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOwnerSession } from "../session";
import { cancelEmailChange, confirmEmailChange, fetchProfile, requestEmailChange, updateName, updatePhone } from "./requests";

const PROFILE_KEY = ["owner", "account", "profile"] as const;

export function useProfile() {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => fetchProfile(client) });
}

function useRefreshProfile() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: PROFILE_KEY }), queryClient.invalidateQueries({ queryKey: accountKeys.identity }), queryClient.invalidateQueries({ queryKey: accountKeys.security })]);
}

export function useUpdateName() {
  const { client } = useOwnerSession();
  const refresh = useRefreshProfile();
  return useMutation({ mutationFn: (name: string) => updateName(client, name), onSuccess: refresh });
}

export function useUpdatePhone() {
  const { client } = useOwnerSession();
  const refresh = useRefreshProfile();
  return useMutation({ mutationFn: (phone: string | null) => updatePhone(client, phone), onSuccess: refresh });
}

export function useRequestEmailChange() {
  const { client } = useOwnerSession();
  return useMutation({ mutationFn: (email: string) => requestEmailChange(client, email) });
}

export function useCancelEmailChange() {
  const { client } = useOwnerSession();
  return useMutation({ mutationFn: () => cancelEmailChange(client) });
}

export function useConfirmEmailChange() {
  const { client } = useOwnerSession();
  const refresh = useRefreshProfile();
  return useMutation({ mutationFn: (code: string) => confirmEmailChange(client, code), onSuccess: refresh });
}
