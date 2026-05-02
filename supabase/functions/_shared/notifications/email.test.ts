import { describe, expect, it } from "vitest";
import { createMockSender } from "./email";

describe("createMockSender", () => {
  it("sammelt sends in 'sent' und liefert ok=true", async () => {
    const m = createMockSender();
    const r = await m.send({
      to: "x@test.r2f",
      email: { subject: "Hi", text: "Body", html: "<p>Body</p>" },
    });
    expect(r.ok).toBe(true);
    expect(r.message_id).toBe("mock-1");
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]?.to).toBe("x@test.r2f");
    expect(m.sent[0]?.email.subject).toBe("Hi");
  });

  it("reset() leert die sent-Liste", async () => {
    const m = createMockSender();
    await m.send({
      to: "a@test.r2f",
      email: { subject: "S", text: "T", html: "H" },
    });
    expect(m.sent).toHaveLength(1);
    m.reset();
    expect(m.sent).toHaveLength(0);
  });
});
