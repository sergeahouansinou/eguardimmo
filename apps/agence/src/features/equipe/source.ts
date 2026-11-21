import type { TeamStats } from "./schemas";

export interface SeatPlan {
  name: string;
  seats: number | null;
}

export interface EquipeSource {
  overview: () => Promise<unknown>;
  invite: (input: unknown) => Promise<unknown>;
  updateMember: (input: unknown) => Promise<unknown>;
  deactivate: (memberId: string) => Promise<unknown>;
  reactivate: (memberId: string) => Promise<unknown>;
  cancelInvitation: (memberId: string) => Promise<unknown>;
  resendInvitation: (memberId: string) => Promise<unknown>;
}

export interface EquipeDemo extends EquipeSource {
  stats: () => TeamStats;
  activeMemberCount: () => number;
  setSeatPlan: (plan: SeatPlan) => void;
}
