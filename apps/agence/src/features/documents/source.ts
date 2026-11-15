export interface DocumentsSource {
  list: () => Promise<unknown>;
  add: (input: unknown) => Promise<unknown>;
  setArchived: (id: string, input: unknown) => Promise<unknown>;
  updateSharing: (id: string, input: unknown) => Promise<unknown>;
}
