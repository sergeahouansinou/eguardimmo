"use client";

import { Alert, IconButton } from "@eguardimmo/ui";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNoticeStore } from "./noticeStore";

export function NoticeBanner() {
  const notice = useNoticeStore((state) => state.notice);
  const dismiss = useNoticeStore((state) => state.dismiss);
  const settle = useNoticeStore((state) => state.settle);
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current) return;
    settled.current = true;
    settle();
  }, [settle]);

  if (!notice) return null;
  return (
    <div className="flex items-start gap-2">
      <Alert tone={notice.tone} title={notice.title} className="flex-1">
        {notice.message}
      </Alert>
      <IconButton label="Fermer le message" icon={X} variant="secondary" onClick={dismiss} />
    </div>
  );
}
