import type { GenerateRequest, PdfOptionsInput, RangeInput } from "./schemas";

export interface ComptesRendusSource {
  list: () => Promise<unknown>;
  preview: (range: RangeInput) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  generate: (request: GenerateRequest) => Promise<{ ids: string[] }>;
  setOptions: (input: PdfOptionsInput) => Promise<void>;
  publish: (id: string) => Promise<void>;
}
