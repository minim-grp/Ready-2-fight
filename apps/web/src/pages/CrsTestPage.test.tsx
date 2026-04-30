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
const computeState: { value: Mutation<string, unknown> } = {
  value: { mutateAsync: vi.fn<(a: string) => Promise<unknown>>(), isPending: false },
};

vi.mock("../hooks/queries/useCrsTest", () => ({
  useStartCrsTest: () => startState.value,
  useSaveCrsExercise: () => saveState.value,
  useCompleteCrsTest: () => completeState.value,
  useComputeCrsScore: () => computeState.value,
  useAbortCrsTest: () => abortState.value,
}));

const latestScoreState: {
  value: { data: unknown; isLoading: boolean; error: unknown };
} = {
  value: { data: null, isLoading: false, error: null },
};

vi.mock("../hooks/queries/useLatestCrsScore", () => ({
  useLatestCrsScore: () => latestScoreState.value,
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
    window.localStorage.clear();
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
    computeState.value = {
      mutateAsync: vi.fn<(a: string) => Promise<unknown>>().mockResolvedValue({
        score: 50,
        rank_label: "C",
        archetype: "Rookie",
      }),
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

  it("Start ruft start_crs_test mit client_uuid und wechselt in Warm-up", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() => expect(startState.value.mutateAsync).toHaveBeenCalledTimes(1));
    const arg = (
      startState.value.mutateAsync as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0]?.[0];
    expect(typeof arg).toBe("string");
    expect((arg as string).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByText(/Warm-up 1 \/ 3/)).toBeInTheDocument();
    });
  });

  it("Abbrechen oeffnet Confirm-Modal und ruft abort erst nach Bestaetigung", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Abbrechen/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Abbrechen/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(abortState.value.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Ja, abbrechen/ }));
    await waitFor(() =>
      expect(abortState.value.mutateAsync).toHaveBeenCalledWith("test-id"),
    );
  });

  it("Confirm-Modal `Weiter testen` schliesst Dialog ohne Abort", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Abbrechen/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Abbrechen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Weiter testen/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(abortState.value.mutateAsync).not.toHaveBeenCalled();
  });

  it("Input-Step lehnt unplausibel hohe Werte lokal ab", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
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

describe("CrsTestPage interruption recovery (1.16)", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
    computeState.value = {
      mutateAsync: vi.fn<(a: string) => Promise<unknown>>().mockResolvedValue({
        score: 50,
        rank_label: "C",
        archetype: "Rookie",
      }),
      isPending: false,
    };
  });

  it("Recovery-Banner erscheint, wenn Recovery-State im localStorage liegt", () => {
    window.localStorage.setItem(
      "r2f.crs.recovery",
      JSON.stringify({
        version: 1,
        clientUuid: "uuid-recovery",
        testId: "test-resume",
        step: { kind: "exercise", index: 2, phase: "input" },
        accepted: true,
      }),
    );
    renderPage();
    expect(screen.getByText(/Laufenden Test fortsetzen/)).toBeInTheDocument();
    expect(screen.getByText(/Uebung 3 \/ 5/)).toBeInTheDocument();
  });

  it("Fortsetzen ruft start_crs_test mit gespeicherter client_uuid und springt zum Schritt", async () => {
    window.localStorage.setItem(
      "r2f.crs.recovery",
      JSON.stringify({
        version: 1,
        clientUuid: "uuid-recovery",
        testId: "test-resume",
        step: { kind: "exercise", index: 2, phase: "input" },
        accepted: true,
      }),
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Fortsetzen/ }));
    await waitFor(() =>
      expect(startState.value.mutateAsync).toHaveBeenCalledWith("uuid-recovery"),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Wert eintragen/ })).toBeInTheDocument(),
    );
  });

  it("Neu starten loescht Recovery und zeigt Disclaimer", () => {
    window.localStorage.setItem(
      "r2f.crs.recovery",
      JSON.stringify({
        version: 1,
        clientUuid: "uuid-recovery",
        testId: "test-resume",
        step: { kind: "warmup", round: 1 },
        accepted: true,
      }),
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Neu starten/ }));
    expect(window.localStorage.getItem("r2f.crs.recovery")).toBeNull();
    expect(screen.getByRole("button", { name: /Test starten/ })).toBeInTheDocument();
  });

  it("Disclaimer-Recovery wird ignoriert (kein Fortschritt zu retten)", () => {
    window.localStorage.setItem(
      "r2f.crs.recovery",
      JSON.stringify({
        version: 1,
        clientUuid: "uuid-recovery",
        testId: null,
        step: { kind: "disclaimer" },
        accepted: false,
      }),
    );
    renderPage();
    expect(screen.queryByText(/Laufenden Test fortsetzen/)).toBeNull();
    expect(screen.getByRole("button", { name: /Test starten/ })).toBeInTheDocument();
  });

  it("Start persistiert Recovery, complete loescht sie", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() =>
      expect(window.localStorage.getItem("r2f.crs.recovery")).not.toBeNull(),
    );

    // Skip durch Warm-ups + alle 5 Uebungen + Cool-down
    await waitFor(() => expect(screen.getByText(/Warm-up 1 \/ 3/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));

    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Fertig, Wert eingeben/ }));
      const input = await screen.findByRole("spinbutton");
      fireEvent.change(input, { target: { value: "10" } });
      fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
      await waitFor(() =>
        expect(saveState.value.mutateAsync).toHaveBeenCalledTimes(i + 1),
      );
    }

    fireEvent.click(screen.getByRole("button", { name: /Test abschliessen/ }));
    await waitFor(() => expect(completeState.value.mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(window.localStorage.getItem("r2f.crs.recovery")).toBeNull(),
    );
  });

  it("Abbrechen loescht Recovery (nach Confirm-Bestaetigung)", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() =>
      expect(window.localStorage.getItem("r2f.crs.recovery")).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Abbrechen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ja, abbrechen/ }));
    await waitFor(() =>
      expect(window.localStorage.getItem("r2f.crs.recovery")).toBeNull(),
    );
  });
});

describe("CrsTestPage hi-fi (5c.4)", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
    latestScoreState.value = { data: null, isLoading: false, error: null };
  });

  it("Disclaimer zeigt prominente Stoppe-bei-Liste mit mehreren Signalen", () => {
    renderPage();
    expect(screen.getByText(/Stoppe sofort/i)).toBeInTheDocument();
    expect(screen.getByText(/Druckgefuehl in der Brust/i)).toBeInTheDocument();
    expect(screen.getByText(/Schwindel/i)).toBeInTheDocument();
    expect(screen.getByText(/Atemnot/i)).toBeInTheDocument();
  });

  it("Result-Screen zeigt Score-Hero, Radar-Chart und Pace-Erklaerbarkeit", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() => expect(screen.getByText(/Warm-up 1 \/ 3/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));

    const values = [12, 30, 25, 45, 60];
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Fertig, Wert eingeben/ }));
      const input = await screen.findByRole("spinbutton");
      fireEvent.change(input, { target: { value: String(values[i]) } });
      fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
      await waitFor(() =>
        expect(saveState.value.mutateAsync).toHaveBeenCalledTimes(i + 1),
      );
    }
    fireEvent.click(screen.getByRole("button", { name: /Test abschliessen/ }));
    await waitFor(() => expect(completeState.value.mutateAsync).toHaveBeenCalledTimes(1));

    expect(screen.getByText(/CRS · RANG/)).toBeInTheDocument();
    expect(screen.getByText(/Score wird berechnet/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Radar-Chart/i })).toBeInTheDocument();
    expect(screen.getByText(/Warum diese Zahl\?/)).toBeInTheDocument();
    expect(screen.getByText(/Beste Disziplin/)).toBeInTheDocument();
    expect(screen.getByText(/Verbesserungs-Potenzial/)).toBeInTheDocument();
    expect(screen.getByText(/Archetyp wird berechnet/)).toBeInTheDocument();
  });

  it("Result-Screen rendert Archetyp-Card mit Name + Beschreibung wenn data vorhanden", async () => {
    latestScoreState.value = {
      data: {
        test_id: "t-1",
        score: 72,
        rank: "B",
        archetype: "Berserker",
        completed_at: "2026-04-30T10:00:00Z",
      },
      isLoading: false,
      error: null,
    };
    renderPage();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Test starten/ }));
    await waitFor(() => expect(screen.getByText(/Warm-up 1 \/ 3/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ueberspringen/ }));

    const values = [12, 30, 25, 45, 60];
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Fertig, Wert eingeben/ }));
      const input = await screen.findByRole("spinbutton");
      fireEvent.change(input, { target: { value: String(values[i]) } });
      fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
      await waitFor(() =>
        expect(saveState.value.mutateAsync).toHaveBeenCalledTimes(i + 1),
      );
    }
    fireEvent.click(screen.getByRole("button", { name: /Test abschliessen/ }));
    await waitFor(() => expect(completeState.value.mutateAsync).toHaveBeenCalledTimes(1));

    expect(screen.getByText("Berserker")).toBeInTheDocument();
    expect(screen.getByText(/Druck \+ Dynamik/i)).toBeInTheDocument();
    expect(screen.getByText(/Burpees und Squats setzen den Ton/i)).toBeInTheDocument();
  });
});
