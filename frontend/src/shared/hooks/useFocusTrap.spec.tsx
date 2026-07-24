import { useRef, type RefObject } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { useFocusTrap } from "./useFocusTrap";

function Harness({ open }: { open: boolean }) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(
    open,
    firstRef as RefObject<HTMLElement | null>,
  );

  return (
    <div>
      <button data-testid="opener">Opener</button>
      {open && (
        <div ref={trapRef} data-testid="trap">
          <button ref={firstRef}>First</button>
          <button>Middle</button>
          <button>Last</button>
        </div>
      )}
    </div>
  );
}

describe("useFocusTrap (UX-MED-01)", () => {
  it("moves focus to the initial-focus element when it opens", () => {
    const { rerender } = render(<Harness open={false} />);
    rerender(<Harness open={true} />);

    expect(screen.getByText("First")).toHaveFocus();
  });

  it("wraps Tab from the last focusable element back to the first", () => {
    render(<Harness open={true} />);

    screen.getByText("Last").focus();
    fireEvent.keyDown(screen.getByText("Last"), { key: "Tab" });

    expect(screen.getByText("First")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element back to the last", () => {
    render(<Harness open={true} />);

    expect(screen.getByText("First")).toHaveFocus();
    fireEvent.keyDown(screen.getByText("First"), { key: "Tab", shiftKey: true });

    expect(screen.getByText("Last")).toHaveFocus();
  });

  it("does not trap Tab presses between the first and last element", () => {
    render(<Harness open={true} />);

    screen.getByText("Middle").focus();
    fireEvent.keyDown(screen.getByText("Middle"), { key: "Tab" });

    // El hook no gestiona el foco entre elementos intermedios: eso ya lo hace
    // el navegador. Solo intercepta los bordes (primero/último).
    expect(screen.getByText("Middle")).toHaveFocus();
  });

  it("restores focus to the element that was focused before it opened", () => {
    const { rerender } = render(<Harness open={false} />);
    screen.getByTestId("opener").focus();
    expect(screen.getByTestId("opener")).toHaveFocus();

    rerender(<Harness open={true} />);
    expect(screen.getByText("First")).toHaveFocus();

    rerender(<Harness open={false} />);
    expect(screen.getByTestId("opener")).toHaveFocus();
  });
});
