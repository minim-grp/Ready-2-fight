import type { Profile } from "../../hooks/queries/useProfile";

const ROLE_LABEL: Record<Profile["role"], string> = {
  athlete: "Athlet",
  coach: "Coach",
  both: "Athlet und Coach",
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

type Props = {
  profile: Profile;
  email: string;
};

export function ProfileCard({ profile, email }: Props) {
  return (
    <section className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-3 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Stammdaten
      </p>
      <dl className="grid gap-3 text-sm">
        <Row label="Anzeigename" value={profile.display_name} />
        <Row label="E-Mail" value={email || "–"} />
        <Row label="Rolle" value={ROLE_LABEL[profile.role]} />
        <Row
          label="Level"
          value={`${profile.level} · ${profile.level_title} · ${profile.xp_total} XP`}
        />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt
        className="text-xs tracking-[0.12em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        {label}
      </dt>
      <dd className="text-sm" style={{ color: "var(--color-ink)" }}>
        {value}
      </dd>
    </div>
  );
}
