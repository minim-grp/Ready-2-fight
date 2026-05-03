// Email-Sender-Abstraktion fuer §1.31. Edge Function injiziert
// einen konkreten Sender (z.B. ResendSender), Tests injizieren
// MockSender. Der Sender kennt nichts ueber Notification-Typen.
//
// HINWEIS: API-Key kommt aus Supabase Vault per Env (RESEND_API_KEY),
// NICHT aus dem Repo (CLAUDE.md §3 "API-Keys von Drittanbietern").

import type { RenderedEmail } from "./templates.ts";

export type EmailSendInput = {
  to: string;
  email: RenderedEmail;
};

export type EmailSendResult = {
  ok: boolean;
  // Provider-spezifische Message-ID falls vorhanden — nuetzlich fuer Logs.
  message_id: string | null;
  error: string | null;
};

export interface EmailSender {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

// ============================================================
// Resend-Implementierung. Edge Function setzt das nur ein wenn
// RESEND_API_KEY gesetzt ist; sonst wird im Dev/CI auf MockSender
// zurueckgefallen.
// ============================================================

export type ResendConfig = {
  apiKey: string;
  fromAddress: string; // z.B. "Ready 2 Fight <noreply@ready2fight.app>"
};

export function createResendSender(config: ResendConfig): EmailSender {
  return {
    async send(input: EmailSendInput): Promise<EmailSendResult> {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.fromAddress,
            to: [input.to],
            subject: input.email.subject,
            text: input.email.text,
            html: input.email.html,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          return { ok: false, message_id: null, error: `${res.status}: ${body}` };
        }
        const data = (await res.json()) as { id?: string };
        return { ok: true, message_id: data.id ?? null, error: null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        return { ok: false, message_id: null, error: msg };
      }
    },
  };
}

// ============================================================
// Mock-Sender — Tests + lokales Dev. Sammelt alle Sends fuer
// Inspektion.
// ============================================================

export type MockSender = EmailSender & {
  sent: EmailSendInput[];
  reset(): void;
};

export function createMockSender(): MockSender {
  const sent: EmailSendInput[] = [];
  return {
    sent,
    reset() {
      sent.length = 0;
    },
    async send(input: EmailSendInput): Promise<EmailSendResult> {
      sent.push(input);
      return { ok: true, message_id: `mock-${sent.length}`, error: null };
    },
  };
}
