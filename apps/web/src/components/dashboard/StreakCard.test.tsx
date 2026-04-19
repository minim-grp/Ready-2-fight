import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakCard } from "./StreakCard";
import type { Streak } from "../../hooks/queries/useStreak";

type QueryState = {
  data: Streak | null | undefined;
  isLoading: boolean;
  error: Error | null;
};

const state: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

vi.mock("../../hooks/queries/useStreak", () => ({
  useStreak: () => state.value,
}));

function setQuery(next: QueryState) {
  state.value = next;
}

function makeStreak(overrides: Partial<Streak> = {}): Streak {
  return {
    user_id: "u1",
    current_streak: 5,
    longest_streak: 12,
    last_tracked_date: "2026-04-19",
    ...overrides,
  } as Streak;
}

describe("StreakCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T10:00:00Z"));
  });

  it("zeigt Loading-State", () => {
    setQuery({ data: undefined, isLoading: true, error: null });
    render(<StreakCard />);
    expect(screen.getByText(/Lade Streak/i)).toBeInTheDocument();
  });

  it("zeigt Error-State bei Query-Fehler", () => {
    setQuery({ data: undefined, isLoading: false, error: new Error("boom") });
    render(<StreakCard />);
    expect(screen.getByRole("alert")).toHaveTextContent(/konnte nicht geladen werden/i);
  });

  it("zeigt Empty-State wenn keine Streak-Row existiert", () => {
    setQuery({ data: null, isLoading: false, error: null });
    render(<StreakCard />);
    expect(screen.getByText(/Noch keine Streak/i)).toBeInTheDocument();
  });

  it("zeigt Empty-State wenn current_streak 0 ist", () => {
    setQuery({
      data: makeStreak({ current_streak: 0, last_tracked_date: null }),
      isLoading: false,
      error: null,
    });
    render(<StreakCard />);
    expect(screen.getByText(/Noch keine Streak/i)).toBeInTheDocument();
  });

  it("rendert Zahl + longest_streak ohne Karenz-Badge wenn heute getrackt", () => {
    setQuery({
      data: makeStreak({
        current_streak: 7,
        longest_streak: 21,
        last_tracked_date: "2026-04-19",
      }),
      isLoading: false,
      error: null,
    });
    render(<StreakCard />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText(/Laengste Streak/i)).toHaveTextContent("21");
    expect(screen.queryByLabelText("In Karenz")).not.toBeInTheDocument();
  });

  it("zeigt Karenz-Badge wenn gestern zuletzt getrackt", () => {
    setQuery({
      data: makeStreak({
        current_streak: 3,
        longest_streak: 10,
        last_tracked_date: "2026-04-18",
      }),
      isLoading: false,
      error: null,
    });
    render(<StreakCard />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByLabelText("In Karenz")).toBeInTheDocument();
  });
});
