import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "./SettingsPage";
import type { Profile } from "../hooks/queries/useProfile";

type ProfileQueryState = {
  data: Profile | undefined;
  isLoading: boolean;
  error: Error | null;
};

type MutationState = {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
};

const profileState: { value: ProfileQueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

const consentState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
};

const modeState: { value: "athlete" | "coach" } = { value: "athlete" };
const setModeMock = vi.fn<(m: "athlete" | "coach") => void>();
const signOutMock = vi.fn<() => Promise<void>>().mockResolvedValue();

vi.mock("../hooks/queries/useProfile", () => ({
  useProfile: () => profileState.value,
}));

vi.mock("../hooks/queries/useAiConsent", () => ({
  useSetAiConsent: () => consentState.value,
}));

vi.mock("../stores/auth", () => ({
  useAuthStore: <T,>(
    selector: (s: {
      user: { id: string; email: string } | null;
      signOut: () => Promise<void>;
    }) => T,
  ) =>
    selector({
      user: { id: "u1", email: "anna@example.com" },
      signOut: signOutMock,
    }),
}));

vi.mock("../stores/mode", () => ({
  useModeStore: <T,>(
    selector: (s: {
      mode: "athlete" | "coach";
      setMode: (m: "athlete" | "coach") => void;
    }) => T,
  ) => selector({ mode: modeState.value, setMode: setModeMock }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function setProfile(overrides: Partial<Profile> = {}) {
  profileState.value = {
    data: {
      id: "u1",
      display_name: "Athlet Anna",
      role: "athlete",
      level: 3,
      level_title: "Sparring Partner",
      xp_total: 420,
      ai_consent: false,
      onboarding_done: true,
      ...overrides,
    },
    isLoading: false,
    error: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe("SettingsPage hi-fi (5c.5)", () => {
  beforeEach(() => {
    profileState.value = { data: undefined, isLoading: true, error: null };
    consentState.value = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    };
    modeState.value = "athlete";
    setModeMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue();
  });

  it("zeigt Loading-State", () => {
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Profil/i);
  });

  it("zeigt Error-State", () => {
    profileState.value = { data: undefined, isLoading: false, error: new Error("x") };
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht geladen/i);
  });

  it("rendert Stammdaten + ai_consent + Daten-Rechte + Sitzung", () => {
    setProfile();
    renderPage();
    expect(screen.getByText("Athlet Anna")).toBeInTheDocument();
    expect(screen.getByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByText(/KI-Verarbeitung/)).toBeInTheDocument();
    expect(screen.getByText(/Daten-Rechte/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Daten exportieren/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Korrektur anfordern/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Konto loeschen/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Abmelden/ })).toBeInTheDocument();
  });

  it("ai_consent-Toggle ruft useSetAiConsent mit true bei Aktivierung", async () => {
    setProfile({ ai_consent: false });
    renderPage();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    await waitFor(() =>
      expect(consentState.value.mutateAsync).toHaveBeenCalledWith(true),
    );
  });

  it("Mode-Switcher sichtbar nur fuer role=both", () => {
    setProfile({ role: "athlete" });
    const { unmount } = renderPage();
    expect(
      screen.queryByRole("group", { name: /Modus waehlen/i }),
    ).not.toBeInTheDocument();
    unmount();
    setProfile({ role: "both" });
    renderPage();
    expect(screen.getByRole("group", { name: /Modus waehlen/i })).toBeInTheDocument();
  });

  it("Abmelden-Button ruft signOut", async () => {
    setProfile();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Abmelden/ }));
    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
  });
});
