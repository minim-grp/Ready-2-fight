import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";
import type { Notification } from "../../hooks/queries/useNotifications";

type QueryState = {
  data: Notification[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const queryState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

const markReadMock = vi.fn();
const markAllMock = vi.fn();
const subscribeMock = vi.fn();

vi.mock("../../hooks/queries/useNotifications", () => ({
  useNotifications: () => queryState.value,
  useUnreadNotificationsCount: () =>
    (queryState.value.data ?? []).filter((n) => n.read === false).length,
  useNotificationsSubscription: () => {
    subscribeMock();
  },
  useMarkNotificationRead: () => ({
    mutate: markReadMock,
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutate: markAllMock,
    isPending: false,
  }),
}));

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? "n1",
    user_id: "u1",
    type: "achievement",
    title: "Neuer Erfolg",
    body: "Glueckwunsch!",
    data: null,
    read: false,
    created_at: "2026-05-02T08:00:00Z",
    ...overrides,
  } as Notification;
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T10:00:00Z"));
    queryState.value = { data: undefined, isLoading: true, error: null };
    markReadMock.mockReset();
    markAllMock.mockReset();
    subscribeMock.mockReset();
  });

  it("ruft die Realtime-Subscription auf", () => {
    render(<NotificationBell />);
    expect(subscribeMock).toHaveBeenCalled();
  });

  it("zeigt keinen Badge ohne ungelesene Benachrichtigungen", () => {
    queryState.value = {
      data: [makeNotif({ read: true })],
      isLoading: false,
      error: null,
    };
    render(<NotificationBell />);
    expect(screen.getByLabelText("Benachrichtigungen oeffnen")).toBeInTheDocument();
  });

  it("zeigt Anzahl ungelesener Benachrichtigungen im Badge + aria-label", () => {
    queryState.value = {
      data: [
        makeNotif({ id: "a" }),
        makeNotif({ id: "b" }),
        makeNotif({ id: "c", read: true }),
      ],
      isLoading: false,
      error: null,
    };
    render(<NotificationBell />);
    expect(
      screen.getByLabelText("Benachrichtigungen oeffnen (2 ungelesen)"),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("badge zeigt 9+ bei mehr als 9 ungelesenen", () => {
    queryState.value = {
      data: Array.from({ length: 12 }, (_, i) => makeNotif({ id: `n${i}` })),
      isLoading: false,
      error: null,
    };
    render(<NotificationBell />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("oeffnet Panel mit Liste und markiert ungelesene Notifikation beim Klick", () => {
    queryState.value = {
      data: [makeNotif({ id: "n1", title: "Erfolg A" })],
      isLoading: false,
      error: null,
    };
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText(/Benachrichtigungen oeffnen/));
    expect(
      screen.getByRole("dialog", { name: "Benachrichtigungen" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Erfolg A (ungelesen)"));
    expect(markReadMock).toHaveBeenCalledWith("n1");
  });

  it("klick auf bereits gelesene Notifikation triggert kein mark-read", () => {
    queryState.value = {
      data: [makeNotif({ id: "n2", title: "Gelesen", read: true })],
      isLoading: false,
      error: null,
    };
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText(/Benachrichtigungen oeffnen/));
    fireEvent.click(screen.getByLabelText("Gelesen"));
    expect(markReadMock).not.toHaveBeenCalled();
  });

  it("Alle-als-gelesen-Button triggert markAll, ist disabled ohne ungelesene", () => {
    queryState.value = {
      data: [makeNotif({ id: "n1" }), makeNotif({ id: "n2", read: true })],
      isLoading: false,
      error: null,
    };
    const { rerender } = render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText(/Benachrichtigungen oeffnen/));
    const btn = screen.getByText("Alle als gelesen markieren");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(markAllMock).toHaveBeenCalled();

    queryState.value = {
      data: [makeNotif({ id: "n1", read: true })],
      isLoading: false,
      error: null,
    };
    rerender(<NotificationBell />);
    expect(screen.getByText("Alle als gelesen markieren")).toBeDisabled();
  });

  it("zeigt Empty-State wenn keine Notifikationen geladen sind", () => {
    queryState.value = { data: [], isLoading: false, error: null };
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText(/Benachrichtigungen oeffnen/));
    expect(screen.getByText("Keine Benachrichtigungen.")).toBeInTheDocument();
  });

  it("zeigt Error-State bei Fehler", () => {
    queryState.value = { data: undefined, isLoading: false, error: new Error("boom") };
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText(/Benachrichtigungen oeffnen/));
    expect(screen.getByRole("alert")).toHaveTextContent(/konnte/i);
  });

  it("Escape schliesst das Panel", () => {
    queryState.value = { data: [], isLoading: false, error: null };
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText(/Benachrichtigungen oeffnen/));
    expect(
      screen.getByRole("dialog", { name: "Benachrichtigungen" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Benachrichtigungen" }),
    ).not.toBeInTheDocument();
  });
});
