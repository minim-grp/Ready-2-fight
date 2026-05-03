import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CoachWeekCalendarCard } from "./CoachWeekCalendarCard";
import type { CoachWeekEvent } from "../../hooks/queries/useCoachDashboard";

type State = {
  data: CoachWeekEvent[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const state: { value: State } = {
  value: { data: [], isLoading: false, error: null },
};

vi.mock("../../hooks/queries/useCoachDashboard", () => ({
  useCoachWeekEvents: () => state.value,
}));

function renderCard() {
  return render(
    <MemoryRouter>
      <CoachWeekCalendarCard />
    </MemoryRouter>,
  );
}

describe("CoachWeekCalendarCard", () => {
  beforeEach(() => {
    state.value = { data: [], isLoading: false, error: null };
  });

  it("zeigt Loading-State", () => {
    state.value = { data: undefined, isLoading: true, error: null };
    renderCard();
    expect(screen.getByText(/Lade Kalender/)).toBeInTheDocument();
  });

  it("zeigt Error-State", () => {
    state.value = { data: undefined, isLoading: false, error: new Error("boom") };
    renderCard();
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht geladen/);
  });

  it("zeigt Empty-State", () => {
    state.value = { data: [], isLoading: false, error: null };
    renderCard();
    expect(screen.getByText(/Keine Sessions oder Wettkaempfe/)).toBeInTheDocument();
  });

  it("rendert Sessions + Wettkaempfe mit Athleten-Link", () => {
    state.value = {
      data: [
        {
          date: "2026-05-03",
          type: "session",
          athlete_id: "a1",
          athlete_name: "Lena",
          title: "Krafttraining",
          plan_id: "p1",
        },
        {
          date: "2026-05-05",
          type: "competition",
          athlete_id: "a2",
          athlete_name: "Ben",
          title: "Bayerische Meisterschaft",
          plan_id: null,
        },
      ],
      isLoading: false,
      error: null,
    };
    renderCard();
    expect(screen.getByText("Krafttraining")).toBeInTheDocument();
    expect(screen.getByText("Bayerische Meisterschaft")).toBeInTheDocument();
    expect(screen.getByText("Lena")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.getByText(/Session/)).toBeInTheDocument();
    expect(screen.getByText(/Wettkampf/)).toBeInTheDocument();
  });
});
