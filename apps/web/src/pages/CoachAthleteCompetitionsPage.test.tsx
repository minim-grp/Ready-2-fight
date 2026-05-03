import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CoachAthleteCompetitionsPage } from "./CoachAthleteCompetitionsPage";
import type { AthleteCompetition } from "../hooks/queries/useAthleteCompetitions";
import type { EngagementRow } from "../hooks/queries/useEngagements";

type CompState = {
  data: AthleteCompetition[] | undefined;
  isLoading: boolean;
  error: Error | null;
};
type EngState = {
  data: EngagementRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const profileState: {
  value: { data: { role: string } | null; isLoading: boolean; error: Error | null };
} = {
  value: { data: { role: "coach" }, isLoading: false, error: null },
};
const engState: { value: EngState } = {
  value: { data: [], isLoading: false, error: null },
};
const compState: { value: CompState } = {
  value: { data: [], isLoading: false, error: null },
};

vi.mock("../hooks/queries/useProfile", () => ({
  useProfile: () => profileState.value,
}));
vi.mock("../stores/mode", () => ({
  useModeStore: (sel: (s: { mode: string }) => unknown) => sel({ mode: "coach" }),
}));
vi.mock("../hooks/queries/useEngagements", () => ({
  useEngagements: () => engState.value,
}));
vi.mock("../hooks/queries/useAthleteCompetitions", () => ({
  useAthleteCompetitions: () => compState.value,
}));

function eng(overrides: Partial<EngagementRow> = {}): EngagementRow {
  return {
    id: "e1",
    coach_id: "c1",
    athlete_id: "a1",
    purpose: "general",
    status: "active",
    end_reason: null,
    started_at: "2026-04-01",
    ended_at: null,
    can_see_tracking: true,
    can_see_meals: false,
    can_see_tests: false,
    can_create_plans: false,
    coach_name: "Coach",
    athlete_name: "Lena",
    ...overrides,
  };
}

function comp(overrides: Partial<AthleteCompetition> = {}): AthleteCompetition {
  return {
    id: "comp-1",
    athlete_id: "a1",
    title: "Bayerische Meisterschaft",
    competition_date: "2030-06-15",
    discipline: "Boxen",
    weight_class: "-72 kg",
    location: "Muenchen",
    result: null,
    notes: null,
    ...overrides,
  };
}

function renderPage(athleteId = "a1") {
  return render(
    <MemoryRouter initialEntries={[`/app/athletes/${athleteId}/competitions`]}>
      <Routes>
        <Route
          path="/app/athletes/:athleteId/competitions"
          element={<CoachAthleteCompetitionsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CoachAthleteCompetitionsPage", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "coach" }, isLoading: false, error: null };
    engState.value = { data: [], isLoading: false, error: null };
    compState.value = { data: [], isLoading: false, error: null };
  });

  it("zeigt 'kein Engagement'-Hinweis ohne aktivem Engagement", () => {
    engState.value = { data: [], isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/Kein aktives Engagement/)).toBeInTheDocument();
  });

  it("zeigt Permission-Hinweis wenn can_see_tracking=false", () => {
    engState.value = {
      data: [eng({ can_see_tracking: false })],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText(/Permission "Tracking sehen" fehlt/)).toBeInTheDocument();
  });

  it("zeigt Empty-State bei vorhandener Permission ohne Wettkaempfe", () => {
    engState.value = { data: [eng()], isLoading: false, error: null };
    compState.value = { data: [], isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/noch keine Wettkaempfe eingetragen/)).toBeInTheDocument();
  });

  it("trennt anstehende und vergangene Wettkaempfe", () => {
    engState.value = { data: [eng()], isLoading: false, error: null };
    compState.value = {
      data: [
        comp({ id: "c-future", title: "Zukunft", competition_date: "2030-06-15" }),
        comp({ id: "c-past", title: "Vergangenheit", competition_date: "2020-06-15" }),
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

  it("zeigt Athleten-Name im Header", () => {
    engState.value = {
      data: [eng({ athlete_name: "Lena" })],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText(/Athlet: Lena/)).toBeInTheDocument();
  });

  it("zeigt Loading-State waehrend Wettkaempfe laden", () => {
    engState.value = { data: [eng()], isLoading: false, error: null };
    compState.value = { data: undefined, isLoading: true, error: null };
    renderPage();
    expect(screen.getByText(/Lade Wettkaempfe/)).toBeInTheDocument();
  });

  it("redirected wenn nicht Coach-View", () => {
    profileState.value = { data: { role: "athlete" }, isLoading: false, error: null };
    renderPage();
    expect(screen.queryByRole("heading", { name: /Wettkaempfe/ })).toBeNull();
  });
});
