import type { EquipeDemo } from "@/features/equipe/source";
import { createStore } from "@/features/shared/store";
import { INITIAL_PREFS, notificationsDemo } from "./demoNotifications";
import { INITIAL_PROFILE, profileDemo } from "./demoProfile";
import { INITIAL_SECURITY, securityDemo } from "./demoSecurity";
import { INITIAL_SUBSCRIPTION, subscriptionDemo } from "./demoSubscription";
import type { CompteSource } from "./source";

export function createCompteDemo({ equipe }: { equipe: EquipeDemo }): CompteSource {
  const profile = createStore(INITIAL_PROFILE);
  return {
    ...profileDemo(profile),
    ...securityDemo(createStore(INITIAL_SECURITY), equipe),
    ...notificationsDemo(createStore(INITIAL_PREFS), () => profile.get().email),
    ...subscriptionDemo(createStore(INITIAL_SUBSCRIPTION), equipe),
  };
}
