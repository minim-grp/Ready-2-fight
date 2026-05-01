import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlanDetailPage } from "./PlanDetailPage";
import type { PlanWithSessions } from "../hooks/queries/usePlans";

type QueryState = {
  data: PlanWithSessions | null | undefined;
  isLoading: boolean;
  error: Error | null;
};
type MutationState = {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
};

const profileState: {
  value: { data: { role: string } | null; isLoading: boolean; error: Error | null };
} = {
  value: { data: { role: "coach" }, isLoading: false, error: null },
};
const planState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};
const createState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("s-new"), isPending: false },
};
const updateState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};
const deleteState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};
const swapState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};
const archiveState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};

vi.mock("../hooks/queries/useProfile", () => ({
  useProfile: () => profileState.value,
}));
vi.mock("../stores/mode", () => ({
  useModeStore: (sel: (s: { mode: string }) => unknown) => sel({ mode: "coach" }),
}));
vi.mock("../hooks/queries/usePlans", () => ({
  usePlan: () => planState.value,
  useCreateSession: () => createState.value,
  useUpdateSession: () => updateState.value,
  useDeleteSession: () => deleteState.value,
  useSwapSessions: () => swapState.value,
  useArchivePlan: () => archiveState.value,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function planWith(sessionsCount: number): PlanWithSessions {
  return {
    id: "p1",
    owner_id: "c1",
    athlete_id: null,
    athlete_name: null,
    title: "Boxen 4 Wochen",
    description: "Aufbau",
    is_template: true,
    archived_at: null,
    starts_on: null,
    ends_on: null,
    created_at: "2026-04-30T00:00:00Z",
    updated_at: "2026-04-30T00:00:00Z",
    sessions: Array.from({ length: sessionsCount }).map((_, i) => ({
      id: `s${i + 1}`,
      plan_id: "p1",
      day_offset: i,
      title: `Session ${i + 1}`,
      notes: null,
      position: i,
    })),
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/plans/p1"]}>
      <Routes>
        <Route path="/app/plans/:id" element={<PlanDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PlanDetailPage", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "coach" }, isLoading: false, error: null };
    planState.value = { data: undefined, isLoading: true, error: null };
    createState.value = {
      mutateAsync: vi.fn().mockResolvedValue("s-new"),
      isPending: false,
    };
    updateState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    deleteState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    swapState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    archiveState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
  });

  it("zeigt Loading-State", () => {
    planState.value = { data: undefined, isLoading: true, error: null };
    renderPage();
    expect(screen.getByText(/Lade Plan/)).toBeInTheDocument();
  });

  it("zeigt Empty-State wenn keine Sessions", () => {
    planState.value = { data: planWith(0), isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/Noch keine Sessions/)).toBeInTheDocument();
  });

  it("rendert Plan-Header und Session-Liste", () => {
    planState.value = { data: planWith(2), isLoading: false, error: null };
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Boxen 4 Wochen");
    expect(screen.getByText(/Sessions \(2\)/)).toBeInTheDocument();
    expect(screen.getByText("Session 1")).toBeInTheDocument();
    expect(screen.getByText("Session 2")).toBeInTheDocument();
  });

  it("oeffnet AddSessionForm und ruft create mit getrimmten Daten", async () => {
    planState.value = { data: planWith(0), isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Session hinzufuegen/ }));
    fireEvent.change(screen.getByLabelText(/Titel/), {
      target: { value: "  Kraft  " },
    });
    fireEvent.change(screen.getByLabelText(/Tag/), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Session anlegen/ }));
    await waitFor(() =>
      expect(createState.value.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: "p1",
          title: "Kraft",
          day_offset: 3,
          position: 0,
        }),
      ),
    );
  });

  it("Up-Button ist disabled fuer erste Session, Down fuer letzte", () => {
    planState.value = { data: planWith(2), isLoading: false, error: null };
    renderPage();
    expect(screen.getByRole("button", { name: /Session 1 nach oben/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Session 2 nach unten/ })).toBeDisabled();
  });

  it("Down-Button ruft swap mit korrekten Sessions", async () => {
    planState.value = { data: planWith(2), isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Session 1 nach unten/ }));
    await waitFor(() => {
      expect(swapState.value.mutateAsync).toHaveBeenCalledTimes(1);
    });
    const arg = swapState.value.mutateAsync.mock.calls[0]?.[0] as {
      plan_id: string;
      a: { id: string };
      b: { id: string };
    };
    expect(arg.plan_id).toBe("p1");
    expect(arg.a.id).toBe("s1");
    expect(arg.b.id).toBe("s2");
  });

  it("Loeschen oeffnet ConfirmDialog, mutateAsync erst nach Bestaetigung", async () => {
    planState.value = { data: planWith(1), isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Session 1 loeschen/ }));
    expect(screen.getByText(/Session loeschen\?/)).toBeInTheDocument();
    expect(deleteState.value.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Ja, loeschen/ }));
    await waitFor(() =>
      expect(deleteState.value.mutateAsync).toHaveBeenCalledWith({
        id: "s1",
        plan_id: "p1",
      }),
    );
  });

  it("Inline-Edit Title commit ruft update mit getrimmtem Titel", async () => {
    planState.value = { data: planWith(1), isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Session 1 bearbeiten/ }));
    const input = screen.getByLabelText(/Session-Titel bearbeiten/);
    fireEvent.change(input, { target: { value: "  Neuer Titel  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(updateState.value.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: "s1", title: "Neuer Titel", plan_id: "p1" }),
      ),
    );
  });

  it("Inline-Edit Escape verwirft Edit ohne update-Aufruf", () => {
    planState.value = { data: planWith(1), isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Session 1 bearbeiten/ }));
    const input = screen.getByLabelText(/Session-Titel bearbeiten/);
    fireEvent.change(input, { target: { value: "Aufgabe" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(updateState.value.mutateAsync).not.toHaveBeenCalled();
  });

  it("Archivieren-Button ruft mutateAsync mit archive=true", async () => {
    planState.value = { data: planWith(1), isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Archivieren$/ }));
    await waitFor(() =>
      expect(archiveState.value.mutateAsync).toHaveBeenCalledWith({
        plan_id: "p1",
        archive: true,
      }),
    );
  });

  it("zeigt Archiviert-Badge + Wiederherstellen-Button bei archived_at", async () => {
    planState.value = {
      data: { ...planWith(1), archived_at: "2026-04-29T00:00:00Z" },
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText("Archiviert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Wiederherstellen$/ }));
    await waitFor(() =>
      expect(archiveState.value.mutateAsync).toHaveBeenCalledWith({
        plan_id: "p1",
        archive: false,
      }),
    );
  });

  it("Plan-not-found zeigt Hinweis + Zurueck-Link", () => {
    planState.value = { data: null, isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/Plan nicht gefunden/)).toBeInTheDocument();
  });
});
