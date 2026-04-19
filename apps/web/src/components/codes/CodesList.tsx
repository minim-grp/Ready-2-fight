import { useState } from "react";
import {
  useEngagementCodes,
  type EngagementCodeRow,
} from "../../hooks/queries/useEngagementCodes";
import { useRevokeEngagementCode } from "../../hooks/queries/useRevokeEngagementCode";
import {
  deriveCodeStatus,
  formatExpiresAt,
  mapRpcError,
  statusLabel,
  type CodeStatus,
} from "../../lib/engagementCode";

const STATUS_STYLES: Record<CodeStatus, string> = {
  active: "border-emerald-700 text-emerald-300",
  exhausted: "border-slate-600 text-slate-400",
  expired: "border-slate-700 text-slate-500",
  revoked: "border-red-800 text-red-300",
};

export function CodesList() {
  const query = useEngagementCodes();
  const revoke = useRevokeEngagementCode();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Lade Codes …
      </p>
    );
  }

  if (query.error) {
    return (
      <p role="alert" className="text-sm text-red-400">
        Codes konnten nicht geladen werden.
      </p>
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Noch keine Codes erstellt. Generiere oben deinen ersten Einladungscode.
      </p>
    );
  }

  const onRevoke = async (id: string) => {
    setPendingId(id);
    try {
      await revoke.mutateAsync(id);
    } catch {
      // Fehler wird unten via revoke.error angezeigt
    } finally {
      setPendingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rows.map((row) => (
          <CodeRow
            key={row.id}
            row={row}
            isPending={pendingId === row.id}
            isConfirming={confirmId === row.id}
            onAskConfirm={() => setConfirmId(row.id)}
            onCancelConfirm={() => setConfirmId(null)}
            onRevoke={() => {
              void onRevoke(row.id);
            }}
          />
        ))}
      </ul>
      {revoke.error && (
        <p role="alert" className="text-sm text-red-400">
          {mapRpcError(revoke.error)}
        </p>
      )}
    </div>
  );
}

type RowProps = {
  row: EngagementCodeRow;
  isPending: boolean;
  isConfirming: boolean;
  onAskConfirm: () => void;
  onCancelConfirm: () => void;
  onRevoke: () => void;
};

function CodeRow({
  row,
  isPending,
  isConfirming,
  onAskConfirm,
  onCancelConfirm,
  onRevoke,
}: RowProps) {
  const status = deriveCodeStatus(row);
  const label = statusLabel(status);
  const canRevoke = status === "active";

  return (
    <li className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm tracking-wider text-slate-100">{row.code}</p>
          {row.internal_label && (
            <p className="truncate text-xs text-slate-400">{row.internal_label}</p>
          )}
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[status]}`}
          aria-label={`Status: ${label}`}
        >
          {label}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {row.uses_count}/{row.max_uses} eingeloest · gueltig bis{" "}
        <span className="tabular-nums">{formatExpiresAt(row.expires_at)}</span>
      </p>
      {canRevoke && (
        <div className="mt-2 flex items-center gap-2">
          {!isConfirming && (
            <button
              type="button"
              onClick={onAskConfirm}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              Widerrufen
            </button>
          )}
          {isConfirming && (
            <>
              <button
                type="button"
                onClick={onRevoke}
                disabled={isPending}
                className="rounded-md border border-red-700 px-2 py-1 text-xs text-red-200 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Widerrufe …" : "Wirklich widerrufen"}
              </button>
              <button
                type="button"
                onClick={onCancelConfirm}
                disabled={isPending}
                className="rounded-md px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                Abbrechen
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
