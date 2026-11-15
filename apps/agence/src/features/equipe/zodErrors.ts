import type { z } from "zod";
import { DemoServerError } from "@/features/shared/errors";

export function invalidInput(error: z.ZodError, message = "Certaines informations sont invalides."): DemoServerError {
  const fieldErrors: Record<string, string> = {};
  error.issues.forEach((issue) => {
    const field = issue.path.map(String).join(".");
    fieldErrors[field] ??= issue.message;
  });
  return new DemoServerError("invalid_input", message, fieldErrors);
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw invalidInput(result.error);
  return result.data;
}
