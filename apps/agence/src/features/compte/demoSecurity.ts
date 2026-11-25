import { settle } from "@/features/equipe/settle";
import { DemoServerError } from "@/features/shared/errors";
import { DEMO_NOW, DEMO_TODAY, daysBetween } from "@/features/shared/dates";
import { parseInput } from "@/features/equipe/zodErrors";
import type { EquipeDemo } from "@/features/equipe/source";
import type { Store } from "@/features/shared/store";
import { passwordChangeSchema, securityRulesInputSchema } from "./securitySchemas";
import type { Device, LoginEvent, SecurityOverview } from "./securitySchemas";
import type { CompteSource } from "./source";

export interface SecurityState {
  twoFactorRequired: boolean;
  minPasswordLength: 6 | 8 | 10 | 12 | 14 | 16;
  passwordChangedAt: string;
  passwordStrength: SecurityOverview["connection"]["passwordStrength"];
  devices: readonly Device[];
  log: readonly LoginEvent[];
}

export const INITIAL_SECURITY: SecurityState = {
  twoFactorRequired: true,
  minPasswordLength: 6,
  passwordChangedAt: "2026-09-02",
  passwordStrength: "Forte",
  devices: [
    { id: "macbook-chrome", label: "MacBook Pro · Chrome", lastSeen: DEMO_NOW, current: true },
    { id: "iphone-15", label: "iPhone 15 · Application mobile", lastSeen: "2026-11-12T18:03", current: false },
    { id: "ipad-safari", label: "iPad · Safari", lastSeen: "2026-11-05T08:40", current: false },
  ],
  log: [
    { id: "evt-1", at: "2026-11-13T08:12", device: "MacBook Pro · Chrome", outcome: "success", newDevice: false },
    { id: "evt-2", at: "2026-11-12T18:03", device: "iPhone 15 · Application mobile", outcome: "success", newDevice: false },
    { id: "evt-3", at: "2026-11-05T08:40", device: "iPad · Safari", outcome: "success", newDevice: false },
    { id: "evt-4", at: "2026-11-02T08:15", device: "iPhone 15 · Application mobile", outcome: "success", newDevice: true },
    { id: "evt-5", at: "2026-10-21T19:20", device: "MacBook Pro · Chrome", outcome: "success", newDevice: false },
    { id: "evt-6", at: "2026-09-28T22:11", device: "Appareil inconnu · Firefox", outcome: "failure", newDevice: false },
  ],
};

const LENGTHS = { "6": 6, "8": 8, "10": 10, "12": 12, "14": 14, "16": 16 } as const;

function strengthOf(password: string): SecurityState["passwordStrength"] {
  if (password.length >= 14) return "Forte";
  if (password.length >= 10) return "Correcte";
  return "Faible";
}

function latest(log: readonly LoginEvent[], keep: (event: LoginEvent) => boolean): string | null {
  return log.filter(keep).map((event) => event.at).sort().at(-1) ?? null;
}

export function securityDemo(store: Store<SecurityState>, equipe: EquipeDemo): Pick<CompteSource, "security" | "saveSecurityRules" | "changePassword" | "signOutDevice"> {
  return {
    security: (): Promise<SecurityOverview> => settle(() => {
      const state = store.get();
      const team = equipe.stats();
      return {
        rules: { twoFactorRequired: state.twoFactorRequired, minPasswordLength: state.minPasswordLength },
        team: { covered: team.twoFactorCovered, total: team.twoFactorTotal, withoutTwoFactor: [...team.withoutTwoFactor] },
        connection: {
          passwordChangedAt: state.passwordChangedAt,
          passwordStrength: state.passwordStrength,
          twoFactorMethod: "Application d'authentification",
          backupCodes: 8,
          devices: [...state.devices],
          log: [...state.log].sort((a, b) => b.at.localeCompare(a.at)),
          lastLoginAt: latest(state.log, (event) => event.outcome === "success"),
          failuresLast30Days: state.log.filter((event) => event.outcome === "failure" && daysBetween(event.at, DEMO_TODAY) <= 30).length,
          lastNewDeviceAt: latest(state.log, (event) => event.newDevice),
        },
      };
    }),

    saveSecurityRules: (input) => settle(() => {
      const data = parseInput(securityRulesInputSchema, input);
      const minPasswordLength = LENGTHS[data.minPasswordLength];
      store.update((state) => ({ ...state, twoFactorRequired: data.twoFactorRequired, minPasswordLength }));
      return { ok: true };
    }),

    changePassword: (input) => settle(() => {
      const { minPasswordLength } = store.get();
      const data = parseInput(passwordChangeSchema(minPasswordLength), input);
      store.update((state) => ({ ...state, passwordChangedAt: DEMO_TODAY, passwordStrength: strengthOf(data.newPassword) }));
      return { ok: true };
    }),

    signOutDevice: (deviceId) => settle(() => {
      const device = store.get().devices.find((candidate) => candidate.id === deviceId);
      if (!device) throw new DemoServerError("not_found", "Cet appareil n'est plus connecté.");
      if (device.current) throw new DemoServerError("forbidden", "La session en cours ne peut pas être déconnectée ici.");
      store.update((state) => ({ ...state, devices: state.devices.filter((candidate) => candidate.id !== deviceId) }));
      return { id: deviceId };
    }),
  };
}
