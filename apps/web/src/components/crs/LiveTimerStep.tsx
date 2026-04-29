import { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  hint: string;
  durationSeconds: number;
  onDone: () => void;
  ctaLabel: string;
};

export function LiveTimerStep({ title, hint, durationSeconds, onDone, ctaLabel }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const doneRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining === 0 && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [remaining, onDone]);

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <div
      className="flex min-h-[28rem] flex-col justify-between rounded-[28px] p-7"
      style={{
        backgroundColor: "var(--color-night)",
        color: "var(--color-on-night)",
        boxShadow: "var(--shadow-night)",
        backgroundImage:
          "radial-gradient(ellipse at 80% 10%, rgba(199,62,42,0.16) 0%, transparent 55%)",
      }}
    >
      <header>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-on-night-3)",
          }}
        >
          {title}
        </p>
      </header>

      <div
        className="flex flex-1 flex-col items-center justify-center text-center"
        aria-live="polite"
      >
        <span
          className="leading-none tabular-nums"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "8rem",
            letterSpacing: "-0.04em",
            color: "var(--color-on-night)",
          }}
        >
          {mm}:{ss}
        </span>
        <p className="mt-6 max-w-xs text-sm" style={{ color: "var(--color-on-night-2)" }}>
          {hint}
        </p>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="self-stretch rounded-2xl px-5 py-3 text-sm"
        style={{
          border: "1px solid var(--line-night-2)",
          color: "var(--color-on-night)",
          backgroundColor: "transparent",
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
