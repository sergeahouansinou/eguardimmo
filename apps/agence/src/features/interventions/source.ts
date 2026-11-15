import type { CreateInterventionInput, PriorityChangeInput, StatusChangeInput, SubmitDevisInput } from "./schemas";

export interface InterventionsSource {
  list: () => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  create: (input: CreateInterventionInput) => Promise<{ id: string }>;
  changeStatus: (input: StatusChangeInput) => Promise<void>;
  setPriority: (input: PriorityChangeInput) => Promise<void>;
  listDevis: () => Promise<unknown>;
  submitDevis: (input: SubmitDevisInput) => Promise<void>;
}
