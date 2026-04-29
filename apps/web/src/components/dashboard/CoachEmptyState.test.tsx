import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CoachEmptyState } from "./CoachEmptyState";

describe("CoachEmptyState (5c.6)", () => {
  it("zeigt Hero-Headline und CTA-Cards mit Codes- und Engagements-Links", () => {
    render(
      <MemoryRouter>
        <CoachEmptyState />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Noch keine Athleten verbunden/)).toBeInTheDocument();

    const codes = screen.getByRole("link", { name: /Code generieren/i });
    expect(codes).toHaveAttribute("href", "/app/codes");

    const eng = screen.getByRole("link", { name: /Athleten verwalten/i });
    expect(eng).toHaveAttribute("href", "/app/engagements");

    expect(screen.getByText(/Plan-Builder folgt in Sprint 7/)).toBeInTheDocument();
  });
});
