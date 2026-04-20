import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CrsTestPage } from "./CrsTestPage";

type Mutation<TArgs, TResult> = {
  mutateAsync: (args: TArgs) => Promise<TResult>;
  isPending: boolean;
};

const startState: { value: Mutation<unknown, string> } = {
  value: { mutateAsync: vi.fn<(a: unknown) => Promise<string>>(), isPending: false },
};
const saveState: { value: Mutation<unknown, void> } = {
  value: { mutateAsync: vi.fn<(a: unknown) => Promise<void>>(), isPending: false },
};
const completeState: { value: Mutation<string, string> } = {
  value: { mutateAsync: vi.fn<(a: string) => Promise<string>>(), isPending: false },
};
const abortState: { value: Mutation<string, void> } = {
  value: { mutateAsync: vi.fn<(a: string) => Promise<void>>(), isPending: false },
};

vi.mock("../hooks/queries/useCrsTest", () => ({
  useStartCrsTest: () => startState.value,
  useSaveCrsExercise: () => saveState.value,
  useCompleteCrsTest: () => completeState.value,
  useAbortCrsTest: () => abortState.value,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderPage() {
  return render(
    <MemoryRouter>
      <CrsTestPage />
    </MemoryRouter>,
  );
}

describe("CrsTestPage state machine", () => {
  beforeEach(() => {
    startState.value = {
      mutateAsync: vi.fn<(a: unknown) => Promise<string>>().mockResolvedValue("test-id"),
      isPending: false,
    };
    saveState.value = {
      mutateAsync: vi.fn<(a: unknown) => Promise<void>>().mockResolvedValue(undefined),
      isPending: false,
    };
    completeState.value = {
      mutateAsync: vi.fn<(a: string) => Promise<string>>().mockResolvedValue("ts"),
      isPending: false,
    };
    abortState.value = {
      mutateAsync: vi.fn<(a: string) => Promise<void>>().mockResolvedValue(undefined),
      isPending: false,
    };
  });

  it("Start-Button disabled bis Disclaimer akzeptiert", () => {
    renderPage();
    const btn = screen.getByRole("button", { name: /Test starten/ });
    expect(btn).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(btn).not.toBeDisabled();
  });

  it("Start ruft start_crs_test und wechselt in Warm-up", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() => expect(startState.value.mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByText(/Warm-up 1 \/ 3/)).toBeInTheDocument();
    });
  });

  it("Abbrechen ruft abort_crs_test wenn testId gesetzt", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Abbrechen/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Abbrechen/ }));
    await waitFor(() =>
      expect(abortState.value.mutateAsync).toHaveBeenCalledWith("test-id"),
    );
    confirmSpy.mockRestore();
  });

  it("Input-Step lehnt unplausibel hohe Werte lokal ab", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    // In Warm-up 1 -> ueberspringen 3x, dann Countdown Uebung 1 -> ueberspringen
    await waitFor(() => expect(screen.getByText(/Warm-up 1 \/ 3/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fertig, Wert eingeben/ }));
    const input = await screen.findByRole("spinbutton");
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByText(/Obergrenze/)).toBeInTheDocument();
    expect(saveState.value.mutateAsync).not.toHaveBeenCalled();
  });
});
