import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EngagementsPage } from "./EngagementsPage";
import type { Profile } from "../hooks/queries/useProfile";

type ProfileQueryState = {
  data: Profile | undefined;
  isLoading: boolean;
  error: Error | null;
};

type MutationState = {
  mutateAsync: (code: string) => Promise<string>;
  isPending: boolean;
  error: Error | null;
};

const profileState: { value: ProfileQueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

const modeState: { value: "athlete" | "coach" } = { value: "athlete" };

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

vi.mock("../hooks/queries/useRedeemEngagementCode", () => ({
  useRedeemEngagementCode: () => mutationState.value,
}));

vi.mock("../components/engagements/EngagementsList", () => ({
  EngagementsList: () => <div data-testid="engagements-list" />,
}));

function setProfile(role: Profile["role"], overrides: Partial<ProfileQueryState> = {}) {
  profileState.value = {
    data: {
      id: "u1",
      display_name: "Athlet Anna",
      role,
      level: 1,
      level_title: "Recruit",
      xp_total: 0,
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

describe("EngagementsPage", () => {
  beforeEach(() => {
    profileState.value = { data: undefined, isLoading: true, error: null };
    modeState.value = "athlete";
    mutationState.value = {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    };
  });

  it("zeigt Loading", () => {
    render(<EngagementsPage />);
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Profil/i);
  });

  it("zeigt Error", () => {
    profileState.value = { data: undefined, isLoading: false, error: new Error("x") };
    render(<EngagementsPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht geladen/i);
  });

  it("verweigert reinen Coach das Form, zeigt aber Engagement-Liste", () => {
    setProfile("coach");
    render(<EngagementsPage />);
    expect(screen.queryByLabelText(/Engagement-Code/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Athleten/);
    expect(screen.getByTestId("engagements-list")).toBeInTheDocument();
  });

  it("verweigert Both im Coach-Modus, zeigt aber Engagement-Liste", () => {
    setProfile("both");
    modeState.value = "coach";
    render(<EngagementsPage />);
    expect(screen.queryByLabelText(/Engagement-Code/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("engagements-list")).toBeInTheDocument();
  });

  it("rendert Form fuer Athlet", () => {
    setProfile("athlete");
    render(<EngagementsPage />);
    expect(screen.getByLabelText(/Engagement-Code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Code einloesen/i })).toBeEnabled();
  });

  it("rendert Engagements-Liste fuer Athlet", () => {
    setProfile("athlete");
    render(<EngagementsPage />);
    expect(screen.getByTestId("engagements-list")).toBeInTheDocument();
  });

  it("rendert Form fuer Both im Athlete-Modus", () => {
    setProfile("both");
    modeState.value = "athlete";
    render(<EngagementsPage />);
    expect(screen.getByLabelText(/Engagement-Code/i)).toBeInTheDocument();
  });

  it("zeigt Validierungsfehler bei zu kurzem Code nach Submit", () => {
    setProfile("athlete");
    render(<EngagementsPage />);
    fireEvent.change(screen.getByLabelText(/Engagement-Code/i), {
      target: { value: "AB23" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Code einloesen/i }));
    expect(screen.getByText(/8 Zeichen/)).toBeInTheDocument();
    expect(mutationState.value.mutateAsync).not.toHaveBeenCalled();
  });

  it("ruft mutateAsync mit normalisiertem Code und zeigt Success", async () => {
    setProfile("athlete");
    const mutateAsync = vi.fn().mockResolvedValue("eng-123");
    setMutation({ mutateAsync });
    render(<EngagementsPage />);
    fireEvent.change(screen.getByLabelText(/Engagement-Code/i), {
      target: { value: "ab 23 cd 45" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Code einloesen/i }));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith("AB23CD45");
    });
    expect(await screen.findByLabelText(/Code eingeloest/i)).toBeInTheDocument();
  });

  it("zeigt mapped Fehler bei RPC-Error", () => {
    setProfile("athlete");
    setMutation({ error: new Error("invalid_code") });
    render(<EngagementsPage />);
    expect(screen.getByText(/Tippfehler/)).toBeInTheDocument();
  });

  it("disabled Button im Pending-State", () => {
    setProfile("athlete");
    setMutation({ isPending: true });
    render(<EngagementsPage />);
    expect(screen.getByRole("button", { name: /Loese ein …/ })).toBeDisabled();
  });
});
