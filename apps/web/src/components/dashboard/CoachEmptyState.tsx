import { Link } from "react-router-dom";

const HERO_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-night)",
  color: "var(--color-on-night)",
  backgroundImage:
    "radial-gradient(ellipse at 80% 20%, rgba(199,62,42,0.16) 0%, transparent 55%)",
  boxShadow: "var(--shadow-night)",
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

type Action = {
  to: string;
  eyebrow: string;
  title: string;
  hint: string;
};

const ACTIONS: ReadonlyArray<Action> = [
  {
    to: "/app/codes",
    eyebrow: "Schritt 1",
    title: "Code generieren",
    hint: "Erzeuge einen 8-stelligen Engagement-Code und teile ihn mit deiner Athletin oder deinem Athleten.",
  },
  {
    to: "/app/engagements",
    eyebrow: "Schritt 2",
    title: "Athleten verwalten",
    hint: "Sieh aktive und pausierte Engagements ein, passe Berechtigungen an oder beende eine Betreuung.",
  },
];

export function CoachEmptyState() {
  return (
    <div className="space-y-5">
      <section className="rounded-[28px] p-6" style={HERO_STYLE}>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-on-night-3)",
          }}
        >
          Coach · Heute
        </p>
        <h2
          className="mt-3 max-w-md leading-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.875rem",
            letterSpacing: "-0.02em",
            color: "var(--color-on-night)",
          }}
        >
          Noch keine Athleten verbunden.
        </h2>
        <p className="mt-3 max-w-md text-sm" style={{ color: "var(--color-on-night-2)" }}>
          Sobald deine ersten Athleten einen Code eingeloest haben, siehst du hier eine
          Aufmerksamkeits-Liste, Wochenkalender und ihre aktuellen CRS-Stand. Bis dahin:
          starte mit einem Code.
        </p>
      </section>

      <ul className="grid gap-3 md:grid-cols-2">
        {ACTIONS.map((a) => (
          <li key={a.to}>
            <Link
              to={a.to}
              className="block h-full rounded-[22px] p-5 transition"
              style={CARD_STYLE}
            >
              <p
                className="text-xs tracking-[0.18em] uppercase"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-accent-2)",
                }}
              >
                {a.eyebrow}
              </p>
              <h3
                className="mt-2"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                  letterSpacing: "-0.01em",
                  color: "var(--color-ink)",
                }}
              >
                {a.title}
              </h3>
              <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
                {a.hint}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p
        className="text-xs tracking-[0.12em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Vollstaendiges Coach-Dashboard mit Plan-Builder folgt in Sprint 7.
      </p>
    </div>
  );
}
