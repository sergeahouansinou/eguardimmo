import { Card, CardHeader, CardTitle } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export interface SectionCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, action, children, className }: SectionCardProps) {
  return (
    <Card className={className} role="region" aria-label={title}>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}
