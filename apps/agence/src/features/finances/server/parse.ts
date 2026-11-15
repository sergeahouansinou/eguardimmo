import type { z } from "zod";
import { DemoServerError } from "@/features/shared/errors";

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  });
  throw new DemoServerError("validation", "Les données envoyées sont invalides.", fieldErrors);
}
