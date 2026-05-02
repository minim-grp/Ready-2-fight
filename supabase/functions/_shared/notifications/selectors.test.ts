import { describe, expect, it } from "vitest";
import {
  selectChatDigests,
  selectPlanAssignedNotices,
  selectTrackingReminders,
  type AthleteTrackingState,
  type ChatUnreadState,
  type PlanAssignedRow,
} from "./selectors";

const TODAY = new Date("2026-05-02T12:00:00Z");

describe("selectTrackingReminders", () => {
  function row(overrides: Partial<AthleteTrackingState> = {}): AthleteTrackingState {
    return {
      user_id: "u1",
      email: "u1@test.r2f",
      display_name: "Lena",
      has_active_engagement: true,
      last_tracked_date: "2026-05-02",
      ...overrides,
    };
  }

  it("filtert User ohne aktives Engagement raus", () => {
    const out = selectTrackingReminders(
      [
        row({
          user_id: "u-no-eng",
          last_tracked_date: null,
          has_active_engagement: false,
        }),
      ],
      TODAY,
    );
    expect(out).toHaveLength(0);
  });

  it("triggert wenn last_tracked_date > 3 Tage her", () => {
    const out = selectTrackingReminders(
      [row({ user_id: "u-old", last_tracked_date: "2026-04-25" })],
      TODAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("tracking_reminder");
    expect(out[0]?.detail.threshold_days).toBe(3);
  });

  it("triggert wenn last_tracked_date NULL", () => {
    const out = selectTrackingReminders(
      [row({ user_id: "u-never", last_tracked_date: null })],
      TODAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.detail.last_tracked_date).toBeNull();
  });

  it("triggert NICHT bei frischem Tracking (< 3 Tage)", () => {
    // Cutoff ist 2026-04-29, also 2026-04-30 ist frisch
    const out = selectTrackingReminders(
      [row({ last_tracked_date: "2026-04-30" })],
      TODAY,
    );
    expect(out).toHaveLength(0);
  });
});

describe("selectChatDigests", () => {
  function row(overrides: Partial<ChatUnreadState> = {}): ChatUnreadState {
    return {
      user_id: "u1",
      email: "u1@test.r2f",
      display_name: "Lena",
      unread_count: 3,
      oldest_unread_at: "2026-05-01T12:00:00Z",
      counterparty_name: "Karl",
      ...overrides,
    };
  }

  it("triggert bei unread > 0 und oldest > 6h", () => {
    const out = selectChatDigests(
      [row({ oldest_unread_at: "2026-05-01T12:00:00Z" })],
      TODAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.detail.unread_count).toBe(3);
    expect(out[0]?.detail.counterparty_name).toBe("Karl");
  });

  it("triggert NICHT wenn oldest < 6h", () => {
    const out = selectChatDigests(
      [row({ oldest_unread_at: "2026-05-02T11:00:00Z" })],
      TODAY,
    );
    expect(out).toHaveLength(0);
  });

  it("triggert NICHT bei unread_count=0", () => {
    const out = selectChatDigests([row({ unread_count: 0 })], TODAY);
    expect(out).toHaveLength(0);
  });
});

describe("selectPlanAssignedNotices", () => {
  function row(overrides: Partial<PlanAssignedRow> = {}): PlanAssignedRow {
    return {
      plan_id: "p1",
      plan_title: "Wettkampf-Cut",
      athlete_user_id: "u1",
      athlete_email: "u1@test.r2f",
      athlete_display_name: "Lena",
      coach_display_name: "Karl",
      ...overrides,
    };
  }

  it("mappt Rows 1:1 zu Candidates", () => {
    const out = selectPlanAssignedNotices([row(), row({ plan_id: "p2" })]);
    expect(out).toHaveLength(2);
    expect(out[0]?.kind).toBe("plan_assigned");
    expect(out[0]?.detail.plan_title).toBe("Wettkampf-Cut");
    expect(out[0]?.detail.coach_display_name).toBe("Karl");
  });
});
