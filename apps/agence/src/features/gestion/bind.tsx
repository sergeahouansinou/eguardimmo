"use client";

import { GestionNavigationProvider, PendingNotice } from "@eguardimmo/gestion";
import type { ScreenProps } from "@eguardimmo/gestion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

function LotBridge({ children }: { children: ReactNode }) {
  const router = useRouter();
  const search = useSearchParams();
  return (
    <GestionNavigationProvider
      value={{
        Link,
        push: (href) => {
          router.push(href);
        },
        search,
      }}
    >
      <PendingNotice />
      {children}
    </GestionNavigationProvider>
  );
}

export function bindLot<P extends object = object>(Screen: ComponentType<P>): ComponentType<P> {
  return function BoundLotScreen(props: P) {
    return (
      <LotBridge>
        <Screen {...props} />
      </LotBridge>
    );
  };
}

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
