import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionExercisesPanel } from "./SessionExercisesPanel";
import type { PlanExercise } from "../../hooks/queries/usePlans";

type QueryState = {
  data: PlanExercise[] | undefined;
  isLoading: boolean;
  error: Error | null;
};
type MutationState = {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
};

const exState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};
const createState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("e-new"), isPending: false },
};
const deleteState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};
const swapState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};

vi.mock("../../hooks/queries/usePlans", () => ({
  useSessionExercises: () => exState.value,
  useCreateExercise: () => createState.value,
  useDeleteExercise: () => deleteState.value,
  useSwapExercises: () => swapState.value,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function exercises(count: number): PlanExercise[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `e${i + 1}`,
    session_id: "s1",
    name: `Uebung ${i + 1}`,
    sets: i + 3,
    reps: 8,
    weight_kg: 60,
    duration_sec: null,
    rest_sec: 60,
    notes: null,
    position: i,
  }));
}

describe("SessionExercisesPanel", () => {
  beforeEach(() => {
    exState.value = { data: undefined, isLoading: true, error: null };
    createState.value = {
      mutateAsync: vi.fn().mockResolvedValue("e-new"),
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
  });

  it("zeigt Loading-State", () => {
    exState.value = { data: undefined, isLoading: true, error: null };
    render(<SessionExercisesPanel sessionId="s1" />);
    expect(screen.getByText(/Lade Uebungen/)).toBeInTheDocument();
  });

  it("zeigt Error-State", () => {
    exState.value = { data: undefined, isLoading: false, error: new Error("boom") };
    render(<SessionExercisesPanel sessionId="s1" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/konnten nicht geladen/);
  });

  it("zeigt Empty-Hint wenn keine Uebungen", () => {
    exState.value = { data: [], isLoading: false, error: null };
    render(<SessionExercisesPanel sessionId="s1" />);
    expect(screen.getByText(/Noch keine Uebung/)).toBeInTheDocument();
  });

  it("rendert Uebungen mit Summary-Zeile", () => {
    exState.value = { data: exercises(2), isLoading: false, error: null };
    render(<SessionExercisesPanel sessionId="s1" />);
    expect(screen.getByText("Uebung 1")).toBeInTheDocument();
    expect(screen.getByText("Uebung 2")).toBeInTheDocument();
    expect(screen.getByText("3×8 · 60 kg · Pause 60 s")).toBeInTheDocument();
  });

  it("AddExerciseForm ruft create mit getrimmten + geparsten Daten", async () => {
    exState.value = { data: [], isLoading: false, error: null };
    render(<SessionExercisesPanel sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Hinzufuegen/ }));
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "  Squat  " },
    });
    fireEvent.change(screen.getByLabelText(/Saetze/), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(/Wdh\./), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("kg"), { target: { value: "82.5" } });
    fireEvent.click(screen.getByRole("button", { name: /Uebung anlegen/ }));
    await waitFor(() =>
      expect(createState.value.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: "s1",
          name: "Squat",
          sets: 4,
          reps: 8,
          weight_kg: 82.5,
          position: 0,
        }),
      ),
    );
  });

  it("Validierungs-Fehler verhindern create (Name fehlt)", () => {
    exState.value = { data: [], isLoading: false, error: null };
    render(<SessionExercisesPanel sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Hinzufuegen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Uebung anlegen/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Name/);
    expect(createState.value.mutateAsync).not.toHaveBeenCalled();
  });

  it("Up- und Down-Buttons disabled an Raendern, swap mid-list", async () => {
    exState.value = { data: exercises(3), isLoading: false, error: null };
    render(<SessionExercisesPanel sessionId="s1" />);
    expect(screen.getByRole("button", { name: /Uebung 1 nach oben/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Uebung 3 nach unten/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Uebung 2 nach unten/ }));
    await waitFor(() => {
      expect(swapState.value.mutateAsync).toHaveBeenCalledTimes(1);
    });
    const arg = swapState.value.mutateAsync.mock.calls[0]?.[0] as {
      session_id: string;
      a: { id: string };
      b: { id: string };
    };
    expect(arg.session_id).toBe("s1");
    expect(arg.a.id).toBe("e2");
    expect(arg.b.id).toBe("e3");
  });

  it("Loeschen oeffnet ConfirmDialog, mutateAsync erst nach Bestaetigung", async () => {
    exState.value = { data: exercises(1), isLoading: false, error: null };
    render(<SessionExercisesPanel sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Uebung 1 loeschen/ }));
    expect(screen.getByText(/Uebung loeschen\?/)).toBeInTheDocument();
    expect(deleteState.value.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Ja, loeschen/ }));
    await waitFor(() =>
      expect(deleteState.value.mutateAsync).toHaveBeenCalledWith({
        id: "e1",
        session_id: "s1",
      }),
    );
  });
});
