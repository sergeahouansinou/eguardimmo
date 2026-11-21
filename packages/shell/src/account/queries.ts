'use client';

import { ApiError } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDevices, fetchIdentity, fetchProfiles, fetchSecurity, revokeDevice } from './requests';

export const accountKeys = {
  all: ['api', 'account'] as const,
  identity: ['api', 'account', 'identity'] as const,
  profiles: ['api', 'account', 'profiles'] as const,
  security: ['api', 'account', 'security'] as const,
  devices: ['api', 'account', 'devices'] as const,
};

export function useAccountIdentity(client: ApiClient) {
  return useQuery({ queryKey: accountKeys.identity, queryFn: () => fetchIdentity(client) });
}

export function useAccountProfiles(client: ApiClient) {
  return useQuery({ queryKey: accountKeys.profiles, queryFn: () => fetchProfiles(client) });
}

export function useAccountSecurity(client: ApiClient) {
  return useQuery({ queryKey: accountKeys.security, queryFn: () => fetchSecurity(client) });
}

export function useAccountDevices(client: ApiClient) {
  return useQuery({ queryKey: accountKeys.devices, queryFn: () => fetchDevices(client) });
}

export function useRevokeDevice(client: ApiClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => revokeDevice(client, deviceId),
    onSettled: async (_data, error) => {
      if (error !== null && !(error instanceof ApiError && error.status === 404)) return;
      await queryClient.invalidateQueries({ queryKey: accountKeys.devices });
    },
  });
}
