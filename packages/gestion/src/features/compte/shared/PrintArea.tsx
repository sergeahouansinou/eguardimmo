import type { ReactNode } from 'react';

const PRINT_CSS =
  '@media print{body *{visibility:hidden}[data-print-area],[data-print-area] *{visibility:visible}[data-print-area]{position:fixed;inset:0;width:100%;overflow:visible;background:white}}';

export function PrintArea({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <style>{PRINT_CSS}</style>
      <div data-print-area="" role="document" aria-label={label} className="mx-auto w-full max-w-[560px] border border-line-strong bg-white p-6 text-black shadow-none">
        {children}
      </div>
    </>
  );
}
