import { Button } from "@eguardimmo/ui";
import type { ButtonProps } from "@eguardimmo/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export interface LinkButtonProps extends Pick<ButtonProps, "variant" | "size" | "className"> {
  href: string;
  children: ReactNode;
}

export function LinkButton({ href, children, variant = "secondary", size, className }: LinkButtonProps) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
