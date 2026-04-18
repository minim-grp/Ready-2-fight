import { useOnlineStatus } from "../../hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-600/40 bg-amber-600/10 px-4 py-2 text-center text-xs text-amber-200"
    >
      Offline. Nur Daily Tracking ist verfuegbar – Eintraege werden bei Reconnect
      synchronisiert.
    </div>
  );
}
