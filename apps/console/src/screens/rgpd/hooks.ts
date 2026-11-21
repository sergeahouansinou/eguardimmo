'use client';

import { usePlatformMutation, usePlatformQuery } from '@/platform/context';
import type { PlatformQuery } from '@/platform/context';
import type { ExtensionReason, IdentityMethod, PrivacyPage, PrivacyQuery, PrivacyRequest, RecordRequestInput, RefusalReason } from '@/platform/privacy/privacy';

export const usePrivacyRequests = (query: PrivacyQuery): PlatformQuery<PrivacyPage> =>
  usePlatformQuery(['privacy', 'list', query], (api) => api.privacy.list(query), { keepPrevious: true });

export const usePrivacyRequest = (id: string): PlatformQuery<PrivacyRequest> => usePlatformQuery(['privacy', 'detail', id], (api) => api.privacy.get(id));

export const useRecordRequest = () => usePlatformMutation((api, input: RecordRequestInput) => api.privacy.record(input));

export const useVerifyIdentity = (id: string) => usePlatformMutation((api, method: IdentityMethod) => api.privacy.verify(id, method));

export const useExtendDeadline = (id: string) => usePlatformMutation((api, reason: ExtensionReason) => api.privacy.extend(id, reason));

export const useForwardRequest = (id: string) => usePlatformMutation((api) => api.privacy.forward(id));

export const useCompleteRequest = (id: string) => usePlatformMutation((api) => api.privacy.complete(id));

export const useRefuseRequest = (id: string) => usePlatformMutation((api, reason: RefusalReason) => api.privacy.refuse(id, reason));
