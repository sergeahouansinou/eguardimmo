import { ApiError } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import type { MessagerieSpace } from '../demo';
import type { Attachment, Participant, ParticipantRole } from '../schemas';

export interface ApiMessagerieSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  space: MessagerieSpace;
  viewerId?: string;
}

export const STALE_HOURS = 48;

export function initialsOf(name: string): string {
  const letters = name
    .split(/[\s-]+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return letters || name.charAt(0).toUpperCase();
}

export function participant(ref: { id: string; name: string }, role: ParticipantRole): Participant {
  return { id: ref.id, name: ref.name, initials: initialsOf(ref.name), role };
}

export function teamRole(space: MessagerieSpace): ParticipantRole {
  return space === 'agence' ? 'agence' : 'gestionnaire';
}

export interface ApiAttachment {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
}

export function toAttachment(piece: ApiAttachment): Attachment {
  return { id: piece.id, name: piece.name, mimeType: piece.mime_type, sizeBytes: piece.size_bytes };
}

export function formatDelay(minutes: number): string {
  if (minutes < 1) return 'Moins d’1 min';
  if (minutes < 60) return `${String(minutes)} min`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest).padStart(2, '0')}`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return hours === 0 ? `${String(days)} j` : `${String(days)} j ${String(hours)} h`;
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));
}

export function messageForm(fields: Record<string, string | null | undefined>, files: File[]): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.append(key, value);
  }
  for (const file of files) form.append('attachments[]', file);
  return form;
}

export function parseResponse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error('Réponse inattendue du serveur. Réessayez dans un instant.');
  return parsed.data;
}

export async function translated<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      const first = error.firstFieldError();
      if (first) throw new Error(first, { cause: error });
    }
    throw error;
  }
}

export function unavailable(message: string): () => Promise<never> {
  return () => Promise.reject(new Error(message));
}
