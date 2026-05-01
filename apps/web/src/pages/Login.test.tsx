import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./Login";

type SignInResult = { error: { code?: string; message: string } | null };
type SignInFn = (args: unknown) => Promise<SignInResult>;
type ToastFn = (title: string, opts?: unknown) => void;

const signInMock = vi.fn<SignInFn>();
const resendMock = vi.fn<SignInFn>();
const toastError = vi.fn<ToastFn>();
const toastSuccess = vi.fn<(title: string) => void>();

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (args: unknown): Promise<SignInResult> => signInMock(args),
      resend: (args: unknown): Promise<SignInResult> => resendMock(args),
    },
  },
}));
vi.mock("sonner", () => ({
  toast: {
    error: (title: string, opts?: unknown): void => toastError(title, opts),
    success: (title: string): void => toastSuccess(title),
  },
}));
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

function fillAndSubmit(email = "athlet@test.r2f", password = "Passwort1234") {
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/passwort/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /einloggen/i }));
}

describe("LoginPage email-not-confirmed handling", () => {
  beforeEach(() => {
    signInMock.mockReset();
    resendMock.mockReset();
    resendMock.mockResolvedValue({ error: null });
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("shows specific toast when error.code = email_not_confirmed", async () => {
    signInMock.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [title, opts] = toastError.mock.calls[0] as [
      string,
      { description?: string; action?: { label?: string } } | undefined,
    ];
    expect(title).toBe("E-Mail noch nicht bestaetigt");
    expect(opts?.description).toContain("Bestaetigungslink");
    expect(opts?.action?.label).toBe("Erneut senden");
  });

  it("falls back to message match if error.code missing", async () => {
    signInMock.mockResolvedValue({ error: { message: "Email not confirmed" } });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe("E-Mail noch nicht bestaetigt");
  });

  it("uses generic message for other errors", async () => {
    signInMock.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [title, opts] = toastError.mock.calls[0] as [
      string,
      { description?: string } | undefined,
    ];
    expect(title).toBe("Login fehlgeschlagen");
    expect(opts?.description).toContain("falsch");
  });

  it("invokes resend action and shows success toast", async () => {
    signInMock.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fillAndSubmit("athlet@test.r2f");
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const opts = toastError.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined;
    opts?.action?.onClick?.();
    await waitFor(() => expect(resendMock).toHaveBeenCalled());
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "athlet@test.r2f",
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Bestaetigungs-Mail versendet"),
    );
  });
});
