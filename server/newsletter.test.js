const { test } = require("node:test");
const assert = require("node:assert");
const { buildNewsletterMessages } = require("./newsletter");

const recipients = [
  { email: "a@example.com", token: "a".repeat(48) },
  { email: "b@example.com", token: "b".repeat(48) },
];

test("each subscriber gets their own message with their own unsubscribe link", () => {
  const msgs = buildNewsletterMessages(
    recipients,
    { subject: "Issue 1", body: "Hello there" },
    "https://cto.example/"
  );
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[0].email, "a@example.com");
  assert.strictEqual(msgs[0].unsubscribeUrl, `https://cto.example/api/unsubscribe?token=${"a".repeat(48)}`);
  assert.ok(msgs[1].text.includes(`token=${"b".repeat(48)}`));
  assert.ok(msgs[1].html.includes(`token=${"b".repeat(48)}`));
  assert.ok(!msgs[0].text.includes("b".repeat(48)));
});

test("the body is escaped and blank lines become paragraphs", () => {
  const [m] = buildNewsletterMessages(
    recipients,
    { subject: "S", body: "<script>alert(1)</script>\n\nSecond\nline" },
    "https://cto.example"
  );
  assert.ok(!m.html.includes("<script>"));
  assert.ok(m.html.includes("&lt;script&gt;"));
  assert.ok(m.html.includes("<p>Second<br>line</p>"));
});