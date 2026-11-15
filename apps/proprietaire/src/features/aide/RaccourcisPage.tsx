"use client";

import { PageHeader } from "@eguardimmo/messagerie";
import { Card, CardTitle, Kbd } from "@eguardimmo/ui";
import { Fragment } from "react";
import { SHORTCUT_GROUPS } from "./shortcuts";

export const AIDE_CRUMB = { label: "Centre d’aide", href: "/aide" };

export function RaccourcisPage() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Raccourcis clavier"
        subtitle="Naviguez plus vite sans quitter le clavier. Sur Mac, utilisez ⌘ ; sous Windows et Linux, Ctrl."
        breadcrumb={[AIDE_CRUMB, { label: "Raccourcis clavier" }]}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <Card key={group.id} role="region" aria-labelledby={`raccourcis-${group.id}`}>
            <CardTitle as="h2" id={`raccourcis-${group.id}`}>
              {group.title}
            </CardTitle>
            <dl className="flex flex-col">
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line py-2 first:border-t-0">
                  <dt className="min-w-0 flex-1 basis-48 text-body text-fg">{shortcut.label}</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    {shortcut.keys.map((combination, index) => (
                      <Fragment key={combination.join("+")}>
                        {index > 0 ? <span className="text-caption text-fg-subtle">ou</span> : null}
                        <span className="inline-flex items-center gap-1">
                          {combination.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </span>
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
