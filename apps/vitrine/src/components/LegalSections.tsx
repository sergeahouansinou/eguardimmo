import { PLACEHOLDER } from "@/content/placeholder";
import { Container } from "./Container";

export interface LegalSection {
  title: string;
  fields: readonly string[];
}

export function LegalSections({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-12 md:py-16">
      {sections.map((section, index) => {
        const titleId = `legal-${String(index)}`;
        return (
          <section key={section.title} aria-labelledby={titleId} className="flex flex-col gap-3">
            <h2 id={titleId} className="text-empty-title text-fg">
              {section.title}
            </h2>
            <dl className="flex flex-col gap-3">
              {section.fields.map((field) => (
                <div key={field} className="flex flex-col gap-0.5 border-t border-line pt-3 sm:flex-row sm:gap-4">
                  <dt className="text-prose font-semibold text-fg sm:w-64 sm:shrink-0">{field}</dt>
                  <dd className="text-prose text-fg-muted">{PLACEHOLDER}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </Container>
  );
}
