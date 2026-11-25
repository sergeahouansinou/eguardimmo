"use client";

import { HelpPage } from "@eguardimmo/messagerie";
import { OwnerHelpProvider } from "./HelpProvider";

export function AideScreen() {
  return (
    <OwnerHelpProvider>
      <HelpPage />
    </OwnerHelpProvider>
  );
}
