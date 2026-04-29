type Mode = "athlete" | "coach";

type Props = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function ModeSwitcherCard({ mode, onChange }: Props) {
  return (
    <section className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-1 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Aktiver Modus
      </p>
      <p className="mb-4 text-sm" style={{ color: "var(--color-ink-2)" }}>
        Wechsle zwischen Athlet- und Coach-Ansicht.
      </p>
      <div role="group" aria-label="Modus waehlen" className="inline-flex gap-2">
        <ModeButton
          active={mode === "athlete"}
          onClick={() => onChange("athlete")}
          label="Athlet"
        />
        <ModeButton
          active={mode === "coach"}
          onClick={() => onChange("coach")}
          label="Coach"
        />
      </div>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-2xl px-4 py-2 text-sm"
      style={{
        backgroundColor: active ? "var(--color-accent)" : "transparent",
        color: active ? "var(--color-on-night)" : "var(--color-ink-2)",
        border: active ? "none" : "1px solid var(--line-2)",
      }}
    >
      {label}
    </button>
  );
}
