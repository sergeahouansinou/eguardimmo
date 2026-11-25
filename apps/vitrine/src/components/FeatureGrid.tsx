import { Card } from "@eguardimmo/ui";

export function FeatureGrid({ items }: { items: readonly { title: string; text: string }[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.title} className="flex">
          <Card className="w-full gap-1.5 p-5">
            <h3 className="text-value text-fg">{item.title}</h3>
            <p className="text-prose text-fg-muted">{item.text}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
