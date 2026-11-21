"use client";

import { createApiClient } from "@eguardimmo/api";
import { useOrganizationSession } from "@eguardimmo/shell";
import type { OrganizationSession } from "@eguardimmo/shell";
import { MessagerieProvider, bailleurProfile, createApiMessagerieSource, createDemoMessagerieSource, proprietaireProfile } from "@eguardimmo/messagerie";
import type { HelpCenterData, MessagerieSource } from "@eguardimmo/messagerie";
import type { MessagerieRoutes } from "@eguardimmo/messagerie";
import type { LinkComponent } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { bailleurHelpCenter, mandantHelpCenter } from "@/features/aide/helpContent";
import { apiEnv, dataSource } from "@/lib/env";
import { bailleurMessagerieRoutes, confieHref, confieMessagerieRoutes } from "./routes";

const ConfieLink: LinkComponent = ({ href, ...props }) => <Link {...props} href={confieHref(href)} />;

const SPACES = {
  bailleur: { profile: bailleurProfile, routes: bailleurMessagerieRoutes, Link },
  proprietaire: { profile: proprietaireProfile, routes: confieMessagerieRoutes, Link: ConfieLink },
} satisfies Record<string, { profile: typeof bailleurProfile; routes: MessagerieRoutes; Link: LinkComponent }>;

const HELP = { bailleur: bailleurHelpCenter, proprietaire: mandantHelpCenter } satisfies Record<MessagerieSpaceName, HelpCenterData>;

export type MessagerieSpaceName = keyof typeof SPACES;

function createSource(space: MessagerieSpaceName, session: OrganizationSession | null): MessagerieSource {
  if (dataSource === "demo") return createDemoMessagerieSource({ space });
  const client = session?.client ?? createApiClient({ baseUrl: apiEnv().NEXT_PUBLIC_API_URL });
  return {
    ...createApiMessagerieSource({ client, organizationId: session?.organization.organization ?? null, space }),
    helpCenter: () => Promise.resolve(HELP[space]),
  };
}

export function MessagerieSpaceProvider({ space, children }: { space: MessagerieSpaceName; children: ReactNode }) {
  const router = useRouter();
  const session = useOrganizationSession();
  const [source] = useState(() => createSource(space, session));
  const { profile, routes, Link: SpaceLink } = SPACES[space];
  return (
    <MessagerieProvider
      source={source}
      profile={profile}
      routes={routes}
      Link={SpaceLink}
      navigate={(href) => { router.push(href); }}
    >
      {children}
    </MessagerieProvider>
  );
}
