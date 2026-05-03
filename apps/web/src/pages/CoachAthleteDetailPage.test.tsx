import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CoachAthleteDetailPage } from "./CoachAthleteDetailPage";
import type { EngagementRow } from "../hooks/queries/useEngagements";
import type {
  AthleteAssignedPlan,
  AthleteCrsScore,
  AthleteTrackingDay,
} from "../hooks/queries/useCoachAthleteDetail";

type EngState = {
  data: EngagementRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
};
type TrackingState = {
  data: AthleteTrackingDay[] | undefined;
  isLoading: boolean;
  error: Error | null;
};
type CrsState = {
  data: AthleteCrsScore[] | undefined;
  isLoading: boolean;
  error: Error | null;
};
type PlansState = {
  data: AthleteAssignedPlan[] | undefined;
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
const trackState: { value: TrackingState } = {
  value: { data: [], isLoading: false, error: null },
};
const crsState: { value: CrsState } = {
  value: { data: [], isLoading: false, error: null },
};
const plansState: { value: PlansState } = {
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
vi.mock("../hooks/queries/useCoachAthleteDetail", () => ({
  useCoachAthleteTrackingHistory: () => trackState.value,
  useCoachAthleteCrsHistory: () => crsState.value,
  useCoachAthletePlans: () => plansState.value,
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
    can_see_tests: true,
    can_create_plans: true,
    coach_name: "Coach",
    athlete_name: "Lena",
    ...overrides,
  };
}

function renderPage(athleteId = "a1") {
  return render(
    <MemoryRouter initialEntries={[`/app/athletes/${athleteId}`]}>
      <Routes>
        <Route path="/app/athletes/:athleteId" element={<CoachAthleteDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CoachAthleteDetailPage", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "coach" }, isLoading: false, error: null };
    engState.value = { data: [eng()], isLoading: false, error: null };
    trackState.value = { data: [], isLoading: false, error: null };
    crsState.value = { data: [], isLoading: false, error: null };
    plansState.value = { data: [], isLoading: false, error: null };
  });

  it("zeigt Athletennamen + Permission-Badges", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Lena" })).toBeInTheDocument();
    expect(screen.getByText("Tracking")).toBeInTheDocument();
    expect(screen.getByText("CRS-Tests")).toBeInTheDocument();
    expect(screen.getByText("Plaene")).toBeInTheDocument();
    expect(screen.getByText("Mahlzeiten")).toBeInTheDocument();
  });

  it("zeigt 'kein Engagement'-Hinweis ohne aktives Engagement", () => {
    engState.value = { data: [], isLoading: false, error: null };
    renderPage();
    expect(screen.getByText(/Kein aktives Engagement/)).toBeInTheDocument();
  });

  it("rendert alle drei Sections wenn Permissions gesetzt", () => {
    trackState.value = {
      data: [
        {
          date: "2026-04-30",
          trained: true,
          rpe: 7,
          weight_kg: 75,
          mood: "gut",
        },
      ],
      isLoading: false,
      error: null,
    };
    crsState.value = {
      data: [
        {
          test_id: "t1",
          score: 82,
          rank: "Pro",
          completed_at: "2026-04-30T10:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    plansState.value = {
      data: [
        {
          id: "p1",
          title: "Wettkampf-Cut",
          description: null,
          starts_on: "2026-05-01",
          ends_on: "2026-06-01",
          archived_at: null,
          created_at: "2026-04-30T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText(/Tracking-Verlauf/)).toBeInTheDocument();
    expect(screen.getByText(/Trainiert · RPE 7 · 75 kg/)).toBeInTheDocument();
    expect(screen.getByText(/CRS-Verlauf/)).toBeInTheDocument();
    expect(screen.getByText(/Score 82 · Pro/)).toBeInTheDocument();
    expect(screen.getByText(/Trainingsplaene/)).toBeInTheDocument();
    expect(screen.getByText("Wettkampf-Cut")).toBeInTheDocument();
  });

  it("zeigt Permission-Missing-Karten fuer fehlende Permissions", () => {
    engState.value = {
      data: [
        eng({
          can_see_tracking: false,
          can_see_tests: false,
          can_create_plans: false,
        }),
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    // Drei Permission-Missing-Karten (tracking + tests + plans)
    expect(
      screen.getAllByText(/fehlt — Athlet muss sie im Engagement aktivieren/),
    ).toHaveLength(3);
    // Wettkampf-Link erscheint nur bei can_see_tracking=true
    expect(screen.queryByText(/Wettkaempfe ansehen/)).toBeNull();
  });

  it("zeigt Wettkaempfe-Link nur wenn can_see_tracking", () => {
    engState.value = {
      data: [eng({ can_see_tracking: true })],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText(/Wettkaempfe ansehen/)).toBeInTheDocument();
  });

  it("trennt aktive und archivierte Plaene", () => {
    plansState.value = {
      data: [
        {
          id: "p1",
          title: "Aktiv",
          description: null,
          starts_on: null,
          ends_on: null,
          archived_at: null,
          created_at: "2026-04-30T00:00:00Z",
        },
        {
          id: "p2",
          title: "Archiviert",
          description: null,
          starts_on: null,
          ends_on: null,
          archived_at: "2026-04-29T00:00:00Z",
          created_at: "2026-04-29T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText("Aktiv")).toBeInTheDocument();
    // Archived ist im <details> versteckt, aber das Summary ist sichtbar
    expect(screen.getByText(/1 archivierte Plaene/)).toBeInTheDocument();
  });

  it("redirected wenn nicht Coach-View", () => {
    profileState.value = { data: { role: "athlete" }, isLoading: false, error: null };
    renderPage();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});
