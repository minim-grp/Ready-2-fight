import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CodesList } from "./CodesList";
import type { EngagementCodeRow } from "../../hooks/queries/useEngagementCodes";

type QueryState = {
  data: EngagementCodeRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

type MutationState = {
  mutateAsync: (id: string) => Promise<string>;
  isPending: boolean;
  error: Error | null;
};

const queryState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};

const mutationState: { value: MutationState } = {
  value: {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  },
};

vi.mock("../../hooks/queries/useEngagementCodes", () => ({
  useEngagementCodes: () => queryState.value,
}));

vi.mock("../../hooks/queries/useRevokeEngagementCode", () => ({
  useRevokeEngagementCode: () => mutationState.value,
}));

const farFuture = "2099-01-01T00:00:00Z";
const past = "2000-01-01T00:00:00Z";

function makeRow(overrides: Partial<EngagementCodeRow> = {}): EngagementCodeRow {
  return {
    id: "code-1",
    code: "AB12CD34",
    internal_label: "Lena",
    max_uses: 1,
    uses_count: 0,
    expires_at: farFuture,
    revoked_at: null,
    created_at: "2026-04-19T10:00:00Z",
    ...overrides,
  };
}

describe("CodesList", () => {
  beforeEach(() => {
    queryState.value = { data: undefined, isLoading: true, error: null };
    mutationState.value = {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    };
  });

  it("zeigt Loading-State", () => {
    render(<CodesList />);
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Codes/i);
  });

  it("zeigt Error-State", () => {
    queryState.value = { data: undefined, isLoading: false, error: new Error("boom") };
    render(<CodesList />);
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht geladen/i);
  });

  it("zeigt Empty-State", () => {
    queryState.value = { data: [], isLoading: false, error: null };
    render(<CodesList />);
    expect(screen.getByText(/Noch keine Codes/i)).toBeInTheDocument();
  });

  it("rendert Code-Zeilen mit Status-Badges", () => {
    queryState.value = {
      data: [
        makeRow({ id: "1", code: "ACTIVE01" }),
        makeRow({
          id: "2",
          code: "REVOKE02",
          revoked_at: "2026-04-19T10:00:00Z",
        }),
        makeRow({ id: "3", code: "EXPIRE03", expires_at: past }),
        makeRow({ id: "4", code: "EXHAUST4", uses_count: 1, max_uses: 1 }),
      ],
      isLoading: false,
      error: null,
    };
    render(<CodesList />);
    expect(screen.getByText("ACTIVE01")).toBeInTheDocument();
    expect(screen.getByLabelText("Status: aktiv")).toBeInTheDocument();
    expect(screen.getByLabelText("Status: widerrufen")).toBeInTheDocument();
    expect(screen.getByLabelText("Status: abgelaufen")).toBeInTheDocument();
    expect(screen.getByLabelText("Status: eingeloest")).toBeInTheDocument();
  });

  it("Widerrufen-Button nur bei aktiven Codes", () => {
    queryState.value = {
      data: [
        makeRow({ id: "1", code: "ACTIVE01" }),
        makeRow({
          id: "2",
          code: "REVOKE02",
          revoked_at: "2026-04-19T10:00:00Z",
        }),
      ],
      isLoading: false,
      error: null,
    };
    render(<CodesList />);
    const buttons = screen.getAllByRole("button", { name: /Widerrufen/i });
    expect(buttons).toHaveLength(1);
  });

  it("zwei-Stufen-Confirm: erst 'Widerrufen', dann 'Wirklich widerrufen'", async () => {
    const mutateAsync = vi.fn().mockResolvedValue("2026-04-19T10:00:00Z");
    mutationState.value = { mutateAsync, isPending: false, error: null };
    queryState.value = {
      data: [makeRow({ id: "abc", code: "ACTIVE01" })],
      isLoading: false,
      error: null,
    };
    render(<CodesList />);
    fireEvent.click(screen.getByRole("button", { name: /^Widerrufen$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Wirklich widerrufen/i }));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith("abc");
    });
  });

  it("Abbrechen-Button setzt Confirm-State zurueck", () => {
    queryState.value = {
      data: [makeRow({ id: "abc", code: "ACTIVE01" })],
      isLoading: false,
      error: null,
    };
    render(<CodesList />);
    fireEvent.click(screen.getByRole("button", { name: /^Widerrufen$/i }));
    expect(
      screen.getByRole("button", { name: /Wirklich widerrufen/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abbrechen/i }));
    expect(screen.getByRole("button", { name: /^Widerrufen$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Wirklich widerrufen/i }),
    ).not.toBeInTheDocument();
  });

  it("zeigt mapped Fehler bei RPC-Error", () => {
    queryState.value = {
      data: [makeRow({ id: "abc", code: "ACTIVE01" })],
      isLoading: false,
      error: null,
    };
    mutationState.value = {
      mutateAsync: vi.fn(),
      isPending: false,
      error: new Error("code_already_revoked"),
    };
    render(<CodesList />);
    expect(screen.getByRole("alert")).toHaveTextContent(/bereits widerrufen/i);
  });
});
