import type { Edl, SurveyElement, SurveyRoom, SurveyState } from './schemas';

export type Evolution = 'identique' | 'degradation' | 'amelioration' | 'non_releve';

export interface ComparedElement {
  id: string;
  label: string;
  entry: SurveyElement;
  exit: SurveyElement | null;
  evolution: Evolution;
}

export interface ComparedRoom {
  room: string;
  elements: ComparedElement[];
}

const rank: Record<SurveyState, number> = { absent: 0, degrade: 1, usage: 2, bon: 3, neuf: 4, non_controle: -1 };

export function findEntryFor(exit: Edl, all: readonly Edl[]): Edl | null {
  const entries = all.filter((edl) => edl.type === 'entree' && edl.unitId === exit.unitId && edl.id !== exit.id);
  const sameTenant = entries.filter((edl) => exit.tenantId !== null && edl.tenantId === exit.tenantId);
  const pool = sameTenant.length > 0 ? sameTenant : entries;
  return [...pool].sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''))[0] ?? null;
}

export function evolutionOf(entry: SurveyState, exit: SurveyState | null): Evolution {
  if (exit === null || exit === 'non_controle' || entry === 'non_controle') return 'non_releve';
  if (rank[exit] === rank[entry]) return 'identique';
  return rank[exit] < rank[entry] ? 'degradation' : 'amelioration';
}

export function compareSurveys(entry: readonly SurveyRoom[], exit: readonly SurveyRoom[]): ComparedRoom[] {
  return entry.map((room) => {
    const exitRoom = exit.find((candidate) => candidate.room === room.room);
    return {
      room: room.room,
      elements: room.elements.map((element) => {
        const exitElement = exitRoom?.elements.find((candidate) => candidate.id === element.id) ?? null;
        return { id: element.id, label: element.label, entry: element, exit: exitElement, evolution: evolutionOf(element.state, exitElement?.state ?? null) };
      }),
    };
  });
}

export function countEvolutions(rooms: readonly ComparedRoom[]): Record<Evolution, number> {
  const counts: Record<Evolution, number> = { identique: 0, degradation: 0, amelioration: 0, non_releve: 0 };
  for (const room of rooms) for (const element of room.elements) counts[element.evolution] += 1;
  return counts;
}

