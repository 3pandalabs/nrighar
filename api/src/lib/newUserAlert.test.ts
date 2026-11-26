import { test } from "node:test";
import assert from "node:assert/strict";

// env.ts requires these at import time; the alert never touches them.
for (const k of ["DATABASE_URL", "JWT_SECRET", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT"]) {
  process.env[k] ??= "test";
}
process.env.MAILER_URL = "https://mailer.test";
process.env.MAILER_TOKEN = "t";

const { newUserAlertTo, newUserMail, notifyNewUser } = await import("./newUserAlert.js");

test("recipient defaults to the org inbox, can be overridden or turned off", () => {
  delete process.env.NEW_USER_ALERT_EMAIL;
  assert.equal(newUserAlertTo(), "3pandas@3pandalabs.com");
  process.env.NEW_USER_ALERT_EMAIL = " ops@example.com ";
  assert.equal(newUserAlertTo(), "ops@example.com");
  process.env.NEW_USER_ALERT_EMAIL = "OFF";
  assert.equal(newUserAlertTo(), null);
  delete process.env.NEW_USER_ALERT_EMAIL;
});

test("mail has the exact subject, a text part, and escaped user text", () => {
  const m = newUserMail("3pandas@3pandalabs.com", {
    email: "a<b>@x.com",
    userId: "u-1",
    role: "tenant",
    displayName: "<script>x</script>\nEvil",
    at: new Date("2026-11-26T10:05:00Z"),
  });
  assert.equal(m.subject, "RentVault New user");
  assert.equal(m.to, "3pandas@3pandalabs.com");
  assert.match(m.text, /Email: a<b>@x\.com/);
  assert.match(m.text, /Role: tenant/);
  assert.match(m.text, /Signed up: 2026-11-26 10:05 UTC/);
  assert.match(m.text, /User id: u-1/);
  assert.match(m.text, /Name: <script>x<\/script> Evil/);
  assert.ok(!m.html.includes("<script>"));
  assert.ok(m.html.includes("a&lt;b&gt;@x.com"));
});

test("no Name row when there is no display name", () => {
  const m = newUserMail("x@y.z", { email: "o@x.com", userId: "u", role: "owner" });
  assert.ok(!m.text.includes("Name:"));
  assert.match(m.text, /Role: owner/);
});

test("notifyNewUser never throws or rejects, and logs a failed send", async () => {
  const logs: string[] = [];
  notifyNewUser({ email: "o@x.com", userId: "u", role: "owner" }, (s) => logs.push(s), async () => {
    throw new Error("boom");
  });
  notifyNewUser({ email: "o@x.com", userId: "u", role: "owner" }, (s) => logs.push(s), () => {
    throw new Error("sync boom");
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(logs.length, 2);
  assert.ok(logs.every((l) => l.startsWith("new user alert failed")));
});

test("notifyNewUser sends nothing when turned off", async () => {
  process.env.NEW_USER_ALERT_EMAIL = "off";
  let sent = 0;
  notifyNewUser({ email: "o@x.com", userId: "u", role: "owner" }, () => {}, async () => {
    sent++;
    return { delivered: 1, failed: 0, skipped: 0 };
  });
  delete process.env.NEW_USER_ALERT_EMAIL;
  assert.equal(sent, 0);
});
