import { z } from "zod";
import { DemoServerError } from "@/features/shared/errors";
import { validateFile } from "@/features/shared/files";
import type { FileRules } from "@/features/shared/files";

export const fileMetaSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: z.string().max(120),
});

export type FileMeta = z.infer<typeof fileMetaSchema>;

export function toFileMeta(file: File): FileMeta {
  return { name: file.name, size: file.size, type: file.type };
}

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  throw new DemoServerError("validation", "Le formulaire contient des erreurs.", fieldErrors);
}

export function checkFileOrThrow(file: FileMeta, rules: FileRules, field = "file"): void {
  const problem = validateFile(file, rules);
  if (problem) throw new DemoServerError("invalid_file", problem, { [field]: problem });
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/\p{Cc}/gu, "")
    .replace(/[^\p{L}\p{N} ._()'’-]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .trim();
  if (cleaned === "") return "document";
  if (cleaned.length <= 120) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return `${cleaned.slice(0, 120 - extension.length)}${extension}`;
}

export function splitServerError(error: unknown): { fields: Readonly<Record<string, string>>; message: string | null } {
  if (error instanceof DemoServerError) {
    const hasFields = Object.keys(error.fieldErrors).length > 0;
    return { fields: error.fieldErrors, message: hasFields ? null : error.message };
  }
  return { fields: {}, message: error instanceof Error ? error.message : "Une erreur est survenue. Réessayez." };
}

export function respond<T>(handler: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    resolve(handler());
  });
}
