import { z } from "zod";

export const SLOT_MAX = 120;
export const MESSAGE_MAX = 1000;

export type VisitIssue = "slotRequired" | "slotTooLong" | "messageTooLong";

export const visitSchema = z.object({
  desiredSlot: z.string().trim().min(1, "slotRequired").max(SLOT_MAX, "slotTooLong"),
  message: z.string().trim().max(MESSAGE_MAX, "messageTooLong"),
});

export type VisitFormValues = z.infer<typeof visitSchema>;

const ISSUES: readonly VisitIssue[] = ["slotRequired", "slotTooLong", "messageTooLong"];

export function visitIssue(message: string | undefined): VisitIssue | null {
  return ISSUES.find((issue) => issue === message) ?? null;
}
