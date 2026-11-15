import { settle } from "@/features/equipe/settle";
import { CURRENT_USER } from "@/features/shared/directory";
import { parseInput } from "@/features/equipe/zodErrors";
import type { Store } from "@/features/shared/store";
import { profileInputSchema } from "./profileSchemas";
import type { Profile } from "./profileSchemas";
import type { CompteSource } from "./source";

export const INITIAL_PROFILE: Profile = {
  civility: "mme",
  firstName: CURRENT_USER.firstName,
  lastName: CURRENT_USER.lastName,
  jobTitle: "Titulaire du cabinet",
  mobile: "+33 6 00 00 00 21",
  email: CURRENT_USER.email,
  language: "fr",
  timezone: "Europe/Paris",
  photoName: null,
  roleLabel: CURRENT_USER.role,
};

export function profileDemo(store: Store<Profile>): Pick<CompteSource, "profile" | "saveProfile" | "exportData"> {
  return {
    profile: () => settle(() => store.get()),
    saveProfile: (input) => settle(() => {
      const data = parseInput(profileInputSchema, input);
      return store.update((current) => ({ ...current, ...data }));
    }),
    exportData: () => settle(() => {
      const profile = store.get();
      return {
        filename: "mes-donnees-eguardimmo.csv",
        header: ["Rubrique", "Valeur"],
        rows: [
          ["Prénom", profile.firstName],
          ["Nom", profile.lastName],
          ["Fonction", profile.jobTitle],
          ["E-mail", profile.email],
          ["Mobile", profile.mobile],
          ["Rôle", profile.roleLabel],
          ["Fuseau horaire", profile.timezone],
        ],
      };
    }),
  };
}
