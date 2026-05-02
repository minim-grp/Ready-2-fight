import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EngagementsList } from "./EngagementsList";
import type { EngagementRow } from "../../hooks/queries/useEngagements";

// MemoryRouter-Wrapper noetig wegen <Link> auf /app/chat/:engagementId (§1.29).
function render(ui: React.ReactElement) {
  return rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
}

type QueryState = {
  data: EngagementRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

type MutationState = {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  error: Error | null;
};

const queryState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};
const authState: { userId: string; email: string } = {
  userId: "athlete-u1",
  email: "x@y.de",
};

const pauseState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("ts"), isPending: false, error: null },
};
const resumeState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("ts"), isPending: false, error: null },
};
const endState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("ts"), isPending: false, error: null },
};

const signInMock =
  vi.fn<
    (args: { email: string; password: string }) => Promise<{ error: Error | null }>
  >();

vi.mock("../../hooks/queries/useEngagements", () => ({
  useEngagements: () => queryState.value,
}));

vi.mock("../../hooks/queries/useEngagementLifecycle", () => ({
  usePauseEngagement: () => pauseState.value,
  useResumeEngagement: () => resumeState.value,
  useEndEngagement: () => endState.value,
}));

vi.mock("../../stores/auth", () => ({
  useAuthStore: <T,>(
    selector: (s: { user: { id: string; email: string } | null }) => T,
  ) => selector({ user: { id: authState.userId, email: authState.email } }),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (args: { email: string; password: string }) => signInMock(args),
    },
  },
}));

function row(overrides: Partial<EngagementRow> = {}): EngagementRow {
  return {
    id: "e-1",
    coach_id: "coach-u1",
    athlete_id: "athlete-u1",
    purpose: "general",
    status: "active",
    end_reason: null,
    started_at: "2026-04-01T00:00:00Z",
    ended_at: null,
    can_see_tracking: true,
    can_see_meals: false,
    can_see_tests: true,
    can_create_plans: true,
    coach_name: "Coach Karl",
    athlete_name: "Athlet Anna",
    ...overrides,
  };
}

beforeEach(() => {
  queryState.value = { data: undefined, isLoading: true, error: null };
  authState.userId = "athlete-u1";
  authState.email = "a@x.de";
  pauseState.value = {
    mutateAsync: vi.fn().mockResolvedValue("ts"),
    isPending: false,
    error: null,
  };
  resumeState.value = {
    mutateAsync: vi.fn().mockResolvedValue("ts"),
    isPending: false,
    error: null,
  };
  endState.value = {
    mutateAsync: vi.fn().mockResolvedValue("ts"),
    isPending: false,
    error: null,
  };
  signInMock.mockReset();
  signInMock.mockResolvedValue({ error: null });
});

describe("EngagementsList", () => {
  it("zeigt Loading", () => {
    render(<EngagementsList />);
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Engagements/i);
  });

  it("zeigt Error", () => {
    queryState.value = { data: undefined, isLoading: false, error: new Error("x") };
    render(<EngagementsList />);
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht geladen/i);
  });

  it("zeigt Empty-State", () => {
    queryState.value = { data: [], isLoading: false, error: null };
    render(<EngagementsList />);
    expect(screen.getByText(/Noch keine Engagements/i)).toBeInTheDocument();
  });

  it("zeigt aktives Engagement mit Pausieren + Beenden (Athlet-Sicht)", () => {
    queryState.value = {
      data: [row({ status: "active" })],
      isLoading: false,
      error: null,
    };
    render(<EngagementsList />);
    expect(screen.getByText(/Coach Karl/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pausieren/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Beenden/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Fortsetzen/i })).not.toBeInTheDocument();
  });

  it("zeigt pausiertes Engagement mit Fortsetzen", () => {
    queryState.value = {
      data: [row({ status: "paused" })],
      isLoading: false,
      error: null,
    };
    render(<EngagementsList />);
    expect(screen.getByRole("button", { name: /Fortsetzen/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Pausieren/i })).not.toBeInTheDocument();
  });

  it("zeigt Coach-Sicht mit Athleten-Namen wenn User der Coach ist", () => {
    authState.userId = "coach-u1";
    queryState.value = { data: [row()], isLoading: false, error: null };
    render(<EngagementsList />);
    expect(screen.getByText("Athlet Anna")).toBeInTheDocument();
    expect(screen.queryByText("Coach Karl")).not.toBeInTheDocument();
  });

  it("blendet Aktions-Buttons bei status=ended aus + zeigt end_reason", () => {
    queryState.value = {
      data: [row({ status: "ended", end_reason: "mutual", ended_at: "x" })],
      isLoading: false,
      error: null,
    };
    render(<EngagementsList />);
    expect(screen.queryByRole("button", { name: /Beenden/i })).not.toBeInTheDocument();
    expect(screen.getByText(/einvernehmlich/i)).toBeInTheDocument();
  });

  it("Pausieren ruft pause.mutateAsync", async () => {
    queryState.value = { data: [row()], isLoading: false, error: null };
    render(<EngagementsList />);
    fireEvent.click(screen.getByRole("button", { name: /Pausieren/i }));
    await waitFor(() => {
      expect(pauseState.value.mutateAsync).toHaveBeenCalledWith("e-1");
    });
  });

  it("Beenden oeffnet Reauth-Modal, nicht direkt end.mutateAsync", () => {
    queryState.value = { data: [row()], isLoading: false, error: null };
    render(<EngagementsList />);
    fireEvent.click(screen.getByRole("button", { name: /Beenden/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(endState.value.mutateAsync).not.toHaveBeenCalled();
  });

  it("Reauth-Modal ruft signInWithPassword + danach end.mutateAsync bei Erfolg", async () => {
    queryState.value = { data: [row()], isLoading: false, error: null };
    render(<EngagementsList />);
    fireEvent.click(screen.getByRole("button", { name: /Beenden/i }));
    fireEvent.change(screen.getByLabelText(/Passwort bestaetigen/i), {
      target: { value: "secretPW!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Engagement beenden/i }));
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({ email: "a@x.de", password: "secretPW!" });
    });
    await waitFor(() => {
      expect(endState.value.mutateAsync).toHaveBeenCalledWith({ engagementId: "e-1" });
    });
  });

  it("Reauth bei falschem Passwort ruft end nicht auf und zeigt Fehler", async () => {
    signInMock.mockResolvedValue({ error: new Error("Invalid login credentials") });
    queryState.value = { data: [row()], isLoading: false, error: null };
    render(<EngagementsList />);
    fireEvent.click(screen.getByRole("button", { name: /Beenden/i }));
    fireEvent.change(screen.getByLabelText(/Passwort bestaetigen/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Engagement beenden/i }));
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalled();
    });
    expect(endState.value.mutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText(/Passwort ist falsch/i)).toBeInTheDocument();
  });

  it("rendert Permissions-Chips fuer gewaehrte Rechte (Athlet-Sicht: 'Coach sieht')", () => {
    queryState.value = {
      data: [
        row({
          can_see_tracking: true,
          can_see_meals: false,
          can_see_tests: true,
          can_create_plans: false,
        }),
      ],
      isLoading: false,
      error: null,
    };
    render(<EngagementsList />);
    expect(screen.getByText(/Coach sieht/i)).toBeInTheDocument();
    const chips = screen.getByRole("list", { name: /Coach sieht/i });
    expect(chips).toHaveTextContent("Tracking");
    expect(chips).toHaveTextContent("CRS-Tests");
    expect(chips).not.toHaveTextContent("Ernaehrung");
    expect(chips).not.toHaveTextContent("Plaene erstellen");
  });

  it("zeigt 'keine Berechtigungen' wenn alle Permissions false", () => {
    queryState.value = {
      data: [
        row({
          can_see_tracking: false,
          can_see_meals: false,
          can_see_tests: false,
          can_create_plans: false,
        }),
      ],
      isLoading: false,
      error: null,
    };
    render(<EngagementsList />);
    expect(screen.getByText(/keine Berechtigungen/i)).toBeInTheDocument();
  });

  it("nutzt Coach-Formulierung ('Deine Rechte') wenn User Coach ist", () => {
    authState.userId = "coach-u1";
    queryState.value = { data: [row()], isLoading: false, error: null };
    render(<EngagementsList />);
    expect(screen.getByText(/Deine Rechte/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Coach sieht:/i)).not.toBeInTheDocument();
  });

  it("blendet Permissions-Chips bei status=ended aus", () => {
    queryState.value = {
      data: [row({ status: "ended", end_reason: "mutual", ended_at: "x" })],
      isLoading: false,
      error: null,
    };
    render(<EngagementsList />);
    expect(screen.queryByText(/Coach sieht/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Deine Rechte/i)).not.toBeInTheDocument();
  });

  it("zeigt mehrere Coaches in einer Liste (Athleten-Sicht)", () => {
    queryState.value = {
      data: [
        row({ id: "e-1", coach_id: "c1", coach_name: "Coach Alpha", status: "active" }),
        row({ id: "e-2", coach_id: "c2", coach_name: "Coach Beta", status: "paused" }),
      ],
      isLoading: false,
      error: null,
    };
    render(<EngagementsList />);
    expect(screen.getByText(/Coach Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Coach Beta/)).toBeInTheDocument();
  });

  it("Abbrechen im Modal schliesst ohne Call", () => {
    queryState.value = { data: [row()], isLoading: false, error: null };
    render(<EngagementsList />);
    fireEvent.click(screen.getByRole("button", { name: /Beenden/i }));
    fireEvent.click(screen.getByRole("button", { name: /Abbrechen/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(endState.value.mutateAsync).not.toHaveBeenCalled();
    expect(signInMock).not.toHaveBeenCalled();
  });
});
