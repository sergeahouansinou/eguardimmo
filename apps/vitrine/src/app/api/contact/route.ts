import { handleContact, runtimeDeps } from "@/lib/contact/handler";
import { siteEnv } from "@/lib/env";

export async function POST(request: Request): Promise<Response> {
  return handleContact(request, runtimeDeps(siteEnv().NEXT_PUBLIC_SITE_URL));
}
