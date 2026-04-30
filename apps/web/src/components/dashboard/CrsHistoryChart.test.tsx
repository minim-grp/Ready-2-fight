import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrsHistoryChart } from "./CrsHistoryChart";
import type { CrsHistoryPoint } from "../../hooks/queries/useCrsHistory";

type QueryState = {
  data: CrsHistoryPoint[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const state: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

vi.mock("../../hooks/queries/useCrsHistory", () => ({
  useCrsHistory: () => state.value,
}));

function setQuery(next: QueryState) {
  state.value = next;
}

describe("CrsHistoryChart", () => {
  beforeEach(() => {
    setQuery({ data: undefined, isLoading: true, error: null });
  });

  it("zeigt Loading-State", () => {
    setQuery({ data: undefined, isLoading: true, error: null });
    render(<CrsHistoryChart />);
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Score-Verlauf/i);
  });

  it("zeigt Error-State", () => {
    setQuery({ data: undefined, isLoading: false, error: new Error("boom") });
    render(<CrsHistoryChart />);
    expect(screen.getByRole("alert")).toHaveTextContent(/konnte nicht geladen werden/i);
  });

  it("zeigt Empty-State wenn keine Tests", () => {
    setQuery({ data: [], isLoading: false, error: null });
    render(<CrsHistoryChart />);
    expect(screen.getByText(/Noch keine abgeschlossenen Tests/i)).toBeInTheDocument();
  });

  it("rendert SVG mit Kreisen je Test", () => {
    setQuery({
      data: [
        { test_id: "t1", score: 50, rank: "C", completed_at: "2026-03-01T10:00:00Z" },
        { test_id: "t2", score: 65, rank: "B", completed_at: "2026-04-01T10:00:00Z" },
        { test_id: "t3", score: 72, rank: "B", completed_at: "2026-04-30T10:00:00Z" },
      ],
      isLoading: false,
      error: null,
    });
    render(<CrsHistoryChart />);
    const img = screen.getByRole("img");
    expect(img.querySelectorAll("circle")).toHaveLength(3);
    expect(img).toHaveAttribute("aria-label", expect.stringMatching(/Score 72/));
  });

  it("zeigt Delta zum Startwert", () => {
    setQuery({
      data: [
        { test_id: "t1", score: 50, rank: "C", completed_at: "2026-03-01T10:00:00Z" },
        { test_id: "t2", score: 72, rank: "B", completed_at: "2026-04-30T10:00:00Z" },
      ],
      isLoading: false,
      error: null,
    });
    render(<CrsHistoryChart />);
    expect(screen.getByText(/\+22 Pkt/)).toBeInTheDocument();
  });

  it("rendert auch mit nur einem Test (zentrierter Punkt)", () => {
    setQuery({
      data: [
        { test_id: "t1", score: 50, rank: "C", completed_at: "2026-03-01T10:00:00Z" },
      ],
      isLoading: false,
      error: null,
    });
    render(<CrsHistoryChart />);
    const img = screen.getByRole("img");
    expect(img.querySelectorAll("circle")).toHaveLength(1);
    expect(screen.getByText(/\+0 Pkt/)).toBeInTheDocument();
  });
});
