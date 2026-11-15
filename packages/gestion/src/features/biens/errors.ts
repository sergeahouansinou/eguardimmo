export class BiensError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BiensError';
  }
}
