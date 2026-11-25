import { Button } from "@eguardimmo/ui";
import type { ButtonVariant } from "@eguardimmo/ui";
import Link from "next/link";
import type { ReactNode } from "react";

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  external?: boolean;
}

export function LinkButton({ href, children, variant = "primary", external = false }: LinkButtonProps) {
  return (
    <Button asChild size="lg" variant={variant} className="min-h-11 px-5">
      {external ? <a href={href}>{children}</a> : <Link href={href}>{children}</Link>}
    </Button>
  );
}
