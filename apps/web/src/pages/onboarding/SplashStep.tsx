type Props = {
  onContinue: () => void;
};

export function SplashStep({ onContinue }: Props) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      {/* ASSUMPTION: Foto-Hero ist Platzhalter (CSS-Verlauf in Calm-Strength-Tokens). */}
      {/* Echtes Kaempfer-Portrait SW-Sepia kommt mit Asset-Lieferung — ROADMAP-v2 §5c.2. */}
      <div
        className="relative flex flex-1 flex-col justify-end overflow-hidden rounded-b-[36px] px-6 pt-20 pb-12 text-[var(--color-on-night)]"
        style={{
          backgroundColor: "var(--color-night)",
          backgroundImage:
            "radial-gradient(ellipse at 75% 25%, rgba(199,62,42,0.32) 0%, transparent 55%), radial-gradient(ellipse at 25% 80%, rgba(107,106,61,0.22) 0%, transparent 60%)",
        }}
      >
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-on-night-3)",
          }}
        >
          Ready 2 Fight
        </p>
        <h1
          className="mt-3 text-4xl leading-tight"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          Trainiere mit{" "}
          <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>Klarheit</em>.
        </h1>
        <p
          className="mt-4 text-sm leading-relaxed"
          style={{ color: "var(--color-on-night-2)" }}
        >
          Standardisierter CRS-Test, Verlauf, Coach-Verbindung. Ohne Spielerei.
        </p>
      </div>

      <div className="px-6 pt-8 pb-10">
        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-2xl py-3.5 text-sm font-medium"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-on-night)",
          }}
        >
          Los geht&rsquo;s
        </button>
        <p className="mt-4 text-center text-xs" style={{ color: "var(--color-ink-3)" }}>
          Du brauchst nur 3 Minuten.
        </p>
      </div>
    </div>
  );
}
