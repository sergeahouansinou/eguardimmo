import { Card } from "@eguardimmo/ui";
import { spaceLinks } from "@/lib/links";
import type { SpaceKey } from "@/lib/links";
import { LinkButton } from "./LinkButton";

export function SpaceCards({ only }: { only?: SpaceKey }) {
  const spaces = spaceLinks().filter((space) => only === undefined || space.key === only);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {spaces.map((space) => (
        <li key={space.key} className="flex">
          <Card className="w-full gap-3 p-5">
            <h3 className="text-value text-fg">{space.label}</h3>
            <p className="text-prose text-fg-muted">{space.description}</p>
            <div className="mt-auto pt-2">
              <LinkButton href={space.href} variant="secondary" external>
                Ouvrir <span className="sr-only">{space.label}</span>
              </LinkButton>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
