import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssignPlanModal } from "./AssignPlanModal";
import type { EngagementRow } from "../../hooks/queries/useEngagements";

type QueryState = {
  data: EngagementRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
};
type MutationState = {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
};

const engState: { value: QueryState } = {
  value: { data: undefined, isLoading: true, error: null },
};
const assignState: { value: MutationState } = {
  value: { mutateAsync: vi.fn().mockResolvedValue("plan-new"), isPending: false },
};

vi.mock("../../hooks/queries/useEngagements", () => ({
  useEngagements: () => engState.value,
}));
vi.mock("../../hooks/queries/usePlans", () => ({
  useAssignPlan: () => assignState.value,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function eng(overrides: Partial<EngagementRow>): EngagementRow {
  return {
    id: "eng-1",
    coach_id: "coach-1",
    athlete_id: "athlete-1",
    purpose: "general",
    status: "active",
    end_reason: null,
    started_at: "2026-04-01T00:00:00Z",
    ended_at: null,
    can_see_tracking: true,
    can_see_meals: false,
    can_see_tests: false,
    can_create_plans: true,
    coach_name: "Coach",
    athlete_name: "Lena",
    ...overrides,
  };
}

function renderModal(props?: Partial<Parameters<typeof AssignPlanModal>[0]>) {
  const onClose = vi.fn();
  const onAssigned = vi.fn();
  render(
    <AssignPlanModal
      templateId="tpl-1"
      templateTitle="Boxen 4 Wochen"
      onClose={onClose}
      onAssigned={onAssigned}
      {...props}
    />,
  );
  return { onClose, onAssigned };
}

describe("AssignPlanModal", () => {
  beforeEach(() => {
    engState.value = { data: undefined, isLoading: true, error: null };
    assignState.value = {
      mutateAsync: vi.fn().mockResolvedValue("plan-new"),
      isPending: false,
    };
  });

  it("zeigt Loading-State waehrend Engagements laden", () => {
    renderModal();
    expect(screen.getByRole("status")).toHaveTextContent(/Lade Athleten/);
  });

  it("zeigt Empty-State wenn kein eligibles Engagement", () => {
    engState.value = {
      data: [
        eng({ id: "e-paused", status: "paused" }),
        eng({ id: "e-noperm", can_create_plans: false }),
      ],
      isLoading: false,
      error: null,
    };
    renderModal();
    expect(screen.getByText(/Kein Athlet mit Berechtigung/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zuweisen/ })).toBeDisabled();
  });

  it("filtert auf active + can_create_plans", () => {
    engState.value = {
      data: [
        eng({ id: "ok-1", athlete_name: "Lena" }),
        eng({ id: "paused", athlete_name: "Max", status: "paused" }),
        eng({ id: "noperm", athlete_name: "Jana", can_create_plans: false }),
        eng({ id: "ok-2", athlete_name: "Ben" }),
      ],
      isLoading: false,
      error: null,
    };
    renderModal();
    expect(screen.getByText("Lena")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.queryByText("Max")).toBeNull();
    expect(screen.queryByText("Jana")).toBeNull();
  });

  it("Submit ohne Auswahl zeigt Validierungsfehler", () => {
    engState.value = {
      data: [eng({ id: "e1", athlete_name: "Lena" })],
      isLoading: false,
      error: null,
    };
    renderModal();
    // Button ist disabled bis Auswahl getroffen wurde — Click via Form-Submit erzwingen
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/Athleten auswaehlen/);
    expect(assignState.value.mutateAsync).not.toHaveBeenCalled();
  });

  it("ruft assign_plan mit template_id, athlete_id, engagement_id und schliesst Modal", async () => {
    engState.value = {
      data: [eng({ id: "eng-X", athlete_id: "ath-X", athlete_name: "Lena" })],
      isLoading: false,
      error: null,
    };
    const { onClose, onAssigned } = renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Lena" }));
    fireEvent.click(screen.getByRole("button", { name: /^Zuweisen$/ }));
    await waitFor(() =>
      expect(assignState.value.mutateAsync).toHaveBeenCalledWith({
        template_id: "tpl-1",
        athlete_id: "ath-X",
        engagement_id: "eng-X",
      }),
    );
    expect(onAssigned).toHaveBeenCalledWith("plan-new");
    expect(onClose).toHaveBeenCalled();
  });

  it("mappt RPC-Fehler permission_denied auf nutzerlesbaren Text", async () => {
    engState.value = {
      data: [eng({ id: "eng-1", athlete_name: "Lena" })],
      isLoading: false,
      error: null,
    };
    assignState.value = {
      mutateAsync: vi.fn().mockRejectedValue(new Error("permission_denied")),
      isPending: false,
    };
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Lena" }));
    fireEvent.click(screen.getByRole("button", { name: /^Zuweisen$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Keine Berechtigung 'Plaene erstellen'/,
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mappt RPC-Fehler engagement_not_active", async () => {
    engState.value = {
      data: [eng({ id: "eng-1", athlete_name: "Lena" })],
      isLoading: false,
      error: null,
    };
    assignState.value = {
      mutateAsync: vi.fn().mockRejectedValue(new Error("engagement_not_active")),
      isPending: false,
    };
    renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Lena" }));
    fireEvent.click(screen.getByRole("button", { name: /^Zuweisen$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Engagement nicht aktiv/),
    );
  });
});
