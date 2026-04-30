import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

const baseProps = {
  open: true,
  title: "Wirklich loeschen?",
  description: "Daten gehen verloren.",
  confirmLabel: "Loeschen",
  onCancel: () => {},
  onConfirm: () => {},
};

describe("ConfirmDialog", () => {
  it("rendert nichts wenn open=false", () => {
    render(<ConfirmDialog {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("rendert Titel + Beschreibung + Buttons wenn open=true", () => {
    render(<ConfirmDialog {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Wirklich loeschen?")).toBeInTheDocument();
    expect(screen.getByText("Daten gehen verloren.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Loeschen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
  });

  it("ruft onConfirm beim Klick auf Confirm-Button", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Loeschen" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("ruft onCancel beim Klick auf Cancel-Button", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("ruft onCancel bei Escape-Taste", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disabled beide Buttons + ignoriert Escape wenn pending", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} pending onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: /Bestaetige/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("nutzt custom cancelLabel wenn gesetzt", () => {
    render(<ConfirmDialog {...baseProps} cancelLabel="Weiter" />);
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });
});
