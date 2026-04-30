import type { Mood } from "./trackingForm.logic";

type MoodOption = { value: Mood; emoji: string; label: string };

// ASSUMPTION: DB-Enum mood_level hat seit PR #38 fuenf Werte. Diese
// Komponente nutzt vorerst weiter drei Stufen — der 5-Phasen-Mond-Strip
// 🌑→🌕 kommt im UI-Followup-PR.
const MOODS: MoodOption[] = [
  { value: "schlecht", emoji: "😞", label: "Schlecht" },
  { value: "mittel", emoji: "😐", label: "Neutral" },
  { value: "gut", emoji: "😊", label: "Gut" },
];

type Props = {
  label: string;
  value: Mood | "";
  onChange: (v: Mood) => void;
  required?: boolean;
};

export function MoodEmojiStrip({ label, value, onChange, required }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium" style={{ color: "var(--color-ink)" }}>
        {label}
        {required && (
          <span className="ml-1" style={{ color: "var(--color-accent)" }}>
            *
          </span>
        )}
      </legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
        {MOODS.map((m) => {
          const active = value === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={m.label}
              onClick={() => onChange(m.value)}
              className="flex flex-col items-center gap-1 rounded-2xl py-3 transition"
              style={{
                backgroundColor: active
                  ? "var(--color-accent-soft)"
                  : "var(--color-paper)",
                border: active
                  ? "1px solid var(--color-accent)"
                  : "1px solid var(--line)",
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: "1.75rem",
                  filter: active ? "none" : "grayscale(0.4)",
                }}
              >
                {m.emoji}
              </span>
              <span
                className="text-xs"
                style={{
                  color: active ? "var(--color-accent-2)" : "var(--color-ink-3)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
