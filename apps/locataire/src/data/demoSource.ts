import { createDemoState } from './demoState';
import { compteOps } from './demo/compte';
import { logementOps } from './demo/logement';
import { loyersOps } from './demo/loyers';
import type { LocataireSource } from './source';

export function createDemoSource(): LocataireSource {
  const state = createDemoState();
  return { ...loyersOps(state), ...logementOps(state), ...compteOps(state) };
}
