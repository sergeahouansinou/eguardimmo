import { checkFileOrThrow, parseOrThrow, respond, sanitizeFileName } from "@/features/kit/serverValidation";
import { IMAGE_RULES } from "@/features/shared/files";
import { createStore } from "@/features/shared/store";
import { initialFinances, initialIdentity } from "./fixtures";
import { maskIban, normalizeIban } from "./logic";
import { accountFormSchema, financesInputSchema, identityInputSchema } from "./schemas";
import type { ReglagesSource } from "./source";

export function createReglagesDemo(): ReglagesSource {
  const identity = createStore(initialIdentity());
  const finances = createStore(initialFinances());

  return {
    identity: () => Promise.resolve(identity.get()),

    saveIdentity: (input) =>
      respond(() => {
        const { logo, signature, siren, ...rest } = parseOrThrow(identityInputSchema, input);
        if (logo) checkFileOrThrow(logo, IMAGE_RULES, "logo");
        if (signature) checkFileOrThrow(signature, IMAGE_RULES, "signature");
        return identity.update((current) => ({
          ...current,
          ...rest,
          siren: siren.replace(/\s/g, ""),
          logoName: logo ? sanitizeFileName(logo.name) : current.logoName,
          signatureName: signature ? sanitizeFileName(signature.name) : current.signatureName,
        }));
      }),

    finances: () => Promise.resolve(finances.get()),

    saveFinances: (input) =>
      respond(() => {
        const value = parseOrThrow(financesInputSchema, input);
        return finances.update((current) => ({ ...current, ...value }));
      }),

    updateAccount: (input) =>
      respond(() => {
        const value = parseOrThrow(accountFormSchema, input);
        const { masked, last4 } = maskIban(normalizeIban(value.iban));
        return finances.update((current) => ({
          ...current,
          account: { ibanMasked: masked, last4, bank: value.bank, holder: value.holder, reconciledOn: null },
        }));
      }),
  };
}
