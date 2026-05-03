import { useEffect, useRef, useState } from "react";
import {
  useNotifications,
  useNotificationsSubscription,
  useUnreadNotificationsCount,
} from "../../hooks/queries/useNotifications";
import { NotificationPanel } from "./NotificationPanel";

export function NotificationBell() {
  useNotificationsSubscription();
  const query = useNotifications();
  const unread = useUnreadNotificationsCount();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const badgeLabel = unread > 0 ? ` (${unread} ungelesen)` : "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Benachrichtigungen oeffnen${badgeLabel}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4 font-semibold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          notifications={query.data ?? []}
          isLoading={query.isLoading}
          error={query.error}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
