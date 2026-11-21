import { ConsoleError } from './schemas';

export const UNAVAILABLE_MESSAGE = 'Cette fonction n’est pas encore reliée au serveur.';

export function unavailable(): Promise<never> {
  return Promise.reject(new ConsoleError('invalid', UNAVAILABLE_MESSAGE));
}
