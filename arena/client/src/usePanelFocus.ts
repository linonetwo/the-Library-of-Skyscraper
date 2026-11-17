import { useEffect, useRef } from "react";
export function usePanelFocus(open: boolean, close: () => void, returnFocus?: string) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) {
        event.preventDefault(); closeRef.current();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); (returnFocus ? document.querySelector<HTMLElement>(returnFocus) : trigger)?.focus(); };
  }, [open, returnFocus]);
}
