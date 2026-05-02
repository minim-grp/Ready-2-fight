// Email-Templates fuer §1.31 Notifications. Pure-Funktionen, kein
// I/O — Edge Function uebergibt die Candidates und bekommt
// {subject, text, html} zurueck.
//
// HTML ist absichtlich minimal (kein Tracking-Pixel, keine
// Drittanbieter-Assets per CLAUDE.md §0.4 + §8). Plain-text-Body
// ist der primaere Inhalt — der HTML-Body ist nur aufgehuebscht.

import type { NotificationCandidate } from "./selectors.ts";

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

export type RenderInput = {
  candidate: NotificationCandidate;
  appUrl: string;
};

export function renderEmail(input: RenderInput): RenderedEmail {
  const { candidate, appUrl } = input;
  switch (candidate.kind) {
    case "tracking_reminder":
      return renderTrackingReminder(candidate, appUrl);
    case "chat_digest":
      return renderChatDigest(candidate, appUrl);
    case "plan_assigned":
      return renderPlanAssigned(candidate, appUrl);
  }
}

function renderTrackingReminder(c: NotificationCandidate, appUrl: string): RenderedEmail {
  const greeting = greetingFor(c.display_name);
  const last = (c.detail.last_tracked_date as string | null) ?? null;
  const days = c.detail.threshold_days as number;
  const lastLine = last
    ? `Dein letztes Tracking war am ${last}.`
    : `Du hast noch keinen Tracking-Eintrag.`;
  const link = `${appUrl}/app/tracking`;
  const text = [
    greeting,
    "",
    `wir haben in den letzten ${days} Tagen nichts mehr von dir gehoert.`,
    lastLine,
    "",
    `Halte deinen Streak: ${link}`,
    "",
    "— Ready 2 Fight",
  ].join("\n");
  const html = htmlWrap(
    `<p>${escapeHtml(greeting)}</p>
     <p>wir haben in den letzten ${days} Tagen nichts mehr von dir gehoert. ${escapeHtml(lastLine)}</p>
     <p><a href="${escapeAttr(link)}">Halte deinen Streak</a></p>`,
  );
  return {
    subject: "Vergisst du uns? Tracking-Erinnerung",
    text,
    html,
  };
}

function renderChatDigest(c: NotificationCandidate, appUrl: string): RenderedEmail {
  const greeting = greetingFor(c.display_name);
  const count = c.detail.unread_count as number;
  const counterparty = (c.detail.counterparty_name as string | null) ?? "deinem Coach";
  const link = `${appUrl}/app/engagements`;
  const plural = count === 1 ? "Nachricht" : "Nachrichten";
  const text = [
    greeting,
    "",
    `${counterparty} hat dir ${count} ungelesene ${plural} geschickt.`,
    "",
    `Lies sie hier: ${link}`,
    "",
    "— Ready 2 Fight",
  ].join("\n");
  const html = htmlWrap(
    `<p>${escapeHtml(greeting)}</p>
     <p>${escapeHtml(counterparty)} hat dir <strong>${count}</strong> ungelesene ${plural} geschickt.</p>
     <p><a href="${escapeAttr(link)}">Zum Chat</a></p>`,
  );
  return {
    subject: `${count} ungelesene ${plural} im Chat`,
    text,
    html,
  };
}

function renderPlanAssigned(c: NotificationCandidate, appUrl: string): RenderedEmail {
  const greeting = greetingFor(c.display_name);
  const planTitle = c.detail.plan_title as string;
  const coachName = (c.detail.coach_display_name as string | null) ?? "Dein Coach";
  const planId = c.detail.plan_id as string;
  const link = `${appUrl}/app/plan/${planId}`;
  const text = [
    greeting,
    "",
    `${coachName} hat dir einen neuen Trainingsplan zugewiesen: "${planTitle}".`,
    "",
    `Plan oeffnen: ${link}`,
    "",
    "— Ready 2 Fight",
  ].join("\n");
  const html = htmlWrap(
    `<p>${escapeHtml(greeting)}</p>
     <p>${escapeHtml(coachName)} hat dir einen neuen Trainingsplan zugewiesen: <strong>${escapeHtml(planTitle)}</strong>.</p>
     <p><a href="${escapeAttr(link)}">Plan oeffnen</a></p>`,
  );
  return {
    subject: `Neuer Trainingsplan: ${planTitle}`,
    text,
    html,
  };
}

// ============================================================
// Helpers
// ============================================================

function greetingFor(displayName: string | null): string {
  const first = (displayName ?? "").split(/\s+/)[0]?.trim();
  return first ? `Hi ${first},` : "Hi,";
}

function htmlWrap(inner: string): string {
  return `<!doctype html><html lang="de"><body style="font-family:system-ui,sans-serif;color:#15140f;">${inner}<p style="color:#888;font-size:12px;">Ready 2 Fight · DSGVO-konform aus eu-central-1.</p></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
