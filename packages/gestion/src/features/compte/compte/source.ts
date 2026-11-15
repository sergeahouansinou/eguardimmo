'use client';

import { createSourceContext, useScreenQuery, useSourceMutation } from '../../outils/kit';
import { demoInvoices, demoProfile, demoSubscription } from './demo';
import { limitsExceeded, planOf } from './plans';
import { changePlanSchema, invoicesSchema, profileFormSchema, profileSchema, subscriptionSchema } from './schemas';
import type { Billing, ChangePlanInput, Invoice, Profile, ProfileForm, Subscription } from './schemas';

export class PlanChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanChangeError';
  }
}

export interface CompteSource {
  getProfile: () => Promise<Profile>;
  saveProfile: (form: ProfileForm) => Promise<Profile>;
  getSubscription: () => Promise<Subscription>;
  changePlan: (input: ChangePlanInput) => Promise<Subscription>;
  changeBilling: (billing: Billing) => Promise<Subscription>;
  cancelSubscription: () => Promise<Subscription>;
  resumeSubscription: () => Promise<Subscription>;
  listInvoices: () => Promise<Invoice[]>;
}

export function createDemoCompteSource(): CompteSource {
  let profile = structuredClone(demoProfile);
  let subscription = structuredClone(demoSubscription);
  const invoices = structuredClone(demoInvoices);

  const update = (changes: Partial<Subscription>): Promise<Subscription> => {
    subscription = { ...subscription, ...changes };
    return Promise.resolve(structuredClone(subscription));
  };

  return {
    getProfile: () => Promise.resolve(structuredClone(profile)),
    saveProfile: (form) => {
      const parsed = profileFormSchema.safeParse(form);
      if (!parsed.success) return Promise.reject(new Error('Profil invalide'));
      profile = { ...profile, form: parsed.data };
      return Promise.resolve(structuredClone(profile));
    },
    getSubscription: () => Promise.resolve(structuredClone(subscription)),
    changePlan: (input) => {
      const parsed = changePlanSchema.parse(input);
      const problems = limitsExceeded(planOf(parsed.planId), subscription.usage);
      if (problems.length > 0) {
        return Promise.reject(new PlanChangeError(`Passage impossible : ${problems.join(', ')}.`));
      }
      return update({ planId: parsed.planId, billing: parsed.billing, cancelAt: null });
    },
    changeBilling: (billing) => update({ billing }),
    cancelSubscription: () => update({ cancelAt: subscription.nextChargeDate }),
    resumeSubscription: () => update({ cancelAt: null }),
    listInvoices: () => Promise.resolve(structuredClone(invoices)),
  };
}

const context = createSourceContext<CompteSource>(createDemoCompteSource);

export const CompteSourceProvider = context.Provider;
export const useCompteSource = context.useSource;
export const resetCompteDemo = context.resetDefault;

export const compteKeys = {
  profile: ['compte', 'profil'] as const,
  subscription: ['compte', 'abonnement'] as const,
  invoices: ['compte', 'factures'] as const,
};

export function useProfile() {
  const source = useCompteSource();
  return useScreenQuery(compteKeys.profile, () => source.getProfile(), profileSchema);
}
export function useSaveProfile() {
  const source = useCompteSource();
  return useSourceMutation((form: ProfileForm) => source.saveProfile(form), [compteKeys.profile]);
}

export function useSubscription() {
  const source = useCompteSource();
  return useScreenQuery(compteKeys.subscription, () => source.getSubscription(), subscriptionSchema);
}
export function useInvoices() {
  const source = useCompteSource();
  return useScreenQuery(compteKeys.invoices, () => source.listInvoices(), invoicesSchema);
}

export function useSubscriptionActions() {
  const source = useCompteSource();
  const keys = [compteKeys.subscription] as const;
  return {
    changePlan: useSourceMutation((input: ChangePlanInput) => source.changePlan(input), keys),
    changeBilling: useSourceMutation((billing: Billing) => source.changeBilling(billing), keys),
    cancel: useSourceMutation(() => source.cancelSubscription(), keys),
    resume: useSourceMutation(() => source.resumeSubscription(), keys),
  };
}
