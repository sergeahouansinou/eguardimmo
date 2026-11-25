"use client";

import { MessagerieProvider, createApiMessagerieSource, proprietaireProfile } from "@eguardimmo/messagerie";
import type { LinkComponent } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { mandantHelpCenter } from "@/features/aide/helpContent";
import { confieHref, confieMessagerieRoutes } from "@/features/messagerie/routes";
import { useOwnerSession } from "../session";

const HelpLink: LinkComponent = ({ href, ...props }) => <Link {...props} href={confieHref(href)} />;

export function OwnerHelpProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { client } = useOwnerSession();
  const source = useMemo(
    () => ({ ...createApiMessagerieSource({ client, organizationId: null, space: "proprietaire" }), helpCenter: () => Promise.resolve(mandantHelpCenter) }),
    [client],
  );
  return (
    <MessagerieProvider
      source={source}
      profile={proprietaireProfile}
      routes={confieMessagerieRoutes}
      Link={HelpLink}
      navigate={(href) => { router.push(href); }}
    >
      {children}
    </MessagerieProvider>
  );
}
