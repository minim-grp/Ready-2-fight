import { describe, expect, it } from "vitest";
import { renderEmail } from "./templates";
import type { NotificationCandidate } from "./selectors";

const APP_URL = "https://app.test.r2f";

function candidate(
  overrides: Partial<NotificationCandidate> = {},
): NotificationCandidate {
  return {
    kind: "tracking_reminder",
    user_id: "u1",
    email: "lena@test.r2f",
    display_name: "Lena",
    detail: { last_tracked_date: "2026-04-25", threshold_days: 3 },
    ...overrides,
  };
}

describe("renderEmail", () => {
  it("rendert tracking_reminder mit Datum + Tracking-Link", () => {
    const r = renderEmail({
      candidate: candidate(),
      appUrl: APP_URL,
    });
    expect(r.subject).toMatch(/Tracking-Erinnerung/);
    expect(r.text).toContain("Hi Lena,");
    expect(r.text).toContain("3 Tagen");
    expect(r.text).toContain("2026-04-25");
    expect(r.text).toContain("https://app.test.r2f/app/tracking");
    expect(r.html).toContain("Halte deinen Streak");
  });

  it("rendert tracking_reminder fuer User ohne bisheriges Tracking", () => {
    const r = renderEmail({
      candidate: candidate({
        detail: { last_tracked_date: null, threshold_days: 3 },
      }),
      appUrl: APP_URL,
    });
    expect(r.text).toContain("noch keinen Tracking-Eintrag");
  });

  it("rendert chat_digest mit count + counterparty_name", () => {
    const r = renderEmail({
      candidate: candidate({
        kind: "chat_digest",
        detail: { unread_count: 5, counterparty_name: "Karl" },
      }),
      appUrl: APP_URL,
    });
    expect(r.subject).toMatch(/5 ungelesene Nachrichten/);
    expect(r.text).toContain("Karl hat dir 5 ungelesene Nachrichten");
  });

  it("rendert chat_digest singular bei count=1", () => {
    const r = renderEmail({
      candidate: candidate({
        kind: "chat_digest",
        detail: { unread_count: 1, counterparty_name: "Karl" },
      }),
      appUrl: APP_URL,
    });
    expect(r.subject).toMatch(/1 ungelesene Nachricht/);
    expect(r.subject).not.toMatch(/Nachrichten/);
  });

  it("rendert plan_assigned mit Plan-Link", () => {
    const r = renderEmail({
      candidate: candidate({
        kind: "plan_assigned",
        detail: {
          plan_id: "abc",
          plan_title: "Boxen 4 Wochen",
          coach_display_name: "Karl",
        },
      }),
      appUrl: APP_URL,
    });
    expect(r.subject).toMatch(/Neuer Trainingsplan: Boxen 4 Wochen/);
    expect(r.text).toContain("Karl hat dir einen neuen Trainingsplan");
    expect(r.text).toContain("https://app.test.r2f/app/plan/abc");
  });

  it("default-Greeting wenn display_name null", () => {
    const r = renderEmail({
      candidate: candidate({ display_name: null }),
      appUrl: APP_URL,
    });
    expect(r.text).toMatch(/^Hi,/);
  });

  it("escaped HTML in Plan-Titel (XSS-Vermeidung)", () => {
    const r = renderEmail({
      candidate: candidate({
        kind: "plan_assigned",
        detail: {
          plan_id: "x",
          plan_title: "<script>alert(1)</script>",
          coach_display_name: null,
        },
      }),
      appUrl: APP_URL,
    });
    expect(r.html).not.toContain("<script>alert(1)</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
});
