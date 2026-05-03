import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AthletePlanDetailPage } from "./AthletePlanDetailPage";
import type {
  AthletePlanWithSessions,
  SessionCompletion,
} from "../hooks/queries/useAthletePlans";

type PlanState = {
  data: AthletePlanWithSessions | null | undefined;
  isLoading: boolean;
  error: Error | null;
};
type CompletionsState = {
  data: SessionCompletion[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const profileState: {
  value: { data: { role: string } | null; isLoading: boolean; error: Error | null };
} = {
  value: { data: { role: "athlete" }, isLoading: false, error: null },
};
const planState: { value: PlanState } = {
  value: { data: undefined, isLoading: true, error: null },
};
const completionsState: { value: CompletionsState } = {
  value: { data: [], isLoading: false, error: null },
};

vi.mock("../hooks/queries/useProfile", () => ({
  useProfile: () => profileState.value,
}));
vi.mock("../stores/mode", () => ({
  useModeStore: (sel: (s: { mode: string }) => unknown) => sel({ mode: "athlete" }),
}));
vi.mock("../hooks/queries/useAthletePlans", () => ({
  useAthletePlan: () => planState.value,
  usePlanCompletions: () => completionsState.value,
  useAthleteSessionExercises: () => ({ data: [], isLoading: false, error: null }),
  useToggleSessionCompletion: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderPage(planId = "p1") {
  return render(
    <MemoryRouter initialEntries={[`/app/plan/${planId}`]}>
      <Routes>
        <Route path="/app/plan/:id" element={<AthletePlanDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function plan(overrides: Partial<AthletePlanWithSessions> = {}): AthletePlanWithSessions {
  return {
    id: "p1",
    owner_id: "c1",
    athlete_id: "a1",
    title: "Wettkampf-Cut",
    description: "6 Wochen",
    starts_on: null,
    ends_on: null,
    archived_at: null,
    created_at: "2026-04-30T00:00:00Z",
    updated_at: "2026-04-30T00:00:00Z",
    coach_name: "Karl",
    sessions: [
      {
        id: "s1",
        plan_id: "p1",
        day_offset: 0,
        title: "Krafttraining",
        notes: null,
        position: 0,
      },
      {
        id: "s2",
        plan_id: "p1",
        day_offset: 1,
        title: "Cardio",
        notes: null,
        position: 1,
      },
    ],
    ...overrides,
  };
}

describe("AthletePlanDetailPage", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "athlete" }, isLoading: false, error: null };
    planState.value = { data: undefined, isLoading: true, error: null };
    completionsState.value = { data: [], isLoading: false, error: null };
  });

  it("zeigt Loading-State", () => {
    renderPage();
    expect(screen.getByText(/Lade Plan …/)).toBeInTheDocument();
  });

  it("zeigt Error-State", () => {
    planState.value = { data: undefined, isLoading: false, error: new Error("boom") };
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/konnte nicht geladen/);
  });

  it("zeigt Not-found-State wenn data=null", () => {
    planState.value = { data: null, isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/nicht gefunden/)).toBeInTheDocument();
  });

  it("rendert Header mit Coach + Titel + Progress", () => {
    planState.value = { data: plan(), isLoading: false, error: null };
    completionsState.value = {
      data: [
        {
          id: "c1",
          session_id: "s1",
          athlete_id: "a1",
          completed_at: "2026-04-30T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText("Coach: Karl")).toBeInTheDocument();
    expect(screen.getByText("Wettkampf-Cut")).toBeInTheDocument();
    expect(screen.getByText("1/2 Sessions erledigt")).toBeInTheDocument();
    expect(screen.getByText("Krafttraining")).toBeInTheDocument();
    expect(screen.getByText("Cardio")).toBeInTheDocument();
  });

  it("zeigt Empty-State wenn Plan ohne Sessions", () => {
    planState.value = {
      data: plan({ sessions: [] }),
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText(/noch keine Sessions/)).toBeInTheDocument();
  });

  it("redirected wenn nicht Athlet-View", () => {
    profileState.value = { data: { role: "coach" }, isLoading: false, error: null };
    planState.value = { data: plan(), isLoading: false, error: null };
    renderPage();
    expect(screen.queryByText("Wettkampf-Cut")).toBeNull();
  });
});
