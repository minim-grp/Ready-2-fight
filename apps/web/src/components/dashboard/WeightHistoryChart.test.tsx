import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeightHistoryChart } from "./WeightHistoryChart";
import type { WeightPoint } from "../../hooks/queries/useWeightHistory";

type QueryState = {
  data: WeightPoint[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const state: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

vi.mock("../../hooks/queries/useWeightHistory", () => ({
  useWeightHistory: () => state.value,
}));

function setQuery(next: QueryState) {
  state.value = next;
}

describe("WeightHistoryChart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T10:00:00Z"));
  });

  it("zeigt Loading-State", () => {
    setQuery({ data: undefined, isLoading: true, error: null });
    render(<WeightHistoryChart />);
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Gewichtsverlauf/i);
  });

  it("zeigt Error-State", () => {
    setQuery({ data: undefined, isLoading: false, error: new Error("boom") });
    render(<WeightHistoryChart />);
    expect(screen.getByRole("alert")).toHaveTextContent(/konnte nicht geladen werden/i);
  });

  it("zeigt Empty-State wenn keine Messungen", () => {
    setQuery({ data: [], isLoading: false, error: null });
    render(<WeightHistoryChart />);
    expect(screen.getByText(/Noch keine Gewichtsdaten/i)).toBeInTheDocument();
  });

  it("rendert SVG mit Kreisen je Messung", () => {
    setQuery({
      data: [
        { date: "2026-04-10", weight_kg: 80 },
        { date: "2026-04-15", weight_kg: 79.5 },
        { date: "2026-04-19", weight_kg: 79 },
      ],
      isLoading: false,
      error: null,
    });
    render(<WeightHistoryChart />);
    const img = screen.getByRole("img");
    expect(img.querySelectorAll("circle")).toHaveLength(3);
    expect(img).toHaveAttribute("aria-label", expect.stringMatching(/79\.0 kg/));
  });

  it("zeigt Veraenderung zum Startwert", () => {
    setQuery({
      data: [
        { date: "2026-04-10", weight_kg: 80 },
        { date: "2026-04-19", weight_kg: 78.5 },
      ],
      isLoading: false,
      error: null,
    });
    render(<WeightHistoryChart />);
    expect(screen.getByText(/-1\.5 kg/)).toBeInTheDocument();
  });

  it("wechselt Zeitfenster-Button auf aria-pressed", () => {
    setQuery({ data: [], isLoading: false, error: null });
    render(<WeightHistoryChart />);
    const btn7 = screen.getByRole("button", { name: "7 Tage" });
    fireEvent.click(btn7);
    expect(btn7).toHaveAttribute("aria-pressed", "true");
  });
});
