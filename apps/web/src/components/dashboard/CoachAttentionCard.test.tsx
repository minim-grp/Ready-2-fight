import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CoachAttentionCard } from "./CoachAttentionCard";
import type { CoachAttentionItem } from "../../hooks/queries/useCoachDashboard";

type State = {
  data: CoachAttentionItem[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const state: { value: State } = {
  value: { data: [], isLoading: false, error: null },
};

vi.mock("../../hooks/queries/useCoachDashboard", () => ({
  useCoachAttentionItems: () => state.value,
}));

function renderCard() {
  return render(
    <MemoryRouter>
      <CoachAttentionCard />
    </MemoryRouter>,
  );
}

describe("CoachAttentionCard", () => {
  beforeEach(() => {
    state.value = { data: [], isLoading: false, error: null };
  });

  it("zeigt Loading-State", () => {
    state.value = { data: undefined, isLoading: true, error: null };
    renderCard();
    expect(screen.getByText(/Lade Hinweise/)).toBeInTheDocument();
  });

  it("zeigt Error-State", () => {
    state.value = { data: undefined, isLoading: false, error: new Error("boom") };
    renderCard();
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht geladen/);
  });

  it("zeigt Empty-State", () => {
    state.value = { data: [], isLoading: false, error: null };
    renderCard();
    expect(screen.getByText(/Alles ruhig/)).toBeInTheDocument();
  });

  it("rendert tracking_overdue + upcoming_competition mit deutschen Labels", () => {
    state.value = {
      data: [
        {
          athlete_id: "a1",
          athlete_name: "Lena",
          rule: "tracking_overdue",
          detail: "Letztes Tracking: 2026-04-25",
        },
        {
          athlete_id: "a2",
          athlete_name: "Ben",
          rule: "upcoming_competition",
          detail: "Cup am 2026-05-10",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderCard();
    expect(screen.getByText(/Tracking ueberfaellig/)).toBeInTheDocument();
    expect(screen.getByText(/Wettkampf naht/)).toBeInTheDocument();
    expect(screen.getByText("Lena")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.getByText(/Letztes Tracking: 2026-04-25/)).toBeInTheDocument();
    expect(screen.getByText(/Cup am 2026-05-10/)).toBeInTheDocument();
  });
});
