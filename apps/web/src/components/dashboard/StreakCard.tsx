import { useStreak } from "../../hooks/queries/useStreak";
import { isInKarenz } from "../../lib/streak";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function StreakCard() {
  const q = useStreak();

  if (q.isLoading) {
    return (
      <div className="rounded-[22px] p-5" style={CARD_STYLE} role="status">
        <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Streak …
        </p>
      </div>
    );
  }

  if (q.error) {
    return (
      <div
        className="rounded-[22px] p-5"
        role="alert"
        style={{
          backgroundColor: "var(--color-accent-soft)",
          border: "1px solid var(--color-accent)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Streak konnte nicht geladen werden.
        </p>
      </div>
    );
  }

  const streak = q.data;
  const current = streak?.current_streak ?? 0;
  const longest = streak?.longest_streak ?? 0;

  if (!streak || current <= 0) {
    return (
      <div className="rounded-[22px] p-5" style={CARD_STYLE}>
        <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Noch keine Streak — tracke heute, um eine zu starten.
        </p>
      </div>
    );
  }

  const inKarenz = isInKarenz(streak.last_tracked_date, current, new Date());

  return (
    <div className="rounded-[22px] p-5" style={CARD_STYLE}>
      <div className="flex items-baseline gap-3">
        <FlameIcon className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
        <div className="flex items-baseline gap-2">
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.5rem",
              letterSpacing: "-0.02em",
              color: "var(--color-ink)",
            }}
          >
            {current}
          </span>
          <span className="text-sm" style={{ color: "var(--color-ink-3)" }}>
            {current === 1 ? "Tag Streak" : "Tage Streak"}
          </span>
        </div>
      </div>
      <p
        className="mt-2 text-xs tracking-[0.12em] uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-4)",
        }}
      >
        Laengste Streak ·{" "}
        <span className="tabular-nums" style={{ color: "var(--color-ink-2)" }}>
          {longest}
        </span>
      </p>
      {inKarenz && (
        <div
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
          role="status"
          aria-label="In Karenz"
          style={{
            backgroundColor: "var(--color-bone)",
            color: "var(--color-ink-2)",
            border: "1px solid var(--line-2)",
          }}
        >
          <ClockIcon className="h-3 w-3" />
          <span>In Karenz</span>
        </div>
      )}
    </div>
  );
}

type IconProps = { className?: string; style?: React.CSSProperties };

function FlameIcon({ className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M12 2c1 2 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2-.5 1.5.5 2 1 2 1 0 1.5-1 1.5-2.5S11 4 12 2zm0 20a8 8 0 0 0 8-8c0-5-4-8-4-8 .5 2 1 3 1 5s-1 3-2 3-1.5-1-1.5-2.5S14 7 12 5c-3 3-6 5-6 9a6 6 0 0 0 6 8z" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
