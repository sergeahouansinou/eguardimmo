export interface ConformiteSource {
  overview: () => Promise<unknown>;
  addPiece: (input: unknown) => Promise<unknown>;
  renewPiece: (id: string, input: unknown) => Promise<unknown>;
  scheduleReminder: (id: string, input: unknown) => Promise<unknown>;
  updateReminders: (input: unknown) => Promise<unknown>;
}
