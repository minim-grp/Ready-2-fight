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

vi.mock("../../hooks/queries/useChat", () => ({
  useChatMessages: () => msgState.value,
  useSendMessage: () => sendState.value,
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
});
