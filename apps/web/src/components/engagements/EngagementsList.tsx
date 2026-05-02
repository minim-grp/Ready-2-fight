import { useState } from "react";
import { Link } from "react-router-dom";
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
  type PermissionKey,
} from "../../lib/engagementLifecycle";
import { ReauthModal } from "./ReauthModal";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

const STATUS_PILL_STYLE: Record<EngagementRow["status"], React.CSSProperties> = {
  pending: {
    backgroundColor: "var(--color-bone)",
    color: "var(--color-ink-3)",
    border: "1px solid var(--line)",
  },
  active: {
    backgroundColor: "var(--color-accent-soft)",
    color: "var(--color-accent-2)",
    border: "1px solid var(--color-accent-soft)",
  },
  paused: {
    backgroundColor: "var(--color-bone)",
    color: "var(--color-ink-2)",
    border: "1px solid var(--line)",
  },
  ended: {
    backgroundColor: "transparent",
    color: "var(--color-ink-3)",
    border: "1px solid var(--line-2)",
  },
};

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
      <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
        Lade Engagements …
      </p>
    );
  }

  if (query.error) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
        Engagements konnten nicht geladen werden.
      </p>
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
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
      <ul className="space-y-3">
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
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
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
    <li className="rounded-[22px] p-4" style={CARD_STYLE}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={counterpartyName} />
          <div className="min-w-0">
            <p
              className="text-xs tracking-[0.12em] uppercase"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
            >
              {counterpartyRole}
            </p>
            <p
              className="truncate"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.125rem",
                color: "var(--color-ink)",
              }}
            >
              {counterpartyName}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--color-ink-3)" }}>
              {purposeLabel(row.purpose)}
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] tracking-[0.18em] uppercase"
          style={{ ...STATUS_PILL_STYLE[row.status], fontFamily: "var(--font-mono)" }}
          aria-label={`Status: ${statusLabel(row.status)}`}
        >
          {statusLabel(row.status)}
        </span>
      </div>

      {row.status === "ended" && endedReason && (
        <p className="mt-3 text-xs" style={{ color: "var(--color-ink-3)" }}>
          {endedReason}
        </p>
      )}

      {row.status !== "ended" && (
        <PermissionChips
          title={permissionsTitle}
          granted={grantedPermissions}
          engagementId={row.id}
        />
      )}

      {row.status !== "ended" && (
        <Link
          to={`/app/chat/${row.id}`}
          className="mt-3 inline-block text-xs"
          style={{
            color: "var(--color-accent)",
            textDecoration: "underline",
          }}
        >
          Chat oeffnen →
        </Link>
      )}

      {row.status !== "ended" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {row.status === "active" && (
            <ActionButton
              label={isPending ? "Pausiere …" : "Pausieren"}
              onClick={onPause}
              disabled={isPending}
            />
          )}
          {row.status === "paused" && (
            <ActionButton
              label={isPending ? "Setze fort …" : "Fortsetzen"}
              onClick={onResume}
              disabled={isPending}
            />
          )}
          <button
            type="button"
            onClick={onAskEnd}
            disabled={isPending}
            className="rounded-2xl px-3 py-1.5 text-xs disabled:opacity-40"
            style={{
              border: "1px solid var(--color-accent-2)",
              color: "var(--color-accent-2)",
              backgroundColor: "transparent",
            }}
          >
            Beenden
          </button>
        </div>
      )}
    </li>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl px-3 py-1.5 text-xs disabled:opacity-40"
      style={{
        border: "1px solid var(--line-2)",
        color: "var(--color-ink-2)",
        backgroundColor: "transparent",
      }}
    >
      {label}
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm"
      style={{
        backgroundColor: "var(--color-bone)",
        color: "var(--color-ink-2)",
        fontFamily: "var(--font-display)",
        letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </div>
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
    <div className="mt-3">
      <p
        id={labelId}
        className="text-xs tracking-[0.12em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        {title}:
      </p>
      {granted.length === 0 ? (
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--color-ink-3)" }}
          aria-labelledby={labelId}
        >
          keine Berechtigungen
        </p>
      ) : (
        <ul aria-labelledby={labelId} className="mt-2 flex flex-wrap gap-1.5">
          {granted.map((key) => (
            <li
              key={key}
              className="rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.12em] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--color-bone)",
                color: "var(--color-ink-2)",
                border: "1px solid var(--line)",
              }}
            >
              {permissionLabel(key)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
