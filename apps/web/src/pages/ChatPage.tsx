import { Link, Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { useEngagements } from "../hooks/queries/useEngagements";
import { useChatChannel } from "../hooks/queries/useChat";
import { ChatPanel } from "../components/chat/ChatPanel";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function ChatPage() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const engagements = useEngagements();
  const channel = useChatChannel(engagementId);

  if (!engagementId) {
    return <Navigate to="/app/engagements" replace />;
  }

  const eng = (engagements.data ?? []).find((e) => e.id === engagementId);
  const isMember = !!eng && (eng.coach_id === userId || eng.athlete_id === userId);
  const counterpartyName = eng
    ? eng.coach_id === userId
      ? (eng.athlete_name ?? "Athlet")
      : (eng.coach_name ?? "Coach")
    : "";

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <Link
          to="/app/engagements"
          className="text-sm"
          style={{ color: "var(--color-ink-3)" }}
        >
          ← Zurueck zu Engagements
        </Link>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Chat
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.75rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          {counterpartyName || "Chat"}
        </h1>
      </header>

      {engagements.isLoading || channel.isLoading ? (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Chat …
        </p>
      ) : engagements.error || channel.error ? (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Chat konnte nicht geladen werden.
        </p>
      ) : !isMember ? (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Kein Zugriff auf diesen Chat.
          </p>
        </div>
      ) : !channel.data ? (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Kein Chat-Channel gefunden. Channel wird beim Code-Einloesen automatisch
            angelegt.
          </p>
        </div>
      ) : userId ? (
        <ChatPanel
          channelId={channel.data.id}
          isLocked={channel.data.is_locked}
          currentUserId={userId}
          counterpartyName={counterpartyName}
        />
      ) : null}
    </section>
  );
}
