import type { AccessScope, AccessStatus } from '../access/model';
import type { ConsolePriority } from './model';

export const CONSOLE_PRIVACY_TEXT =
  'Les conversations des utilisateurs ne sont jamais lisibles par le support, même avec un accès : vous ne voyez que ce que le demandeur écrit dans sa demande.';

export const priorityLabel: Record<ConsolePriority, string> = { high: 'Haute', normal: 'Normale', low: 'Basse' };

export const consoleStatusLabel = { open: 'Ouverte', waiting: 'En attente du demandeur', resolved: 'Résolue' } as const;

export const consoleTabLabel = { all: 'Toutes', open: 'Ouvertes', waiting: 'En attente', resolved: 'Résolues' } as const;

export const grantStatusLabel: Record<AccessStatus, string> = {
  requested: 'En attente de l’organisation',
  active: 'Accordé',
  refused: 'Refusé par l’organisation',
  revoked: 'Révoqué',
  expired: 'Expiré',
};

export const scopeReadable: Record<AccessScope, string> = {
  settings: 'Réglages',
  team: 'Équipe',
  records: 'Dossiers',
  documents: 'Documents',
};

export const EMERGENCY_WARNINGS: readonly string[] = [
  'L’organisation est prévenue immédiatement, et ne peut pas désactiver cette notification.',
  'L’accès dure 1 heure, en lecture seule, limité aux réglages et à l’équipe.',
  'Un autre opérateur devra revoir cet accès : vous ne pouvez pas le revoir vous-même, et vous n’en rouvrirez pas d’autre sur cette organisation avant cette revue.',
  'Une seule urgence peut être ouverte à la fois sur une organisation ; au plus 3 par 24 heures, avec un délai de suspension si l’organisation en révoque une.',
];

export const OWN_REVIEW_TEXT = 'La revue revient à un autre opérateur : vous ne pouvez pas revoir votre propre accès d’urgence.';
