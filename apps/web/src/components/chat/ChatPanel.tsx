import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useChatMessages,
  useChatSubscription,
  useMarkMessagesRead,
  useSendMessage,
  type ChatMessage,
} from "../../hooks/queries/useChat";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

type Props = {
  channelId: string;
  isLocked: boolean;
  currentUserId: string;
  counterpartyName: string;
};

export function ChatPanel({
  channelId,
  isLocked,
  currentUserId,
  counterpartyName,
}: Props) {
  const messages = useChatMessages(channelId);
  const send = useSendMessage(channelId);
  const markRead = useMarkMessagesRead(channelId);
  useChatSubscription(channelId);
  const [body, setBody] = useState("");
  const listRef = useRef<HTMLUListElement | null>(null);

  // Auto-scroll an Liste-Ende bei neuen Messages.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.data?.length]);

  // Read-Receipts §1.30: Markieren wenn ChatPage offen ist und es
  // ungelesene fremde Messages gibt. Triggert auf jede Aenderung der
  // Cache-Liste (neue Inserts via Realtime fallen darunter).
  const unreadFromOthers = (messages.data ?? []).some(
    (m) => m.sender_id !== currentUserId && m.read_at === null,
  );
  const markMutate = markRead.mutate;
  useEffect(() => {
    if (unreadFromOthers && !isLocked) {
      markMutate();
    }
  }, [unreadFromOthers, isLocked, markMutate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > 4000) {
      toast.error("Nachricht darf maximal 4000 Zeichen haben.");
      return;
    }
    try {
      await send.mutateAsync(trimmed);
      setBody("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Senden fehlgeschlagen: ${msg}`);
    }
  }

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: "60vh" }}>
      {messages.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Nachrichten …
        </p>
      )}
      {messages.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Nachrichten konnten nicht geladen werden.
        </p>
      )}

      {!messages.isLoading && !messages.error && (
        <ul
          ref={listRef}
          role="list"
          className="flex-1 space-y-2 overflow-y-auto rounded-[22px] p-4"
          style={CARD_STYLE}
          aria-label={`Chat mit ${counterpartyName}`}
        >
          {(messages.data ?? []).length === 0 && (
            <li className="text-sm" style={{ color: "var(--color-ink-3)" }}>
              Noch keine Nachrichten. Schreib die erste.
            </li>
          )}
          {(messages.data ?? []).map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.sender_id === currentUserId}
            />
          ))}
        </ul>
      )}

      {isLocked ? (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{
            backgroundColor: "var(--color-paper-elev)",
            border: "1px solid var(--line)",
            color: "var(--color-ink-2)",
          }}
        >
          Engagement beendet. Chat ist read-only.
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Neue Nachricht
          </label>
          <input
            id="chat-input"
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Nachricht …"
            maxLength={4000}
            className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
            style={{
              backgroundColor: "var(--color-paper-elev)",
              border: "1px solid var(--line)",
              color: "var(--color-ink)",
            }}
          />
          <button
            type="submit"
            disabled={send.isPending || !body.trim()}
            className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-on-night)",
            }}
          >
            {send.isPending ? "…" : "Senden"}
          </button>
        </form>
      )}
    </div>
  );
}

function MessageBubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  return (
    <li
      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
      aria-label={isMine ? "Eigene Nachricht" : "Nachricht des Gegenuebers"}
    >
      <div
        className="max-w-[75%] rounded-2xl px-4 py-2 text-sm"
        style={{
          backgroundColor: isMine ? "var(--color-accent)" : "var(--color-paper-elev)",
          color: isMine ? "var(--color-on-night)" : "var(--color-ink)",
          border: isMine ? "none" : "1px solid var(--line)",
        }}
      >
        <p>{message.body}</p>
        <p
          className="mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums"
          style={{
            fontFamily: "var(--font-mono)",
            color: isMine ? "var(--color-on-night)" : "var(--color-ink-3)",
            opacity: isMine ? 0.75 : 1,
          }}
        >
          <span>{formatTime(message.created_at)}</span>
          {isMine && (
            <span aria-label={message.read_at ? "Gelesen" : "Gesendet"}>
              {message.read_at ? "✓✓" : "✓"}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
