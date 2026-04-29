import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CodesPage } from "./CodesPage";
import type { Profile } from "../hooks/queries/useProfile";
import type { GeneratedCode } from "../hooks/queries/useGenerateEngagementCode";

type ProfileQueryState = {
  data: Profile | undefined;
  isLoading: boolean;
  error: Error | null;
};

type MutationState = {
  mutateAsync: (input: unknown) => Promise<GeneratedCode>;
  isPending: boolean;
  error: Error | null;
};

const profileState: { value: ProfileQueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

const modeState: { value: "athlete" | "coach" } = { value: "coach" };

const mutationState: { value: MutationState } = {
  value: {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  },
};

vi.mock("../hooks/queries/useProfile", () => ({
  useProfile: () => profileState.value,
}));

vi.mock("../stores/mode", () => ({
  useModeStore: <T,>(selector: (s: { mode: "athlete" | "coach" }) => T) =>
    selector({ mode: modeState.value }),
}));

vi.mock("../hooks/queries/useGenerateEngagementCode", () => ({
  useGenerateEngagementCode: () => mutationState.value,
}));

vi.mock("../components/codes/CodesList", () => ({
  CodesList: () => <div data-testid="codes-list-mock" />,
}));

function setProfile(role: Profile["role"], overrides: Partial<ProfileQueryState> = {}) {
  profileState.value = {
    data: {
      id: "u1",
      display_name: "Coach Carter",
      role,
      level: 1,
      level_title: "Recruit",
      xp_total: 0,
      ai_consent: false,
      onboarding_done: true,
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function setMutation(next: Partial<MutationState>) {
  mutationState.value = { ...mutationState.value, ...next };
}

describe("CodesPage", () => {
  beforeEach(() => {
    profileState.value = { data: undefined, isLoading: true, error: null };
    modeState.value = "coach";
    mutationState.value = {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    };
  });

  it("zeigt Loading-State", () => {
    render(<CodesPage />);
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Profil/i);
  });

  it("zeigt Profil-Error", () => {
    profileState.value = { data: undefined, isLoading: false, error: new Error("boom") };
    render(<CodesPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht geladen/i);
  });

  it("verweigert Athleten den Zugriff auf das Formular", () => {
    setProfile("athlete");
    render(<CodesPage />);
    expect(screen.queryByLabelText(/Internes Label/i)).not.toBeInTheDocument();
    expect(screen.getByText(/nur Coaches/i)).toBeInTheDocument();
  });

  it("verweigert Both-User im Athlete-Modus", () => {
    setProfile("both");
    modeState.value = "athlete";
    render(<CodesPage />);
    expect(screen.queryByLabelText(/Internes Label/i)).not.toBeInTheDocument();
    expect(screen.getByText(/nur Coaches/i)).toBeInTheDocument();
  });

  it("rendert das Formular fuer Coach", () => {
    setProfile("coach");
    render(<CodesPage />);
    expect(screen.getByLabelText(/Internes Label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Anzahl Einloesungen/i)).toHaveValue(1);
    expect(screen.getByLabelText(/Gueltigkeit in Tagen/i)).toHaveValue(7);
    expect(screen.getByRole("button", { name: /Code erstellen/i })).toBeEnabled();
    expect(screen.getByTestId("codes-list-mock")).toBeInTheDocument();
  });

  it("rendert das Formular fuer Both im Coach-Modus", () => {
    setProfile("both");
    modeState.value = "coach";
    render(<CodesPage />);
    expect(screen.getByLabelText(/Internes Label/i)).toBeInTheDocument();
  });

  it("zeigt Validierungsfehler bei ungueltiger Eingabe nach Submit", () => {
    setProfile("coach");
    render(<CodesPage />);
    fireEvent.change(screen.getByLabelText(/Anzahl Einloesungen/i), {
      target: { value: "11" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Code erstellen/i }));
    expect(screen.getByText(/Zwischen 1 und 10/)).toBeInTheDocument();
    expect(mutationState.value.mutateAsync).not.toHaveBeenCalled();
  });

  it("ruft mutateAsync mit getrimmten Werten auf und zeigt den generierten Code", async () => {
    setProfile("coach");
    const mutateAsync = vi.fn().mockResolvedValue({
      code: "AB12CD34",
      expiresAt: "2026-04-26T10:00:00Z",
    });
    setMutation({ mutateAsync });

    render(<CodesPage />);
    fireEvent.change(screen.getByLabelText(/Internes Label/i), {
      target: { value: "  Lena  " },
    });
    fireEvent.change(screen.getByLabelText(/Anzahl Einloesungen/i), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/Gueltigkeit in Tagen/i), {
      target: { value: "14" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Code erstellen/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        internalLabel: "  Lena  ",
        maxUses: 2,
        validDays: 14,
      });
    });

    expect(await screen.findByText("AB12CD34")).toBeInTheDocument();
    expect(screen.getByText(/26\.04\.2026/)).toBeInTheDocument();
  });

  it("zeigt mapped error bei RPC-Fehler", () => {
    setProfile("coach");
    setMutation({ error: new Error("not_a_coach") });
    render(<CodesPage />);
    expect(screen.getByText(/Nur Coaches/i)).toBeInTheDocument();
  });

  it("disabled Button im Pending-State", () => {
    setProfile("coach");
    setMutation({ isPending: true });
    render(<CodesPage />);
    expect(screen.getByRole("button", { name: /Erstelle …/i })).toBeDisabled();
  });
});
