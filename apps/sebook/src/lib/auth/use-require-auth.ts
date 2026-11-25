"use client";

import { useCallback } from "react";
import { useAuth } from "./index";

export function useRequireAuth(): (action: () => void) => void {
  const { isAuthenticated, openAuth } = useAuth();
  return useCallback(
    (action: () => void) => {
      if (isAuthenticated) action();
      else openAuth("login");
    },
    [isAuthenticated, openAuth],
  );
}
