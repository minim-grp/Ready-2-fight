import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type Notification,
  type NotificationType,
} from "../../hooks/queries/useNotifications";

type Props = {
  notifications: Notification[];
  isLoading: boolean;
  error: unknown;
  onClose: () => void;
};

const TYPE_LABELS: Record<NotificationType, string> = {
  achievement: "Erfolg",
  level_up: "Level-Up",
  streak: "Streak",
  pr: "Persoenliche Bestmarke",
  coach_feedback: "Coach-Feedback",
  plan_assigned: "Plan zugewiesen",
  quest_suggested: "Quest-Vorschlag",
  link_request: "Anfrage",
  system: "System",
  competition_prep: "Wettkampf",
  data_expiry: "Daten-Ablauf",
};

function labelFor(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = Date.now();
  const diffMin = Math.round((now - d.getTime()) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `vor ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `vor ${diffDay} d`;
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function NotificationPanel({ notifications, isLoading, error, onClose }: Props) {
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => n.read === false).length;

  return (
    <div
      role="dialog"
      aria-label="Benachrichtigungen"
      className="absolute top-full right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">Benachrichtigungen</h2>
        <button
          type="button"
          onClick={() => markAll.mutate()}
          disabled={unreadCount === 0 || markAll.isPending}
          className="text-xs text-slate-400 transition hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Alle als gelesen markieren
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading && (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            Lade Benachrichtigungen…
          </p>
        )}
        {!isLoading && error !== null && error !== undefined && (
          <p role="alert" className="px-4 py-6 text-center text-xs text-red-400">
            Konnte Benachrichtigungen nicht laden.
          </p>
        )}
        {!isLoading && !error && notifications.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            Keine Benachrichtigungen.
          </p>
        )}
        {!isLoading && !error && notifications.length > 0 && (
          <ul className="divide-y divide-slate-800">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                  }}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-800 ${
                    n.read ? "opacity-70" : ""
                  }`}
                  aria-label={`${n.title}${n.read ? "" : " (ungelesen)"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                      {labelFor(n.type)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatTime(n.created_at)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-slate-300">{n.body}</p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-800 px-4 py-2 text-right">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-100"
        >
          Schliessen
        </button>
      </div>
    </div>
  );
}
