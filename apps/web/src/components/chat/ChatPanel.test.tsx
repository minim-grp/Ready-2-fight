import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";
import type { ChatMessage } from "../../hooks/queries/useChat";

type MsgState = {
  data: ChatMessage[] | undefined;
  isLoading: boolean;
  error: Error | null;
};
type MutationState = {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
};

const msgState: { value: MsgState } = {
  value: { data: [], isLoading: false, error: null },
};
const sendState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};

const markReadState: { value: { mutate: ReturnType<typeof vi.fn> } } = {
  value: { mutate: vi.fn() },
};

vi.mock("../../hooks/queries/useChat", () => ({
  useChatMessages: () => msgState.value,
  useSendMessage: () => sendState.value,
  useMarkMessagesRead: () => markReadState.value,
  // Subscription noop in Tests — Realtime wird nicht getriggert.
  useChatSubscription: () => undefined,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function msg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    channel_id: "ch1",
    sender_id: "other",
    body: "Hallo",
    created_at: "2026-05-01T12:00:00Z",
    read_at: null,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  return render(
    <ChatPanel
      channelId="ch1"
      isLocked={false}
      currentUserId="me"
      counterpartyName="Lena"
      {...overrides}
    />,
  );
}

describe("ChatPanel", () => {
  beforeEach(() => {
    msgState.value = { data: [], isLoading: false, error: null };
    sendState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    markReadState.value = { mutate: vi.fn() };
  });

  it("zeigt Loading-State", () => {
    msgState.value = { data: undefined, isLoading: true, error: null };
    renderPanel();
    expect(screen.getByText(/Lade Nachrichten/)).toBeInTheDocument();
  });

  it("zeigt Error-State", () => {
    msgState.value = { data: undefined, isLoading: false, error: new Error("boom") };
    renderPanel();
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht geladen/);
  });

  it("zeigt Empty-State + ermoeglicht Senden", async () => {
    renderPanel();
    expect(screen.getByText(/Schreib die erste/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Neue Nachricht/), {
      target: { value: "Hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Senden/ }));
    await waitFor(() => expect(sendState.value.mutateAsync).toHaveBeenCalledWith("Hi"));
  });

  it("rendert eigene + fremde Bubbles unterschiedlich (aria-label)", () => {
    msgState.value = {
      data: [
        msg({ id: "m1", sender_id: "other", body: "Hallo" }),
        msg({ id: "m2", sender_id: "me", body: "Hi zurueck" }),
      ],
      isLoading: false,
      error: null,
    };
    renderPanel();
    expect(screen.getByLabelText("Nachricht des Gegenuebers")).toHaveTextContent("Hallo");
    expect(screen.getByLabelText("Eigene Nachricht")).toHaveTextContent("Hi zurueck");
  });

  it("disabled Senden-Button wenn Body leer oder pending", () => {
    sendState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: true,
    };
    renderPanel();
    expect(screen.getByRole("button", { name: /…/ })).toBeDisabled();
  });

  it("zeigt Locked-Hinweis statt Input wenn isLocked", () => {
    renderPanel({ isLocked: true });
    expect(screen.getByText(/Engagement beendet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Senden/ })).toBeNull();
  });

  it("trimt Body und sendet getrimmten Text", async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/Neue Nachricht/), {
      target: { value: "  Hi  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Senden/ }));
    await waitFor(() => expect(sendState.value.mutateAsync).toHaveBeenCalledWith("Hi"));
  });

  it("ruft mark_messages_read wenn fremde unread Messages existieren", () => {
    msgState.value = {
      data: [msg({ sender_id: "other", read_at: null })],
      isLoading: false,
      error: null,
    };
    renderPanel();
    expect(markReadState.value.mutate).toHaveBeenCalled();
  });

  it("ruft mark_messages_read NICHT wenn alle Messages eigen sind", () => {
    msgState.value = {
      data: [msg({ sender_id: "me", read_at: null })],
      isLoading: false,
      error: null,
    };
    renderPanel();
    expect(markReadState.value.mutate).not.toHaveBeenCalled();
  });

  it("ruft mark_messages_read NICHT wenn isLocked", () => {
    msgState.value = {
      data: [msg({ sender_id: "other", read_at: null })],
      isLoading: false,
      error: null,
    };
    renderPanel({ isLocked: true });
    expect(markReadState.value.mutate).not.toHaveBeenCalled();
  });

  it("zeigt Doppel-Check (✓✓) bei eigener Message mit read_at", () => {
    msgState.value = {
      data: [msg({ sender_id: "me", read_at: "2026-05-01T13:00:00Z", body: "Hi" })],
      isLoading: false,
      error: null,
    };
    renderPanel();
    expect(screen.getByLabelText("Gelesen")).toBeInTheDocument();
    expect(screen.queryByLabelText("Gesendet")).toBeNull();
  });

  it("zeigt Einzel-Check (✓) bei eigener Message ohne read_at", () => {
    msgState.value = {
      data: [msg({ sender_id: "me", read_at: null, body: "Hi" })],
      isLoading: false,
      error: null,
    };
    renderPanel();
    expect(screen.getByLabelText("Gesendet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Gelesen")).toBeNull();
  });

  it("zeigt KEINE Checkmarks bei fremden Messages", () => {
    msgState.value = {
      data: [msg({ sender_id: "other", read_at: null })],
      isLoading: false,
      error: null,
    };
    renderPanel();
    expect(screen.queryByLabelText("Gesendet")).toBeNull();
    expect(screen.queryByLabelText("Gelesen")).toBeNull();
  });
});
