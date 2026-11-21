"use client";

import { Button, EmptyState } from "@eguardimmo/ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import type { CursorList } from "./useCursorList";
import type { CursorPage } from "./model";

export interface PagedStateProps<T, P extends CursorPage<T>> {
  list: CursorList<T, P>;
  loadingLabel: string;
  failureTitle: string;
  empty: { icon: LucideIcon; title: string; description: string };
  children: (items: T[]) => ReactNode;
}

export function PagedState<T, P extends CursorPage<T>>({ list, loadingLabel, failureTitle, empty, children }: PagedStateProps<T, P>) {
  if (!list.loaded) {
    return list.failed ? <FailureNotice title={failureTitle} error={list.error} onRetry={list.retry} /> : <Loading label={loadingLabel} />;
  }
  if (list.items.length === 0 && !list.hasNext) return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />;
  return (
    <>
      {children(list.items)}
      {list.failed ? <FailureNotice title="La suite de la liste n’a pas pu être chargée" error={list.error} onRetry={list.retry} /> : null}
      {list.hasNext && !list.failed ? (
        <div>
          <Button variant="secondary" loading={list.loadingMore} onClick={list.loadMore}>
            Afficher la suite
          </Button>
        </div>
      ) : null}
    </>
  );
}
