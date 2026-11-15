import { DEMO_TODAY } from "@/features/shared/dates";
import { MANDANTS, mandantById } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import type { Store } from "@/features/shared/store";
import { baremeInputSchema } from "../inputs";
import type { BaremeInput } from "../inputs";
import type { FeeScheme, FinancesState } from "./model";
import { parseInput } from "./parse";

export interface SaveBaremeResult {
  mandantNames: string[];
  effectiveFrom: string;
}

export function feeCommands(store: Store<FinancesState>) {
  function saveBareme(input: BaremeInput): SaveBaremeResult {
    const parsed = parseInput(baremeInputSchema, input);
    if (!mandantById(parsed.mandantId)) {
      throw new DemoServerError("mandat_inconnu", "Ce mandat n'existe pas.", { mandantId: "Choisissez un mandat." });
    }
    if (parsed.effectiveFrom <= DEMO_TODAY) {
      const message = "L'entrée en vigueur doit être postérieure à aujourd'hui : un avenant est nécessaire.";
      throw new DemoServerError("date_passee", message, { effectiveFrom: message });
    }
    const mandantIds = parsed.applyToAll ? MANDANTS.map((mandant) => mandant.id) : [parsed.mandantId];
    store.update((state) => {
      const schemes: FeeScheme[] = mandantIds.map((mandantId, index) => ({
        id: `bareme-${mandantId}-${String(state.sequence + index)}`,
        mandantId,
        rateBp: parsed.rateBp,
        base: parsed.base,
        minFeeMinor: parsed.minFeeMinor,
        collection: parsed.collection,
        relocationPercent: parsed.relocationPercent,
        worksBp: parsed.worksBp,
        effectiveFrom: parsed.effectiveFrom,
        status: "a_signer",
      }));
      return {
        ...state,
        schemes: [...state.schemes, ...schemes],
        amendments: [...state.amendments, ...schemes.map((scheme) => ({ id: `avenant-${scheme.id}`, mandantId: scheme.mandantId, schemeId: scheme.id, createdOn: DEMO_TODAY }))],
        sequence: state.sequence + mandantIds.length,
      };
    });
    return { mandantNames: mandantIds.map((id) => mandantById(id)?.name ?? id), effectiveFrom: parsed.effectiveFrom };
  }

  return { saveBareme };
}
