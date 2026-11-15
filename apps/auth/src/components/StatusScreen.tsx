import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AuthCard, AuthHeading } from "./AuthCard";
import { IconTile } from "./IconTile";
import type { TileTone } from "./IconTile";

export interface StatusScreenProps {
  icon: LucideIcon;
  tone?: TileTone;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  legal?: boolean;
}

export function StatusScreen({ icon, tone = "info", title, description, children, legal = true }: StatusScreenProps) {
  return (
    <AuthCard label={title} centered legal={legal}>
      <IconTile icon={icon} tone={tone} large />
      <AuthHeading title={title} description={description} focus />
      {children ? <div className="flex w-full flex-col items-stretch gap-3">{children}</div> : null}
    </AuthCard>
  );
}
