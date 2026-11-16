import { useGestionDataMode } from '../../locataires/kit/sourceContext';
import { DEMO_TODAY } from './demoClock';

export function realToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function useReferenceDay(): string {
  return useGestionDataMode() === 'api' ? realToday() : DEMO_TODAY;
}
