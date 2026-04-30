import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrsSparkline } from "./CrsSparkline";

describe("CrsSparkline", () => {
  it("rendert nichts bei < 2 Punkten", () => {
    const { container } = render(
      <CrsSparkline
        points={[
          { test_id: "t1", score: 50, rank: "C", completed_at: "2026-03-01T10:00:00Z" },
        ]}
      />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("rendert SVG mit Punkten und Delta-Aria-Label", () => {
    render(
      <CrsSparkline
        points={[
          { test_id: "t1", score: 50, rank: "C", completed_at: "2026-03-01T10:00:00Z" },
          { test_id: "t2", score: 65, rank: "B", completed_at: "2026-04-01T10:00:00Z" },
          { test_id: "t3", score: 72, rank: "B", completed_at: "2026-04-30T10:00:00Z" },
        ]}
      />,
    );
    const img = screen.getByRole("img");
    expect(img.querySelectorAll("circle")).toHaveLength(3);
    expect(img).toHaveAttribute("aria-label", expect.stringMatching(/3 Tests · Δ \+22/));
  });
});
