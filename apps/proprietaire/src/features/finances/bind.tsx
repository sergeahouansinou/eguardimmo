"use client";

import type { FinancesScreenProps } from "@eguardimmo/gestion/finances";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";

export function bindFinances<P extends object = object>(Screen: ComponentType<P & FinancesScreenProps>): ComponentType<P> {
  return function BoundFinancesScreen(props: P) {
    const router = useRouter();
    return (
      <Screen
        {...props}
        Link={Link}
        navigate={(href) => {
          router.push(href);
        }}
      />
    );
  };
}
