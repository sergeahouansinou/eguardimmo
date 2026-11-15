"use client";

import { z } from "zod";
import { agenceKey, useAgenceMutation, useAgenceQuery } from "@/features/query";
import { mandantPreviewSchema, overviewSchema, reportDetailSchema } from "./schemas";
import type { GenerateRequest, PdfOptionsInput } from "./schemas";

const previewListSchema = z.array(mandantPreviewSchema);
const nullableDetail = reportDetailSchema.nullable();

export function useOverview() {
  return useAgenceQuery(agenceKey("comptes-rendus", "list"), overviewSchema, (source) => source.comptesRendus.list());
}

export function usePreview(from: string, to: string) {
  return useAgenceQuery(agenceKey("comptes-rendus", "preview", from, to), previewListSchema, (source) => source.comptesRendus.preview({ from, to }));
}

export function useReport(id: string) {
  return useAgenceQuery(agenceKey("comptes-rendus", "one", id), nullableDetail, (source) => source.comptesRendus.get(id));
}

export function useGenerate() {
  return useAgenceMutation((source, request: GenerateRequest) => source.comptesRendus.generate(request));
}

export function useSetPdfOptions() {
  return useAgenceMutation((source, input: PdfOptionsInput) => source.comptesRendus.setOptions(input));
}

export function usePublish() {
  return useAgenceMutation((source, id: string) => source.comptesRendus.publish(id));
}
