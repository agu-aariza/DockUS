/**
 * @fileoverview Hook reutilizable de lógica de interfaz (useFocusTrap).
 *
 * @module useFocusTrap
 */

/**
 * Atrapa el foco dentro de un diálogo modal mientras está abierto.
 *
 * Sin esto, Tab podía sacar el foco de teclado del modal hacia el fondo de la
 * página mientras el backdrop seguía bloqueando la interacción visual —un
 * usuario de teclado quedaba "atascado" en un control invisible. Al cerrarse,
 * devuelve el foco a quien abrió el diálogo, que es lo que WAI-ARIA Authoring
 * Practices espera de un modal.
 */

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(
  open: boolean,
  initialFocusRef?: RefObject<HTMLElement | null>,
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    (initialFocusRef?.current ?? containerRef.current)?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return containerRef;
}
