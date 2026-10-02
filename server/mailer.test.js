const { test } = require("node:test");
const assert = require("node:assert");
const { createMailer, buildConfirmationEmail } = require("./mailer");

const links = {
  confirmUrl: "https://example.com/api/confirm?token=abc&x=1",
  unsubscribeUrl: "https://example.com/api/unsubscribe?token=abc",
};

test("without credentials the mailer only logs the link", async () => {
  const lines = [];
  const mailer = createMailer({ apiKey: "", from: "", logger: { log: (l) => lines.push(l) } });
  assert.strictEqual(mailer.kind, "console");
  await mailer.sendConfirmation("a@b.com", links);
  assert.match(lines[0], /a@b\.com/);
  assert.match(lines[0], /api\/confirm/);
});

test("with credentials it calls the Resend API with the right payload", async () => {
  let call;
  const fetchImpl = async (url, init) => {
    call = { url, init };
    return { ok: true, status: 200 };
  };
  const mailer = createMailer({ apiKey: "key123", from: "CTO <hi@example.com>", fetchImpl });
  assert.strictEqual(mailer.kind, "resend");

  await mailer.sendConfirmation("reader@example.com", links);

  assert.strictEqual(call.url, "https://api.resend.com/emails");
  assert.strictEqual(call.init.headers.Authorization, "Bearer key123");
  const body = JSON.parse(call.init.body);
  assert.deepStrictEqual(body.to, ["reader@example.com"]);
  assert.strictEqual(body.from, "CTO <hi@example.com>");
  assert.ok(body.text.includes(links.confirmUrl));
  assert.strictEqual(body.headers["List-Unsubscribe"], `<${links.unsubscribeUrl}>`);
});

test("a failing provider response throws so the caller can log it", async () => {
  const mailer = createMailer({
    apiKey: "k",
    from: "a@b.com",
    fetchImpl: async () => ({ ok: false, status: 422 }),
  });
  await assert.rejects(() => mailer.sendConfirmation("x@y.com", links), /422/);
});

test("the HTML email escapes the links", () => {
  const { html } = buildConfirmationEmail(links);
  assert.ok(html.includes("token=abc&amp;x=1"));
});

const messages = (n) =>
  Array.from({ length: n }, (_, i) => ({
    email: `u${i}@example.com`,
    subject: "Issue 1",
    text: "Hello",
    html: "<p>Hello</p>",
    unsubscribeUrl: `https://example.com/api/unsubscribe?token=${i}`,
  }));

test("newsletter is sent through the batch endpoint in chunks of 100", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200 };
  };
  const mailer = createMailer({ apiKey: "k", from: "a@b.com", fetchImpl });

  const result = await mailer.sendNewsletter(messages(250));

  assert.deepStrictEqual(result, { sent: 250, failed: 0 });
  assert.strictEqual(calls.length, 3);
  assert.ok(calls.every((c) => c.url === "https://api.resend.com/emails/batch"));
  assert.deepStrictEqual(calls.map((c) => c.body.length), [100, 100, 50]);
  assert.deepStrictEqual(calls[0].body[0].to, ["u0@example.com"]);
  assert.strictEqual(
    calls[0].body[0].headers["List-Unsubscribe"],
    "<https://example.com/api/unsubscribe?token=0>"
  );
});

test("a failed batch is counted and the remaining batches still go out", async () => {
  let n = 0;
  const fetchImpl = async () => ({ ok: ++n !== 2, status: 500 });
  const errors = [];
  const mailer = createMailer({
    apiKey: "k",
    from: "a@b.com",
    fetchImpl,
    logger: { log() {}, error: (m) => errors.push(m) },
  });

  const result = await mailer.sendNewsletter(messages(250));

  assert.deepStrictEqual(result, { sent: 150, failed: 100 });
  assert.strictEqual(errors.length, 1);
});

test("without credentials sendNewsletter sends nothing and says so", async () => {
  const mailer = createMailer({ apiKey: "", from: "", logger: { log() {} } });
  const result = await mailer.sendNewsletter(messages(3));
  assert.strictEqual(result.sent, 0);
  assert.strictEqual(result.notConfigured, true);
});