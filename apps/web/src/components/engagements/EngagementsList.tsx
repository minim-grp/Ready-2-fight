import { useState } from "react";
import { useAuthStore } from "../../stores/auth";
import { useEngagements, type EngagementRow } from "../../hooks/queries/useEngagements";
import {
  useEndEngagement,
  usePauseEngagement,
  useResumeEngagement,
} from "../../hooks/queries/useEngagementLifecycle";
import {
  endReasonLabel,
  mapLifecycleError,
  permissionLabel,
  PERMISSION_KEYS,
  purposeLabel,
  statusLabel,
  statusStyle,
  type PermissionKey,
} from "../../lib/engagementLifecycle";
import { ReauthModal } from "./ReauthModal";

export function EngagementsList() {
  const userId = useAuthStore((s) => s.user?.id);
  const query = useEngagements();
  const pause = usePauseEngagement();
  const resume = useResumeEngagement();
  const end = useEndEngagement();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [endTarget, setEndTarget] = useState<EngagementRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Lade Engagements …
      </p>
    );
  }

  if (query.error) {
    return (
      <p role="alert" className="text-sm text-red-400">
        Engagements konnten nicht geladen werden.
      </p>
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Noch keine Engagements. Loese oben einen Code ein, um einen Coach zu verbinden.
      </p>
    );
  }

  const handlePause = async (id: string) => {
    setPendingId(id);
    setActionError(null);
    try {
      await pause.mutateAsync(id);
    } catch (err) {
      setActionError(mapLifecycleError(err));
    } finally {
      setPendingId(null);
    }
  };

  const handleResume = async (id: string) => {
    setPendingId(id);
    setActionError(null);
    try {
      await resume.mutateAsync(id);
    } catch (err) {
      setActionError(mapLifecycleError(err));
    } finally {
      setPendingId(null);
    }
  };

  const handleEndConfirmed = async () => {
    if (!endTarget) return;
    setPendingId(endTarget.id);
    setActionError(null);
    try {
      await end.mutateAsync({ engagementId: endTarget.id });
      setEndTarget(null);
    } catch (err) {
      setActionError(mapLifecycleError(err));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rows.map((row) => (
          <EngagementRowView
            key={row.id}
            row={row}
            isCoach={row.coach_id === userId}
            isPending={pendingId === row.id}
            onPause={() => {
              void handlePause(row.id);
            }}
            onResume={() => {
              void handleResume(row.id);
            }}
            onAskEnd={() => {
              setActionError(null);
              setEndTarget(row);
            }}
          />
        ))}
      </ul>
      {actionError && (
        <p role="alert" className="text-sm text-red-400">
          {actionError}
        </p>
      )}
      {endTarget && (
        <ReauthModal
          title="Engagement beenden"
          description={
            "Diese Aktion entzieht alle Berechtigungen und macht den Chat read-only. Bitte Passwort bestaetigen."
          }
          confirmLabel="Engagement beenden"
          onCancel={() => setEndTarget(null)}
          onConfirmed={handleEndConfirmed}
        />
      )}
    </div>
  );
}

type RowProps = {
  row: EngagementRow;
  isCoach: boolean;
  isPending: boolean;
  onPause: () => void;
  onResume: () => void;
  onAskEnd: () => void;
};

function EngagementRowView({
  row,
  isCoach,
  isPending,
  onPause,
  onResume,
  onAskEnd,
}: RowProps) {
  const counterpartyName = isCoach
    ? (row.athlete_name ?? "Athlet")
    : (row.coach_name ?? "Coach");
  const counterpartyRole = isCoach ? "Athlet" : "Coach";
  const endedReason = endReasonLabel(row.end_reason);
  const grantedPermissions = PERMISSION_KEYS.filter((key) => row[key]);
  const permissionsTitle = isCoach ? "Deine Rechte" : "Coach sieht";

  return (
    <li className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-100">
            {counterpartyRole}: <span className="font-medium">{counterpartyName}</span>
          </p>
          <p className="truncate text-xs text-slate-400">{purposeLabel(row.purpose)}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${statusStyle(row.status)}`}
          aria-label={`Status: ${statusLabel(row.status)}`}
        >
          {statusLabel(row.status)}
        </span>
      </div>

      {row.status === "ended" && endedReason && (
        <p className="mt-1 text-xs text-slate-500">{endedReason}</p>
      )}

      {row.status !== "ended" && (
        <PermissionChips
          title={permissionsTitle}
          granted={grantedPermissions}
          engagementId={row.id}
        />
      )}

      {row.status !== "ended" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {row.status === "active" && (
            <button
              type="button"
              onClick={onPause}
              disabled={isPending}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Pausiere …" : "Pausieren"}
            </button>
          )}
          {row.status === "paused" && (
            <button
              type="button"
              onClick={onResume}
              disabled={isPending}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Setze fort …" : "Fortsetzen"}
            </button>
          )}
          <button
            type="button"
            onClick={onAskEnd}
            disabled={isPending}
            className="rounded-md border border-red-800 px-2 py-1 text-xs text-red-200 hover:border-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Beenden
          </button>
        </div>
      )}
    </li>
  );
}

type PermissionChipsProps = {
  title: string;
  granted: PermissionKey[];
  engagementId: string;
};

function PermissionChips({ title, granted, engagementId }: PermissionChipsProps) {
  const labelId = `perm-${engagementId}`;
  return (
    <div className="mt-2">
      <p id={labelId} className="text-xs text-slate-500">
        {title}:
      </p>
      {granted.length === 0 ? (
        <p className="mt-0.5 text-xs text-slate-600" aria-labelledby={labelId}>
          keine Berechtigungen
        </p>
      ) : (
        <ul aria-labelledby={labelId} className="mt-1 flex flex-wrap gap-1">
          {granted.map((key) => (
            <li
              key={key}
              className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300"
            >
              {permissionLabel(key)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
