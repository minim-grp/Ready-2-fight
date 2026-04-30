import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoodEmojiStrip } from "./MoodEmojiStrip";

describe("MoodEmojiStrip", () => {
  it("rendert 5 Mood-Buttons mit Mondphasen-Labels", () => {
    render(<MoodEmojiStrip label="Stimmung" value="" onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "Sehr schlecht" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Schlecht" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Neutral" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Gut" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sehr gut" })).toBeInTheDocument();
  });

  it("ruft onChange mit dem Mood-Wert beim Klick", () => {
    const onChange = vi.fn();
    render(<MoodEmojiStrip label="Stimmung" value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Sehr gut" }));
    expect(onChange).toHaveBeenCalledWith("sehr_gut");
  });

  it("markiert die aktive Option via aria-checked", () => {
    render(<MoodEmojiStrip label="Stimmung" value="sehr_schlecht" onChange={() => {}} />);
    const active = screen.getByRole("radio", { name: "Sehr schlecht" });
    const inactive = screen.getByRole("radio", { name: "Gut" });
    expect(active).toHaveAttribute("aria-checked", "true");
    expect(inactive).toHaveAttribute("aria-checked", "false");
  });

  it("zeigt Pflichtkennzeichnung wenn required", () => {
    const { container } = render(
      <MoodEmojiStrip label="Stimmung" value="" onChange={() => {}} required />,
    );
    expect(container.querySelector("legend")?.textContent).toContain("*");
  });
});
