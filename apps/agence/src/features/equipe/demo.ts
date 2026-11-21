import { settle } from "./settle";
import { DEMO_NOW } from "@/features/shared/dates";
import { CURRENT_USER } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import { createStore, nextId, slugify } from "@/features/shared/store";
import { INITIAL_MEMBERS } from "./fixtures";
import type { MemberRecord } from "./fixtures";
import { memberIdSchema, inviteInputSchema, updateMemberInputSchema } from "./schemas";
import type { EquipeOverview, Member, TeamStats } from "./schemas";
import type { EquipeDemo, SeatPlan } from "./source";
import { parseInput } from "./zodErrors";

interface State {
  members: readonly MemberRecord[];
  plan: SeatPlan;
}

function portfolioLabel(record: MemberRecord): string {
  if (record.portfolioMode === "all") return "Tous les mandants";
  return `${String(record.mandantIds.length)} mandant${record.mandantIds.length > 1 ? "s" : ""}`;
}

function toMember(record: MemberRecord): Member {
  return {
    ...record,
    mandantIds: [...record.mandantIds],
    portfolioLabel: portfolioLabel(record),
    isCurrentUser: record.id === CURRENT_USER.id,
  };
}

function countSeats(members: readonly MemberRecord[]) {
  const active = members.filter((member) => member.status === "active").length;
  const pending = members.filter((member) => member.status === "invited").length;
  return { active, pending, used: active + pending };
}

function notFound(): DemoServerError {
  return new DemoServerError("not_found", "Ce collaborateur n'existe plus.");
}

function findMember(state: State, id: string): MemberRecord {
  const member = state.members.find((candidate) => candidate.id === id);
  if (!member) throw notFound();
  return member;
}

function ensureSeat(state: State): void {
  const { used } = countSeats(state.members);
  if (state.plan.seats !== null && used >= state.plan.seats) {
    throw new DemoServerError(
      "seat_limit",
      `La formule ${state.plan.name} est complète (${String(used)} collaborateurs sur ${String(state.plan.seats)}). Passez à une formule supérieure ou libérez une place.`,
    );
  }
}

function applyPortfolio(role: MemberRecord["role"], mode: MemberRecord["portfolioMode"], ids: readonly string[]) {
  if (role !== "gestionnaire") return { portfolioMode: "all" as const, mandantIds: [] };
  return { portfolioMode: mode, mandantIds: mode === "chosen" ? [...new Set(ids)] : [] };
}

export function createEquipeDemo(): EquipeDemo {
  const store = createStore<State>({ members: INITIAL_MEMBERS, plan: { name: "Gratuit", seats: null } });

  const replace = (id: string, change: (member: MemberRecord) => MemberRecord) => {
    store.update((state) => ({ ...state, members: state.members.map((member) => (member.id === id ? change(member) : member)) }));
  };

  return {
    overview: (): Promise<EquipeOverview> => settle(() => {
      const { members, plan } = store.get();
      return {
        members: members.map(toMember),
        seats: { planName: plan.name, limit: plan.seats, ...countSeats(members) },
      };
    }),

    invite: (input) => settle(() => {
      const data = parseInput(inviteInputSchema, input);
      const state = store.get();
      const taken = state.members.some((member) => member.email.toLowerCase() === data.email.toLowerCase());
      if (taken) {
        throw new DemoServerError("duplicate_email", "Cette adresse e-mail appartient déjà à l'équipe.", {
          email: "Cette adresse e-mail appartient déjà à l'équipe.",
        });
      }
      ensureSeat(state);
      const ids = state.members.map((member) => member.id);
      const base = slugify(`${data.firstName} ${data.lastName}`);
      const uniqueId = ids.includes(base) ? nextId(base, ids) : base;
      const record: MemberRecord = {
        id: uniqueId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
        ...applyPortfolio(data.role, data.portfolioMode, data.mandantIds),
        twoFactor: "at_acceptance",
        status: "invited",
        lastLogin: null,
        online: false,
        invitedAt: DEMO_NOW,
      };
      store.update((current) => ({ ...current, members: [...current.members, record] }));
      return { id: record.id, email: record.email };
    }),

    updateMember: (input) => settle(() => {
      const data = parseInput(updateMemberInputSchema, input);
      const member = findMember(store.get(), data.id);
      if (member.role === "titulaire") throw new DemoServerError("forbidden", "Le rôle du titulaire ne peut pas être modifié.");
      replace(member.id, (current) => ({ ...current, role: data.role, ...applyPortfolio(data.role, data.portfolioMode, data.mandantIds) }));
      return { id: member.id };
    }),

    deactivate: (memberId) => settle(() => {
      const member = findMember(store.get(), parseInput(memberIdSchema, memberId));
      if (member.role === "titulaire") throw new DemoServerError("forbidden", "Le titulaire ne peut pas être désactivé.");
      if (member.status !== "active") throw new DemoServerError("invalid_state", "Seul un collaborateur actif peut être désactivé.");
      replace(member.id, (current) => ({ ...current, status: "inactive", online: false }));
      return { id: member.id };
    }),

    reactivate: (memberId) => settle(() => {
      const state = store.get();
      const member = findMember(state, parseInput(memberIdSchema, memberId));
      if (member.status !== "inactive") throw new DemoServerError("invalid_state", "Ce collaborateur n'est pas désactivé.");
      ensureSeat(state);
      replace(member.id, (current) => ({ ...current, status: "active" }));
      return { id: member.id };
    }),

    cancelInvitation: (memberId) => settle(() => {
      const member = findMember(store.get(), parseInput(memberIdSchema, memberId));
      if (member.status !== "invited") throw new DemoServerError("invalid_state", "Aucune invitation en attente pour ce collaborateur.");
      store.update((state) => ({ ...state, members: state.members.filter((candidate) => candidate.id !== member.id) }));
      return { id: member.id };
    }),

    resendInvitation: (memberId) => settle(() => {
      const member = findMember(store.get(), parseInput(memberIdSchema, memberId));
      if (member.status !== "invited") throw new DemoServerError("invalid_state", "Aucune invitation en attente pour ce collaborateur.");
      replace(member.id, (current) => ({ ...current, invitedAt: DEMO_NOW }));
      return { id: member.id, email: member.email };
    }),

    stats: (): TeamStats => {
      const { members } = store.get();
      const counted = members.filter((member) => member.status !== "inactive");
      const covered = counted.filter((member) => member.twoFactor !== "disabled");
      const seats = countSeats(members);
      return {
        activeCount: seats.active,
        pendingCount: seats.pending,
        twoFactorCovered: covered.length,
        twoFactorTotal: counted.length,
        withoutTwoFactor: counted
          .filter((member) => member.status === "active" && member.twoFactor === "disabled")
          .map((member) => `${member.firstName} ${member.lastName}`),
      };
    },

    activeMemberCount: () => countSeats(store.get().members).active,

    setSeatPlan: (plan) => {
      store.update((state) => ({ ...state, plan }));
    },
  };
}
