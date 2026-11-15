import { Button } from "@eguardimmo/ui";
import type { ButtonProps } from "@eguardimmo/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export function TextLink({ href, children, size = "sm" }: { href: string; children: ReactNode; size?: ButtonProps["size"] }) {
  return (
    <Button asChild variant="link" size={size}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonProps["variant"];
}) {
  return (
    <Button asChild variant={variant} className="w-full">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function AltLine({ children }: { children: ReactNode }) {
  return <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-caption text-fg-subtle">{children}</p>;
}
