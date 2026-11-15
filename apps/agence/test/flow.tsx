import { CampaignsPage, ConversationPage, HelpPage, InboxPage, NewCampaignPage, NewMessagePage } from "@eguardimmo/messagerie";
import type { LinkComponent } from "@eguardimmo/ui";
import { render } from "@testing-library/react";
import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

export const flowNavigation: { push: (href: string) => void } = { push: () => undefined };

export const FlowLink: LinkComponent = ({ href, children, ...props }) => (
  <a
    {...props}
    href={href}
    onClick={(event) => {
      event.preventDefault();
      flowNavigation.push(href);
    }}
  >
    {children}
  </a>
);

export function firstOf<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error("Aucun élément trouvé.");
  return item;
}

export function resolveMessagerie(path: string): ReactElement | null {
  const segments = path.split("/").filter(Boolean);
  const [first, second, third] = segments;
  if (first === "aide") return <HelpPage />;
  if (first === "messages") {
    if (second === undefined) return <InboxPage />;
    return second === "nouveau" ? <NewMessagePage /> : <ConversationPage conversationId={second} />;
  }
  if (first === "campagnes") {
    if (second === undefined) return <CampaignsPage />;
    if (second === "nouvelle") return <NewCampaignPage />;
    return third === "modifier" ? <NewCampaignPage campaignId={second} /> : null;
  }
  return null;
}

function Flow({ start }: { start: string }) {
  const [path, setPath] = useState(start);
  useEffect(() => {
    flowNavigation.push = setPath;
  }, []);
  return resolveMessagerie(path) ?? <p>Route inconnue {path}</p>;
}

export function renderFlow(options: { start: string; wrap: (children: ReactNode) => ReactElement }) {
  return render(options.wrap(<Flow start={options.start} />));
}
