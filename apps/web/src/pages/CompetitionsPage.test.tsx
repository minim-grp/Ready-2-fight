import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CompetitionsPage } from "./CompetitionsPage";
import type { Competition } from "../hooks/queries/useCompetitions";

type QueryState = {
  data: Competition[] | undefined;
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
  value: { data: { role: "athlete" }, isLoading: false, error: null },
};
const compsState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};
const createState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("c-new"), isPending: false },
};
const updateState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};
const deleteState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};

vi.mock("../hooks/queries/useProfile", () => ({
  useProfile: () => profileState.value,
}));
vi.mock("../stores/mode", () => ({
  useModeStore: (sel: (s: { mode: string }) => unknown) => sel({ mode: "athlete" }),
}));
vi.mock("../hooks/queries/useCompetitions", () => ({
  useCompetitions: () => compsState.value,
  useCreateCompetition: () => createState.value,
  useUpdateCompetition: () => updateState.value,
  useDeleteCompetition: () => deleteState.value,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function comp(overrides: Partial<Competition> = {}): Competition {
  return {
    id: "c1",
    athlete_id: "a1",
    title: "Bayerische Meisterschaft",
    competition_date: "2030-06-15",
    discipline: "Boxen",
    weight_class: "-72 kg",
    location: "Muenchen",
    result: null,
    notes: null,
    created_at: "2026-04-30T00:00:00Z",
    updated_at: "2026-04-30T00:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CompetitionsPage />
    </MemoryRouter>,
  );
}

describe("CompetitionsPage", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "athlete" }, isLoading: false, error: null };
    compsState.value = { data: undefined, isLoading: true, error: null };
    createState.value = {
      mutateAsync: vi.fn().mockResolvedValue("c-new"),
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
  });

  it("zeigt Loading-State", () => {
    renderPage();
    expect(screen.getByText(/Lade Wettkaempfe/)).toBeInTheDocument();
  });

  it("zeigt Error-State", () => {
    compsState.value = { data: undefined, isLoading: false, error: new Error("boom") };
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/konnten nicht geladen/);
  });

  it("zeigt Empty-State wenn keine Wettkaempfe", () => {
    compsState.value = { data: [], isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/Noch kein Wettkampf/)).toBeInTheDocument();
  });

  it("trennt anstehende und vergangene Wettkaempfe", () => {
    compsState.value = {
      data: [
        comp({ id: "c1", title: "Zukunft", competition_date: "2030-06-15" }),
        comp({ id: "c2", title: "Vergangenheit", competition_date: "2020-06-15" }),
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText("Anstehend")).toBeInTheDocument();
    expect(screen.getByText("Vergangen")).toBeInTheDocument();
    expect(screen.getByText("Zukunft")).toBeInTheDocument();
    expect(screen.getByText("Vergangenheit")).toBeInTheDocument();
  });

  it("oeffnet Create-Modal bei Klick auf Neuer Wettkampf", () => {
    compsState.value = { data: [], isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Neuer Wettkampf/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Wettkampf anlegen/ }),
    ).toBeInTheDocument();
  });

  it("Create-Modal ruft mutateAsync mit getrimmten Daten", async () => {
    compsState.value = { data: [], isLoading: false, error: null };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Neuer Wettkampf/ }));
    fireEvent.change(screen.getByLabelText(/Titel/), {
      target: { value: "  Cup  " },
    });
    fireEvent.change(screen.getByLabelText(/Datum/), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Anlegen$/ }));
    await waitFor(() =>
      expect(createState.value.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Cup",
          competition_date: "2026-09-01",
          discipline: null,
        }),
      ),
    );
  });

  it("Edit-Button oeffnet Modal mit hydratisierten Daten", () => {
    compsState.value = {
      data: [comp({ title: "Cup", discipline: "Boxen" })],
      isLoading: false,
      error: null,
    };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Wettkampf Cup bearbeiten/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/Titel/)).toHaveValue("Cup");
    expect(screen.getByLabelText(/Disziplin/)).toHaveValue("Boxen");
  });

  it("Loeschen-Button oeffnet ConfirmDialog, mutateAsync erst nach Bestaetigung", async () => {
    compsState.value = {
      data: [comp({ title: "Cup" })],
      isLoading: false,
      error: null,
    };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Wettkampf Cup loeschen/ }));
    expect(screen.getByText(/Wettkampf loeschen\?/)).toBeInTheDocument();
    expect(deleteState.value.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Ja, loeschen/ }));
    await waitFor(() => expect(deleteState.value.mutateAsync).toHaveBeenCalledWith("c1"));
  });

  it("redirected wenn nicht Athlet-View", () => {
    profileState.value = { data: { role: "coach" }, isLoading: false, error: null };
    compsState.value = { data: [], isLoading: false, error: null };
    renderPage();
    expect(screen.queryByText(/Wettkaempfe/)).toBeNull();
  });
});
