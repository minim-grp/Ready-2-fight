import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AthletePlanPage } from "./AthletePlanPage";
import type { AthletePlan } from "../hooks/queries/useAthletePlans";

type QueryState = {
  data: AthletePlan[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const profileState: {
  value: { data: { role: string } | null; isLoading: boolean; error: Error | null };
} = {
  value: { data: { role: "athlete" }, isLoading: false, error: null },
};
const plansState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

vi.mock("../hooks/queries/useProfile", () => ({
  useProfile: () => profileState.value,
}));
vi.mock("../stores/mode", () => ({
  useModeStore: (sel: (s: { mode: string }) => unknown) => sel({ mode: "athlete" }),
}));
vi.mock("../hooks/queries/useAthletePlans", () => ({
  useAthletePlans: () => plansState.value,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AthletePlanPage />
    </MemoryRouter>,
  );
}

function plan(overrides: Partial<AthletePlan> = {}): AthletePlan {
  return {
    id: "p1",
    owner_id: "c1",
    athlete_id: "a1",
    title: "Wettkampf-Cut",
    description: "Aufbau",
    starts_on: "2026-05-01",
    ends_on: "2026-06-01",
    archived_at: null,
    created_at: "2026-04-30T00:00:00Z",
    updated_at: "2026-04-30T00:00:00Z",
    coach_name: "Karl",
    ...overrides,
  };
}

describe("AthletePlanPage", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "athlete" }, isLoading: false, error: null };
    plansState.value = { data: undefined, isLoading: true, error: null };
  });

  it("zeigt Loading-State", () => {
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
    expect(screen.getByText(/noch keinen zugewiesenen Plan/)).toBeInTheDocument();
  });

  it("rendert Plan-Card mit Titel, Coach, Datum", () => {
    plansState.value = {
      data: [plan()],
      isLoading: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText("Wettkampf-Cut")).toBeInTheDocument();
    expect(screen.getByText("Coach: Karl")).toBeInTheDocument();
    expect(screen.getByText("2026-05-01 → 2026-06-01")).toBeInTheDocument();
  });

  it("redirected wenn nicht Athlet-View", () => {
    profileState.value = { data: { role: "coach" }, isLoading: false, error: null };
    plansState.value = { data: [], isLoading: false, error: null };
    renderPage();
    expect(screen.queryByText(/Mein Training/)).toBeNull();
  });
});
