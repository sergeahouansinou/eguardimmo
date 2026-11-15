import { useToast } from "@eguardimmo/ui";

export function useNotify() {
  const toast = useToast();
  return {
    success: (title: string, description?: string) => {
      toast.show({ tone: "success", title, ...(description ? { description } : {}) });
    },
    info: (title: string, description?: string) => {
      toast.show({ tone: "info", title, ...(description ? { description } : {}) });
    },
    warning: (title: string, description?: string) => {
      toast.show({ tone: "warning", title, ...(description ? { description } : {}) });
    },
    error: (title: string, description?: string) => {
      toast.show({ tone: "danger", title, ...(description ? { description } : {}) });
    },
  };
}
