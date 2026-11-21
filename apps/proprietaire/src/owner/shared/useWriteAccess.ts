"use client";

import type { OwnerAccess } from "../model";
import { useOwnerSelection } from "../selection";

export interface WriteAccess {
  canWrite: boolean;
  inGrace: boolean;
  graceUntil: string | null;
}

export function writeAccessOf(accesses: readonly OwnerAccess[], agencyId: string): WriteAccess {
  const own = accesses.filter((access) => access.agencyId === agencyId);
  const graced = own.find((access) => access.inGrace);
  return {
    canWrite: own.some((access) => !access.readOnly),
    inGrace: own.length > 0 && own.every((access) => access.inGrace),
    graceUntil: graced?.accessUntil ?? null,
  };
}

export function useWriteAccess(agencyId: string): WriteAccess {
  return writeAccessOf(useOwnerSelection().accesses, agencyId);
}
