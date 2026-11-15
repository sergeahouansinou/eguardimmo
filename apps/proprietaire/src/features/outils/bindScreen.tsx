"use client";

import type { ScreenProps } from "@eguardimmo/gestion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";

export function bindScreen<P extends object = object>(Screen: ComponentType<P & ScreenProps>): ComponentType<P> {
  return function BoundScreen(props: P) {
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
