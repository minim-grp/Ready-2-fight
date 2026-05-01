import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlansPage } from "./PlansPage";
import type { CoachPlan } from "../hooks/queries/usePlans";

type QueryState = {
  data: CoachPlan[] | undefined;
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
const plansState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};
const createState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("new-plan-id"), isPending: false },
};
const deleteState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};
const cloneState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("p-clone"), isPending: false },
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
  useCoachPlans: () => plansState.value,
  useCreatePlan: () => createState.value,
  useDeletePlan: () => deleteState.value,
  useClonePlan: () => cloneState.value,
  useArchivePlan: () => archiveState.value,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderPage() {
  return render(
    <MemoryRouter>
      <PlansPage />
    </MemoryRouter>,
  );
}

describe("PlansPage", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "coach" }, isLoading: false, error: null };
    plansState.value = { data: undefined, isLoading: true, error: null };
    createState.value = {
      mutateAsync: vi.fn().mockResolvedValue("new-plan-id"),
      isPending: false,
    };
    deleteState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    cloneState.value = {
      mutateAsync: vi.fn().mockResolvedValue("p-clone"),
      isPending: false,
    };
    archiveState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
  });

  it("zeigt Loading-State", () => {
    plansState.value = { data: undefined, isLoading: true, error: null };
    renderPage();
    expect(screen.getByText(/Lade Plaene/)).toBeInTheDocument();
  });

  it("zeigt Error-State", () => {
    plansState.value = { data: undefined, isLoading: false, error: new Error("boom") };
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/konnten nicht geladen/);
  });

  it("zeigt Empty-State wenn keine Plaene", () => {
    plansState.value = { data: [], isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/Noch kein Plan angelegt/)).toBeInTheDocument();
  });

  it("rendert Plan-Cards mit Titel + Subtitle", () => {
    plansState.value = {
      data: [
        {
          id: "p1",
          owner_id: "c1",
          athlete_id: null,
          athlete_name: null,
          title: "Boxen 4 Wochen",
          description: "Aufbau-Phase",
          is_template: true,
          archived_at: null,
          starts_on: null,
          ends_on: null,
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
        {
          id: "p2",
          owner_id: "c1",
          athlete_id: "a1",
          athlete_name: "Lena",
          title: "Wettkampf-Cut",
          description: null,
          is_template: false,
          archived_at: null,
          starts_on: "2026-05-01",
          ends_on: "2026-06-01",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText("Boxen 4 Wochen")).toBeInTheDocument();
    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(screen.getByText("Wettkampf-Cut")).toBeInTheDocument();
    expect(screen.getByText("Athlet: Lena")).toBeInTheDocument();
    expect(screen.getByText("2026-05-01 → 2026-06-01")).toBeInTheDocument();
  });

  it("oeffnet Create-Modal beim Klick auf Neuer Plan", () => {
    plansState.value = { data: [], isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Neuer Plan/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Plan anlegen/ })).toBeInTheDocument();
  });

  it("Create-Modal ruft mutateAsync mit getrimmten Daten", async () => {
    plansState.value = { data: [], isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Neuer Plan/ }));
    fireEvent.change(screen.getByLabelText(/Titel/), {
      target: { value: "  Mein Template  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Plan anlegen/ }));
    await waitFor(() =>
      expect(createState.value.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Mein Template",
          is_template: true,
          athlete_id: null,
        }),
      ),
    );
  });

  it("Loeschen-Button oeffnet ConfirmDialog, mutateAsync erst nach Bestaetigung", async () => {
    plansState.value = {
      data: [
        {
          id: "p1",
          owner_id: "c1",
          athlete_id: null,
          athlete_name: null,
          title: "X",
          description: null,
          is_template: true,
          archived_at: null,
          starts_on: null,
          ends_on: null,
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Plan X loeschen/ }));
    expect(screen.getByText(/Plan loeschen\?/)).toBeInTheDocument();
    expect(deleteState.value.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Ja, loeschen/ }));
    await waitFor(() => expect(deleteState.value.mutateAsync).toHaveBeenCalledWith("p1"));
  });

  it("Kopie-Button ruft clone_plan-Mutation mit Plan-ID", async () => {
    plansState.value = {
      data: [
        {
          id: "p1",
          owner_id: "c1",
          athlete_id: null,
          athlete_name: null,
          title: "Boxen 4 Wochen",
          description: null,
          is_template: true,
          archived_at: null,
          starts_on: null,
          ends_on: null,
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Plan Boxen 4 Wochen kopieren/ }));
    await waitFor(() => expect(cloneState.value.mutateAsync).toHaveBeenCalledWith("p1"));
  });

  it("filtert archivierte Plaene per Default und zeigt Toggle bei archivierten Eintraegen", () => {
    plansState.value = {
      data: [
        {
          id: "p1",
          owner_id: "c1",
          athlete_id: null,
          athlete_name: null,
          title: "Aktiver Plan",
          description: null,
          is_template: true,
          archived_at: null,
          starts_on: null,
          ends_on: null,
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
        {
          id: "p2",
          owner_id: "c1",
          athlete_id: null,
          athlete_name: null,
          title: "Alter Plan",
          description: null,
          is_template: true,
          archived_at: "2026-04-29T00:00:00Z",
          starts_on: null,
          ends_on: null,
          created_at: "2026-04-29T00:00:00Z",
          updated_at: "2026-04-29T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText("Aktiver Plan")).toBeInTheDocument();
    expect(screen.queryByText("Alter Plan")).toBeNull();

    const toggle = screen.getByLabelText(/Archivierte anzeigen/);
    fireEvent.click(toggle);
    expect(screen.getByText("Alter Plan")).toBeInTheDocument();
    expect(screen.getAllByText(/Archiviert/)[0]).toBeInTheDocument();
  });

  it("Archivieren-Button ruft mutateAsync mit archive=true", async () => {
    plansState.value = {
      data: [
        {
          id: "p1",
          owner_id: "c1",
          athlete_id: null,
          athlete_name: null,
          title: "Aktiver Plan",
          description: null,
          is_template: true,
          archived_at: null,
          starts_on: null,
          ends_on: null,
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: /Plan Aktiver Plan archivieren/ }),
    );
    await waitFor(() =>
      expect(archiveState.value.mutateAsync).toHaveBeenCalledWith({
        plan_id: "p1",
        archive: true,
      }),
    );
  });

  it("Wiederherstellen-Button ruft mutateAsync mit archive=false", async () => {
    plansState.value = {
      data: [
        {
          id: "p1",
          owner_id: "c1",
          athlete_id: null,
          athlete_name: null,
          title: "Alter Plan",
          description: null,
          is_template: true,
          archived_at: "2026-04-29T00:00:00Z",
          starts_on: null,
          ends_on: null,
          created_at: "2026-04-29T00:00:00Z",
          updated_at: "2026-04-29T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    fireEvent.click(screen.getByLabelText(/Archivierte anzeigen/));
    fireEvent.click(
      screen.getByRole("button", { name: /Plan Alter Plan wiederherstellen/ }),
    );
    await waitFor(() =>
      expect(archiveState.value.mutateAsync).toHaveBeenCalledWith({
        plan_id: "p1",
        archive: false,
      }),
    );
  });

  it("redirected wenn nicht Coach-View", () => {
    profileState.value = { data: { role: "athlete" }, isLoading: false, error: null };
    plansState.value = { data: [], isLoading: false, error: null };
    renderPage();
    expect(screen.queryByText(/Plaene/)).toBeNull();
  });
});
