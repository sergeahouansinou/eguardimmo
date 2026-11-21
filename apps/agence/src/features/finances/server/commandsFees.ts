import { DEMO_TODAY } from "@/features/shared/dates";
import { DemoServerError } from "@/features/shared/errors";
import type { Store } from "@/features/shared/store";
import { baremeInputSchema } from "../inputs";
import type { BaremeInput } from "../inputs";
import type { FeeScheme, FinancesState } from "./model";
import { parseInput } from "./parse";
import { mandantOfMandate } from "./rules";

export interface SaveBaremeResult {
  mandantName: string;
  mandateRef: string;
  effectiveFrom: string;
}

export function feeCommands(store: Store<FinancesState>) {
  function saveBareme(input: BaremeInput): SaveBaremeResult {
    const parsed = parseInput(baremeInputSchema, input);
    const mandant = mandantOfMandate(parsed.mandateId);
    if (!mandant) {
      throw new DemoServerError("mandat_inconnu", "Ce mandat n'existe pas.", { mandateId: "Choisissez un mandat." });
    }
    if (parsed.effectiveFrom < DEMO_TODAY) {
      const message = "L'entrée en vigueur ne peut pas être antérieure à aujourd'hui : un avenant n'est jamais rétroactif.";
      throw new DemoServerError("date_passee", message, { effectiveFrom: message });
    }
    store.update((state) => {
      const scheme: FeeScheme = {
        id: `bareme-${mandant.id}-${String(state.sequence)}`,
        mandantId: mandant.id,
        rateBp: parsed.rateBp,
        base: parsed.base,
        minFeeMinor: parsed.minFeeMinor,
        lettingBp: parsed.lettingBp,
        worksBp: parsed.worksBp,
        effectiveFrom: parsed.effectiveFrom,
        status: "a_signer",
      };
      return {
        ...state,
        schemes: [...state.schemes, scheme],
        amendments: [...state.amendments, { id: `avenant-${scheme.id}`, mandateId: mandant.mandateRef, schemeId: scheme.id, createdOn: DEMO_TODAY }],
        sequence: state.sequence + 1,
      };
    });
    return { mandantName: mandant.name, mandateRef: mandant.mandateRef, effectiveFrom: parsed.effectiveFrom };
  }

  return { saveBareme };
}
