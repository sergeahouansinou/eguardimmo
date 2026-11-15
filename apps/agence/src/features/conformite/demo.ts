import { DemoServerError } from "@/features/shared/errors";
import { DOCUMENT_RULES } from "@/features/shared/files";
import { checkFileOrThrow, parseOrThrow, respond, sanitizeFileName } from "@/features/kit/serverValidation";
import { DEMO_TODAY, formatDate } from "@/features/shared/dates";
import { createStore, nextId, slugify } from "@/features/shared/store";
import { CHANNEL_LABELS, PIECE_TYPES, addPieceInputSchema, reminderFormSchema, remindersInputSchema, renewInputSchema } from "./schemas";
import type { ConformiteData, Piece } from "./schemas";
import { initialConformite } from "./fixtures";
import type { ConformiteSource } from "./source";

function findPiece(data: ConformiteData, id: string): Piece {
  const piece = data.pieces.find((candidate) => candidate.id === id);
  if (!piece) throw new DemoServerError("not_found", "Cette pièce n’existe pas ou a été retirée.");
  return piece;
}

function replacePiece(data: ConformiteData, next: Piece): ConformiteData {
  return { ...data, pieces: data.pieces.map((piece) => (piece.id === next.id ? next : piece)) };
}

export function createConformiteDemo(): ConformiteSource {
  const store = createStore<ConformiteData>(initialConformite());

  return {
    overview: () => Promise.resolve(store.get()),

    addPiece: (input) => respond(() => {
      const value = parseOrThrow(addPieceInputSchema, input);
      checkFileOrThrow(value.file, DOCUMENT_RULES);
      const label = PIECE_TYPES.find((type) => type.value === value.type)?.label ?? "Autre pièce";
      const title = value.type === "autre" ? value.title : label;
      const current = store.get();
      const id = current.pieces.some((piece) => piece.id === slugify(title))
        ? nextId(slugify(title), current.pieces.map((piece) => piece.id))
        : slugify(title);
      const piece: Piece = {
        id,
        title,
        fullTitle: title,
        subtitle: `Ajoutée le ${formatDate(DEMO_TODAY)}`,
        reference: value.reference,
        expiresOn: value.expiresOn,
        validLabel: "Valide",
        renewable: true,
        renewalSubject: `La pièce « ${title} »`,
        renewalAction: `Renouveler « ${title} »`,
        renewalImpact: null,
        upkeepNote: null,
        fileName: sanitizeFileName(value.file.name),
        details: [
          { label: "Titulaire", value: "Cabinet Delmas Immobilier" },
          { label: "Référence", value: "", field: "reference" },
          { label: "Échéance", value: "", field: "expiresOn" },
        ],
        conditions: [],
        history: [{ id: "h1", title: "Pièce ajoutée", detail: `${formatDate(DEMO_TODAY)} · ${sanitizeFileName(value.file.name)}`, date: DEMO_TODAY, tone: "success" }],
        reminder: null,
      };
      store.update((data) => ({ ...data, pieces: [...data.pieces, piece] }));
      return piece;
    }),

    renewPiece: (id, input) => respond(() => {
      const piece = findPiece(store.get(), id);
      const value = parseOrThrow(renewInputSchema(piece.expiresOn), input);
      if (value.file) checkFileOrThrow(value.file, DOCUMENT_RULES);
      const next: Piece = {
        ...piece,
        reference: value.reference,
        expiresOn: value.expiresOn,
        fileName: value.file ? sanitizeFileName(value.file.name) : piece.fileName,
        reminder: null,
        history: [
          {
            id: nextId("h", piece.history.map((entry) => entry.id)),
            title: "Pièce renouvelée",
            detail: `${formatDate(DEMO_TODAY)} · nouvelle échéance ${formatDate(value.expiresOn)}`,
            date: DEMO_TODAY,
            tone: "success",
          },
          ...piece.history,
        ],
      };
      store.update((data) => replacePiece(data, next));
      return next;
    }),

    scheduleReminder: (id, input) => respond(() => {
      const piece = findPiece(store.get(), id);
      const value = parseOrThrow(reminderFormSchema(piece.expiresOn), input);
      const channel = value.channel;
      const next: Piece = {
        ...piece,
        reminder: { on: value.on, channel },
        history: [
          {
            id: nextId("h", piece.history.map((entry) => entry.id)),
            title: "Rappel programmé",
            detail: `${formatDate(value.on)} · ${CHANNEL_LABELS[channel]}`,
            date: DEMO_TODAY,
            tone: "neutral",
          },
          ...piece.history,
        ],
      };
      store.update((data) => replacePiece(data, next));
      return next;
    }),

    updateReminders: (input) => respond(() => {
      const value = parseOrThrow(remindersInputSchema, input);
      const days = [...new Set(value.days)].sort((a, b) => b - a);
      const next = store.update((data) => ({ ...data, reminders: { ...value, days, recipients: [...new Set(value.recipients)] } }));
      return next.reminders;
    }),
  };
}
