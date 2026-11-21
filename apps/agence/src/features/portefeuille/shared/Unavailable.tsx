import { UNAVAILABLE } from "../labels";

export function UnavailableNote({ what }: { what: string }) {
  return (
    <p role="note" className="py-2 text-body text-fg-subtle">
      {`${UNAVAILABLE} : ${what}`}
    </p>
  );
}
