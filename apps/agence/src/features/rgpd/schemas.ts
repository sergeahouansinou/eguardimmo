import { z } from "zod";
import { pageSchema } from "@/features/org/schemas";

export const REQUEST_KINDS = ["access", "rectification", "erasure", "portability", "restriction", "objection"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

const apiRequest = z.object({
  id: z.string().min(1),
  kind: z.enum(REQUEST_KINDS),
  requester: z.object({ name: z.string(), email: z.string() }),
  deadline: z.string().min(10),
  forwarded_at: z.string().min(10),
  handled: z.boolean(),
  handled_at: z.string().nullable(),
});

export const privacyRequestSchema = apiRequest.transform((request) => ({
  id: request.id,
  kind: request.kind,
  requesterName: request.requester.name,
  requesterEmail: request.requester.email,
  deadline: request.deadline,
  forwardedAt: request.forwarded_at,
  handled: request.handled,
  handledAt: request.handled_at,
}));
export type PrivacyRequest = z.output<typeof privacyRequestSchema>;

export const privacyRequestsResponse = pageSchema(privacyRequestSchema);
export const privacyRequestResponse = z.object({ data: privacyRequestSchema }).transform((payload) => payload.data);
