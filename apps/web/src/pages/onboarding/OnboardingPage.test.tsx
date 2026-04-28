import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnboardingPage } from "./OnboardingPage";

type ProfileQuery = {
  data: { role: "athlete" | "coach" | "both" } | undefined;
  isLoading: boolean;
};

const profileState: { value: ProfileQuery } = {
  value: { data: { role: "athlete" }, isLoading: false },
};

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../hooks/queries/useProfile", () => ({
  useProfile: () => profileState.value,
}));

const setAiConsentMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../hooks/queries/useAiConsent", () => ({
  useSetAiConsent: () => ({
    mutateAsync: setAiConsentMock,
    isPending: false,
  }),
}));

vi.mock("./AthleteOnboarding", () => ({
  AthleteOnboarding: ({ onComplete }: { onComplete: () => void }) => (
    <div>
      <p>AthleteOnboarding-Stub</p>
      <button type="button" onClick={onComplete}>
        Athlete fertig
      </button>
    </div>
  ),
}));

vi.mock("./CoachOnboarding", () => ({
  CoachOnboarding: ({ onComplete }: { onComplete: () => void }) => (
    <div>
      <p>CoachOnboarding-Stub</p>
      <button type="button" onClick={onComplete}>
        Coach fertig
      </button>
    </div>
  ),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function advanceFromSplash() {
  fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
  await screen.findByText(/Was teilst du/);
}

async function advanceFromConsent() {
  fireEvent.click(screen.getByRole("button", { name: /^Weiter$/ }));
  await waitFor(() => expect(setAiConsentMock).toHaveBeenCalled());
}

describe("OnboardingPage flow", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "athlete" }, isLoading: false };
    navigateMock.mockReset();
    setAiConsentMock.mockClear();
    setAiConsentMock.mockResolvedValue(undefined);
  });

  it("Splash startet als erste Phase", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Los geht/ })).toBeInTheDocument();
  });

  it("Athlete: splash → consent → athlete → tutorial → navigate", async () => {
    renderPage();
    await advanceFromSplash();
    await advanceFromConsent();
    await screen.findByText(/AthleteOnboarding-Stub/);
    fireEvent.click(screen.getByRole("button", { name: /Athlete fertig/ }));
    await screen.findByText(/So laeuft der/);
    fireEvent.click(screen.getByRole("button", { name: /Verstanden, zum Dashboard/ }));
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/app", { replace: true }),
    );
  });

  it("Coach: splash → consent → coach → navigate (kein Tutorial)", async () => {
    profileState.value = { data: { role: "coach" }, isLoading: false };
    renderPage();
    await advanceFromSplash();
    await advanceFromConsent();
    await screen.findByText(/CoachOnboarding-Stub/);
    fireEvent.click(screen.getByRole("button", { name: /Coach fertig/ }));
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/app", { replace: true }),
    );
    expect(screen.queryByText(/So laeuft der/)).toBeNull();
  });

  it("Both: splash → consent → athlete → coach → tutorial → navigate", async () => {
    profileState.value = { data: { role: "both" }, isLoading: false };
    renderPage();
    await advanceFromSplash();
    await advanceFromConsent();
    await screen.findByText(/AthleteOnboarding-Stub/);
    fireEvent.click(screen.getByRole("button", { name: /Athlete fertig/ }));
    await screen.findByText(/CoachOnboarding-Stub/);
    fireEvent.click(screen.getByRole("button", { name: /Coach fertig/ }));
    await screen.findByText(/So laeuft der/);
    fireEvent.click(screen.getByRole("button", { name: /Verstanden, zum Dashboard/ }));
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/app", { replace: true }),
    );
  });

  it("Lade-State zeigt Loader", () => {
    profileState.value = { data: undefined, isLoading: true };
    renderPage();
    expect(screen.getByText(/Lade …/)).toBeInTheDocument();
  });

  it("Profil-Fehler zeigt Fehlermeldung", () => {
    profileState.value = { data: undefined, isLoading: false };
    renderPage();
    expect(screen.getByText(/Profil konnte nicht geladen werden/)).toBeInTheDocument();
  });
});

describe("ConsentStep ai_consent persist", () => {
  beforeEach(() => {
    profileState.value = { data: { role: "athlete" }, isLoading: false };
    navigateMock.mockReset();
    setAiConsentMock.mockClear();
    setAiConsentMock.mockResolvedValue(undefined);
  });

  it("speichert ai_consent=false, wenn Toggle nicht aktiviert", async () => {
    renderPage();
    await advanceFromSplash();
    fireEvent.click(screen.getByRole("button", { name: /^Weiter$/ }));
    await waitFor(() => expect(setAiConsentMock).toHaveBeenCalledWith(false));
  });

  it("speichert ai_consent=true, wenn KI-Toggle aktiviert", async () => {
    renderPage();
    await advanceFromSplash();
    const toggles = screen.getAllByRole("checkbox");
    // Reihenfolge: 0=Coach-Sichtbarkeit, 1=KI-Verarbeitung, 2=Marketing
    const aiToggle = toggles[1];
    if (!aiToggle) throw new Error("KI-Toggle nicht gefunden");
    fireEvent.click(aiToggle);
    fireEvent.click(screen.getByRole("button", { name: /^Weiter$/ }));
    await waitFor(() => expect(setAiConsentMock).toHaveBeenCalledWith(true));
  });
});
