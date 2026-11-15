export interface ReglagesSource {
  identity: () => Promise<unknown>;
  saveIdentity: (input: unknown) => Promise<unknown>;
  finances: () => Promise<unknown>;
  saveFinances: (input: unknown) => Promise<unknown>;
  updateAccount: (input: unknown) => Promise<unknown>;
}
