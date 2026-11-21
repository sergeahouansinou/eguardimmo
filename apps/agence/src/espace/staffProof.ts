import type { ApiClient } from "@eguardimmo/api";
import { createConfirmProof, useTwoFactorProof } from "@eguardimmo/gestion";
import type { StaffProof } from "@eguardimmo/messagerie";

export function createStaffProofHook(client: ApiClient): () => StaffProof {
  const confirm = createConfirmProof(client);
  function useStaffProof(): StaffProof {
    return useTwoFactorProof(confirm);
  }
  return useStaffProof;
}
