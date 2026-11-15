"use client";

import { agenceKey, useAgenceMutation, useAgenceQuery } from "@/features/query";
import { conformiteSchema, pieceSchema, remindersSchema } from "./schemas";
import type { Channel } from "./schemas";
import type { FileMeta } from "@/features/kit/serverValidation";

export function useConformite() {
  return useAgenceQuery(agenceKey("conformite"), conformiteSchema, (source) => source.conformite.overview());
}

export interface AddPiecePayload {
  type: string;
  title: string;
  reference: string;
  expiresOn: string;
  file: FileMeta;
}

export function useAddPiece() {
  return useAgenceMutation(async (source, input: AddPiecePayload) => pieceSchema.parse(await source.conformite.addPiece(input)));
}

export interface RenewPayload {
  id: string;
  reference: string;
  expiresOn: string;
  file: FileMeta | null;
}

export function useRenewPiece() {
  return useAgenceMutation(async (source, { id, ...input }: RenewPayload) => pieceSchema.parse(await source.conformite.renewPiece(id, input)));
}

export interface ReminderPayload {
  id: string;
  on: string;
  channel: Channel;
}

export function useScheduleReminder() {
  return useAgenceMutation(async (source, { id, ...input }: ReminderPayload) =>
    pieceSchema.parse(await source.conformite.scheduleReminder(id, input)),
  );
}

export interface RemindersPayload {
  days: number[];
  recipients: string[];
  channels: ("email" | "app")[];
}

export function useUpdateReminders() {
  return useAgenceMutation(async (source, input: RemindersPayload) => remindersSchema.parse(await source.conformite.updateReminders(input)));
}
