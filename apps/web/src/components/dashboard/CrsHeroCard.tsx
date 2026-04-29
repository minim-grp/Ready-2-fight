import { Link } from "react-router-dom";
import { useLatestCrsScore } from "../../hooks/queries/useLatestCrsScore";

export function CrsHeroCard() {
  const q = useLatestCrsScore();

  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-6"
      style={{
        backgroundColor: "var(--color-night)",
        color: "var(--color-on-night)",
        backgroundImage:
          "radial-gradient(ellipse at 80% 30%, rgba(199,62,42,0.18) 0%, transparent 55%)",
        boxShadow: "var(--shadow-night)",
      }}
    >
      {q.isLoading && (
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-on-night-3)",
          }}
        >
          Lade Score …
        </p>
      )}

      {q.error && (
        <p style={{ color: "var(--color-accent-soft)" }} role="alert">
          CRS-Score konnte nicht geladen werden.
        </p>
      )}

      {!q.isLoading && !q.error && (
        <>
          <CrsHeroHeader hasTest={!!q.data} rank={q.data?.rank ?? null} />
          <CrsHeroNumber score={q.data?.score ?? null} hasTest={!!q.data} />
          <CrsHeroCta hasTest={!!q.data} />
        </>
      )}
    </div>
  );
}

function CrsHeroHeader({ hasTest, rank }: { hasTest: boolean; rank: string | null }) {
  return (
    <div className="flex items-start justify-between">
      <p
        className="text-xs tracking-[0.18em] uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-on-night-3)",
        }}
      >
        {hasTest ? `CRS · RANG ${rank ?? "—"}` : "CRS · NOCH KEIN TEST"}
      </p>
      <p
        className="text-xs tracking-[0.18em] uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-on-night-3)",
        }}
      >
        Mein Score
      </p>
    </div>
  );
}

function CrsHeroNumber({ score, hasTest }: { score: number | null; hasTest: boolean }) {
  const display = score != null ? String(score) : hasTest ? "—" : "—";
  return (
    <div className="mt-3 flex items-end gap-3">
      <span
        className="leading-none tabular-nums"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "5.5rem",
          letterSpacing: "-0.04em",
          color: "var(--color-on-night)",
        }}
      >
        {display}
      </span>
      {score != null && (
        <span
          className="mb-3 text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-on-night-3)",
          }}
        >
          / 100
        </span>
      )}
    </div>
  );
}

function CrsHeroCta({ hasTest }: { hasTest: boolean }) {
  return (
    <div className="mt-5">
      <Link
        to="/app/crs/test"
        className="inline-block rounded-2xl px-5 py-3 text-sm font-medium"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "var(--color-on-night)",
        }}
      >
        {hasTest ? "Neuen Test starten" : "Ersten Test starten"}
      </Link>
    </div>
  );
}
