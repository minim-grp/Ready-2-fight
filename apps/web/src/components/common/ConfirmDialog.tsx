import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Abbrechen",
  pending = false,
  destructive = false,
  onCancel,
  onConfirm,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(21, 20, 15, 0.55)" }}
    >
      <div
        className="w-full max-w-sm rounded-[28px] p-6"
        style={{
          backgroundColor: "var(--color-paper)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-3)",
        }}
      >
        <p
          className="mb-1 text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-2)" }}
        >
          Bestaetigung
        </p>
        <h2
          id="confirm-dialog-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          {title}
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
            style={{ color: "var(--color-ink-2)", backgroundColor: "transparent" }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
            style={{
              backgroundColor: destructive
                ? "var(--color-accent-2)"
                : "var(--color-accent)",
              color: "var(--color-on-night)",
            }}
          >
            {pending ? "Bestaetige …" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
