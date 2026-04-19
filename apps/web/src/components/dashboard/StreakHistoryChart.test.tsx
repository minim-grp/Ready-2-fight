import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StreakHistoryChart } from "./StreakHistoryChart";

type QueryState = {
  data: string[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

const state: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

vi.mock("../../hooks/queries/useTrackingHistory", () => ({
  useTrackingHistory: () => state.value,
}));

function setQuery(next: QueryState) {
  state.value = next;
}

describe("StreakHistoryChart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T10:00:00Z"));
  });

  it("zeigt Loading-State", () => {
    setQuery({ data: undefined, isLoading: true, error: null });
    render(<StreakHistoryChart />);
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Historie/i);
  });

  it("zeigt Error-State", () => {
    setQuery({ data: undefined, isLoading: false, error: new Error("boom") });
    render(<StreakHistoryChart />);
    expect(screen.getByRole("alert")).toHaveTextContent(/konnte nicht geladen werden/i);
  });

  it("rendert leeres 7-Tage-Grid mit 7 Zellen wenn keine getrackten Tage", () => {
    setQuery({ data: [], isLoading: false, error: null });
    render(<StreakHistoryChart />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("aria-label", "0 von 7 Tagen getrackt");
    expect(img.querySelectorAll("rect")).toHaveLength(7);
    expect(img.querySelectorAll("rect.fill-orange-400")).toHaveLength(0);
  });

  it("zaehlt nur getrackte Tage innerhalb des Fensters", () => {
    setQuery({
      data: ["2026-04-19", "2026-04-18", "2026-04-13", "2026-04-01"],
      isLoading: false,
      error: null,
    });
    render(<StreakHistoryChart />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "3 von 7 Tagen getrackt",
    );
  });

  it("wechselt auf 30-Tage-Fenster bei Klick und rendert 30 Zellen", () => {
    setQuery({ data: [], isLoading: false, error: null });
    render(<StreakHistoryChart />);

    const btn30 = screen.getByRole("button", { name: "30 Tage" });
    fireEvent.click(btn30);

    expect(btn30).toHaveAttribute("aria-pressed", "true");
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("aria-label", "0 von 30 Tagen getrackt");
    expect(img.querySelectorAll("rect")).toHaveLength(30);
  });

  it("setzt aria-pressed initial auf 7-Tage-Button", () => {
    setQuery({ data: [], isLoading: false, error: null });
    render(<StreakHistoryChart />);
    expect(screen.getByRole("button", { name: "7 Tage" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "30 Tage" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
