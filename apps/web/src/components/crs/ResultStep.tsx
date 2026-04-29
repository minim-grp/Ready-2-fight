import { CRS_EXERCISES, type CrsExerciseKey } from "../../lib/crsTest";
import { useLatestCrsScore } from "../../hooks/queries/useLatestCrsScore";
import { RadarChart, type RadarAxis } from "./RadarChart";

type Props = {
  raws: Partial<Record<CrsExerciseKey, number>>;
  onBack: () => void;
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-2)",
};

const SHORT_LABELS: Record<CrsExerciseKey, string> = {
  burpees: "Burpees",
  squats: "Squats",
  pushups: "Push-ups",
  plank: "Plank",
  high_knees: "High Knees",
};

export function ResultStep({ raws, onBack }: Props) {
  const q = useLatestCrsScore();
  const axes: RadarAxis[] = CRS_EXERCISES.map((ex) => ({
    label: ex.label,
    shortLabel: SHORT_LABELS[ex.key],
    value: raws[ex.key] ?? 0,
    max: ex.maxValue,
  }));

  const pace = paceExplanation(axes);

  return (
    <div className="space-y-5">
      <ScoreHero
        score={q.data?.score ?? null}
        rank={q.data?.rank ?? null}
        loading={q.isLoading}
      />

      <ArchetypeCard archetype={q.data?.archetype ?? null} loading={q.isLoading} />

      <section className="rounded-[28px] p-6" style={CARD_STYLE}>
        <p
          className="mb-4 text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Profil · 5 Uebungen
        </p>
        <div className="flex justify-center">
          <RadarChart axes={axes} />
        </div>
      </section>

      <section className="rounded-[28px] p-6" style={CARD_STYLE}>
        <p
          className="mb-3 text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Warum diese Zahl?
        </p>
        <ul className="space-y-2 text-sm" style={{ color: "var(--color-ink)" }}>
          {pace.map((line) => (
            <li key={line.key} className="flex justify-between gap-4">
              <span style={{ color: "var(--color-ink-2)" }}>{line.label}</span>
              <span
                className="tabular-nums"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink)" }}
              >
                {line.value}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={onBack}
        className="w-full rounded-2xl px-5 py-3 text-sm"
        style={{
          border: "1px solid var(--line-2)",
          color: "var(--color-ink-2)",
          backgroundColor: "transparent",
        }}
      >
        Zum Dashboard
      </button>
    </div>
  );
}

function ScoreHero({
  score,
  rank,
  loading,
}: {
  score: number | null;
  rank: string | null;
  loading: boolean;
}) {
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
      <p
        className="text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-on-night-3)" }}
      >
        {loading ? "Lade Score …" : `CRS · RANG ${rank ?? "—"}`}
      </p>
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
          {score != null ? String(score) : "—"}
        </span>
        <span
          className="mb-3 text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-on-night-3)" }}
        >
          / 100
        </span>
      </div>
      {score == null && !loading && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-on-night-2)" }}>
          Score wird berechnet, sobald die Auswertung verfuegbar ist.
        </p>
      )}
    </div>
  );
}

// ASSUMPTION: Archetyp-Kurztexte sind UI-Default, nicht aus PRD.
// Top-2-Logik kommt aus supabase/functions/_shared/crsScore.ts archetypeFor().
const ARCHETYPE_COPY: Record<
  "Tank" | "Assassin" | "Guardian" | "Berserker" | "Rookie",
  { tagline: string; description: string }
> = {
  Tank: {
    tagline: "Halten + Pressen",
    description: "Plank und Squats sind deine staerksten Disziplinen.",
  },
  Assassin: {
    tagline: "Tempo + Explosivitaet",
    description: "High Knees und Burpees fliegen dir leicht von der Hand.",
  },
  Guardian: {
    tagline: "Stabilitaet + Oberkoerper",
    description: "Plank und Push-ups halten dich solide im Stand.",
  },
  Berserker: {
    tagline: "Druck + Dynamik",
    description: "Burpees und Squats setzen den Ton in deinem Profil.",
  },
  Rookie: {
    tagline: "Ausgewogen",
    description: "Kein Top-Paar dominiert — Allrounder-Profil mit Luft nach oben.",
  },
};

function ArchetypeCard({
  archetype,
  loading,
}: {
  archetype: string | null;
  loading: boolean;
}) {
  const key = archetype as keyof typeof ARCHETYPE_COPY | null;
  const copy = key && key in ARCHETYPE_COPY ? ARCHETYPE_COPY[key] : null;

  return (
    <section className="rounded-[28px] p-6" style={CARD_STYLE}>
      <p
        className="mb-3 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Archetyp
      </p>
      {loading && (
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          Lade Archetyp …
        </p>
      )}
      {!loading && !copy && (
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          Archetyp wird berechnet, sobald die Auswertung verfuegbar ist.
        </p>
      )}
      {!loading && copy && key && (
        <div>
          <p
            className="leading-none"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.25rem",
              letterSpacing: "-0.02em",
              color: "var(--color-ink)",
            }}
          >
            {key}
          </p>
          <p
            className="mt-2 text-xs tracking-[0.18em] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            {copy.tagline}
          </p>
          <p className="mt-3 text-sm" style={{ color: "var(--color-ink-2)" }}>
            {copy.description}
          </p>
        </div>
      )}
    </section>
  );
}

type PaceLine = { key: string; label: string; value: string };

function paceExplanation(axes: ReadonlyArray<RadarAxis>): PaceLine[] {
  const filled = axes.filter((a) => a.max > 0);
  if (filled.length === 0) {
    return [{ key: "empty", label: "Keine Werte erfasst", value: "—" }];
  }
  const ratios = filled.map((a) => ({ axis: a, ratio: a.value / a.max }));
  const best = ratios.reduce((acc, r) => (r.ratio > acc.ratio ? r : acc));
  const weakest = ratios.reduce((acc, r) => (r.ratio < acc.ratio ? r : acc));
  return [
    {
      key: "best",
      label: `Beste Disziplin · ${best.axis.label}`,
      value: `${best.axis.value} / ${best.axis.max}`,
    },
    {
      key: "weakest",
      label: `Verbesserungs-Potenzial · ${weakest.axis.label}`,
      value: `${weakest.axis.value} / ${weakest.axis.max}`,
    },
  ];
}
