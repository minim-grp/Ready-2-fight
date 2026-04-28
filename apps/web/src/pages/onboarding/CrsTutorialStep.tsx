type Props = {
  onContinue: () => void;
};

const TUTORIAL_BEATS: { mono: string; title: string; body: string }[] = [
  {
    mono: "01 · DISCLAIMER",
    title: "Hoere auf deinen Koerper.",
    body: "Brich ab bei Schmerz, Schwindel oder Engegefuehl. Der Test ist fordernd, kein Wettkampf gegen dich selbst.",
  },
  {
    mono: "02 · WARM-UP",
    title: "Drei Minuten Mobilisation.",
    body: "Lockeres Einlaufen, Arm-Kreisen, Hueftkreisen. Wir fuehren dich Sekunde fuer Sekunde durch.",
  },
  {
    mono: "03 · FUENF UEBUNGEN",
    title: "Je 60 Sekunden, dein Tempo.",
    body: "Burpees, Air Squats, Push-ups, Plank, High Knees. Du zaehlst selbst — wir speichern den Wert.",
  },
];

export function CrsTutorialStep({ onContinue }: Props) {
  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-6 py-10">
      <header>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-3)",
          }}
        >
          Dein erster Test
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          So laeuft der{" "}
          <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>CRS-Test</em>.
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--color-ink-2)" }}>
          15 Minuten gesamt. Dein Score ist die Basis fuer Verlauf und Vergleich.
        </p>
      </header>

      <ol className="space-y-3">
        {TUTORIAL_BEATS.map((beat) => (
          <li
            key={beat.mono}
            className="rounded-[22px] p-5"
            style={{
              backgroundColor: "var(--color-paper)",
              boxShadow: "var(--shadow-1)",
              border: "1px solid var(--line)",
            }}
          >
            <p
              className="text-xs tracking-[0.18em] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-accent-2)",
              }}
            >
              {beat.mono}
            </p>
            <h2
              className="mt-2 text-lg"
              style={{
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.01em",
                color: "var(--color-ink)",
              }}
            >
              {beat.title}
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: "var(--color-ink-2)" }}>
              {beat.body}
            </p>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-2xl py-3.5 text-sm font-medium"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "var(--color-on-night)",
        }}
      >
        Verstanden, zum Dashboard
      </button>
      <p className="text-center text-xs" style={{ color: "var(--color-ink-3)" }}>
        Du startest den Test selbst, wenn du bereit bist.
      </p>
    </div>
  );
}
