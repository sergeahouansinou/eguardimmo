"use client";

import { MessagerieProvider, bailleurProfile, createDemoMessagerieSource, proprietaireProfile } from "@eguardimmo/messagerie";
import type { MessagerieRoutes } from "@eguardimmo/messagerie";
import type { LinkComponent } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { bailleurMessagerieRoutes, confieHref, confieMessagerieRoutes } from "./routes";

const ConfieLink: LinkComponent = ({ href, ...props }) => <Link {...props} href={confieHref(href)} />;

const SPACES = {
  bailleur: { profile: bailleurProfile, routes: bailleurMessagerieRoutes, Link },
  proprietaire: { profile: proprietaireProfile, routes: confieMessagerieRoutes, Link: ConfieLink },
} satisfies Record<string, { profile: typeof bailleurProfile; routes: MessagerieRoutes; Link: LinkComponent }>;

export type MessagerieSpaceName = keyof typeof SPACES;

export function MessagerieSpaceProvider({ space, children }: { space: MessagerieSpaceName; children: ReactNode }) {
  const router = useRouter();
  const [source] = useState(() => createDemoMessagerieSource({ space }));
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
