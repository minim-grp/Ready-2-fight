import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AthleteSessionCard } from "./AthleteSessionCard";
import type {
  AthletePlanExercise,
  AthletePlanSession,
  SessionCompletion,
} from "../../hooks/queries/useAthletePlans";

type QueryState = {
  data: AthletePlanExercise[] | undefined;
  isLoading: boolean;
  error: Error | null;
};
type MutationState = {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
};

const exState: { value: QueryState } = {
  value: { data: [], isLoading: false, error: null },
};
const toggleState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};

vi.mock("../../hooks/queries/useAthletePlans", () => ({
  useAthleteSessionExercises: () => exState.value,
  useToggleSessionCompletion: () => toggleState.value,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const SESSION: AthletePlanSession = {
  id: "s1",
  plan_id: "p1",
  day_offset: 0,
  title: "Krafttraining",
  notes: "Locker einlaufen",
  position: 0,
};

function renderCard(completion: SessionCompletion | undefined = undefined) {
  return render(
    <AthleteSessionCard planId="p1" session={SESSION} completion={completion} />,
  );
}

describe("AthleteSessionCard", () => {
  beforeEach(() => {
    exState.value = { data: [], isLoading: false, error: null };
    toggleState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
  });

  it("rendert Session-Titel + Tag-Label + Notiz", () => {
    renderCard();
    expect(screen.getByText("Krafttraining")).toBeInTheDocument();
    expect(screen.getByText(/Tag 1/)).toBeInTheDocument();
    expect(screen.getByText("Locker einlaufen")).toBeInTheDocument();
  });

  it("zeigt Abhaken-Button wenn nicht erledigt", () => {
    renderCard();
    const btn = screen.getByRole("button", { name: /Krafttraining abhaken/ });
    expect(btn).toHaveTextContent("Abhaken");
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("zeigt Erledigt-Button wenn Completion vorhanden", () => {
    renderCard({
      id: "c1",
      session_id: "s1",
      athlete_id: "a1",
      completed_at: "2026-04-30T00:00:00Z",
    });
    const btn = screen.getByRole("button", { name: /Krafttraining zuruecksetzen/ });
    expect(btn).toHaveTextContent(/Erledigt/);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("Klick im not-done-Zustand inserted Completion (completion_id=null)", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Krafttraining abhaken/ }));
    await waitFor(() =>
      expect(toggleState.value.mutateAsync).toHaveBeenCalledWith({
        session_id: "s1",
        completion_id: null,
      }),
    );
  });

  it("Klick im done-Zustand loescht Completion", async () => {
    renderCard({
      id: "c-existing",
      session_id: "s1",
      athlete_id: "a1",
      completed_at: "2026-04-30T00:00:00Z",
    });
    fireEvent.click(screen.getByRole("button", { name: /Krafttraining zuruecksetzen/ }));
    await waitFor(() =>
      expect(toggleState.value.mutateAsync).toHaveBeenCalledWith({
        session_id: "s1",
        completion_id: "c-existing",
      }),
    );
  });

  it("rendert Uebungen mit Sets×Reps + Gewicht + Notiz", () => {
    exState.value = {
      data: [
        {
          id: "e1",
          session_id: "s1",
          name: "Kniebeuge",
          sets: 4,
          reps: 8,
          weight_kg: 80,
          duration_sec: null,
          rest_sec: null,
          notes: "tief",
          position: 0,
        },
      ],
      isLoading: false,
      error: null,
    };
    renderCard();
    expect(screen.getByText("Kniebeuge")).toBeInTheDocument();
    expect(screen.getByText(/4 × 8/)).toBeInTheDocument();
    expect(screen.getByText(/80 kg/)).toBeInTheDocument();
    expect(screen.getByText(/tief/)).toBeInTheDocument();
  });

  it("zeigt Empty-State fuer Uebungen", () => {
    renderCard();
    expect(screen.getByText(/Keine Uebungen hinterlegt/)).toBeInTheDocument();
  });
});
