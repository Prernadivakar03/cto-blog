const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("./app");
const { createFileStore } = require("./storage");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cto-"));
const subsFile = path.join(tmpDir, "subscribers.json");

const listen = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    );
  });
const stop = (server) => {
  server.closeAllConnections?.();
  server.close();
};

let main;
before(async () => {
  main = await listen(createApp(createFileStore(subsFile)));
});
after(() => {
  stop(main.server);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const subscribe = (body, base = main.base) =>
  fetch(`${base}/api/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("GET /api/health reports the storage backend", async () => {
  const res = await fetch(`${main.base}/api/health`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).storage, "file");
});

test("GET /api/posts returns 3 to 5 posts without article bodies", async () => {
  const res = await fetch(`${main.base}/api/posts`);
  const data = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(data.posts.length >= 3 && data.posts.length <= 5);
  assert.strictEqual(data.posts[0].content, undefined);
});

test("GET /api/posts/:id returns a post, unknown id returns 404", async () => {
  const ok = await fetch(`${main.base}/api/posts/1`);
  assert.strictEqual(ok.status, 200);
  assert.ok(Array.isArray((await ok.json()).post.content));
  const missing = await fetch(`${main.base}/api/posts/9999`);
  assert.strictEqual(missing.status, 404);
});

test("responses carry security headers and hide Express", async () => {
  const res = await fetch(`${main.base}/api/posts`);
  assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
  assert.strictEqual(res.headers.get("x-powered-by"), null);
  assert.ok(res.headers.get("content-security-policy"));
});

test("subscribe rejects a missing email", async () => {
  assert.strictEqual((await subscribe({})).status, 400);
});

test("subscribe rejects a non-string email", async () => {
  assert.strictEqual((await subscribe({ email: { $gt: "" } })).status, 400);
});

test("subscribe rejects an invalid or oversized email", async () => {
  assert.strictEqual((await subscribe({ email: "abc@site" })).status, 400);
  const long = `${"a".repeat(300)}@example.com`;
  assert.strictEqual((await subscribe({ email: long })).status, 400);
});

test("subscribe stores a valid email, then rejects the duplicate", async () => {
  const first = await subscribe({ email: "Test@Example.com " });
  assert.strictEqual(first.status, 200);
  assert.strictEqual((await first.json()).message, "Subscription successful");

  const saved = JSON.parse(fs.readFileSync(subsFile, "utf8"));
  assert.strictEqual(saved[0].email, "test@example.com");

  assert.strictEqual((await subscribe({ email: "test@example.com" })).status, 409);
});

test("malformed JSON returns a 400 JSON error, not an HTML page", async () => {
  const res = await fetch(`${main.base}/api/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad json",
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await res.json()).message, "Invalid JSON body");
});

test("rate limiter returns 429 after too many attempts", async () => {
  const limited = await listen(
    createApp(createFileStore(path.join(tmpDir, "rl.json")), { subscribeLimit: 2 })
  );
  try {
    assert.strictEqual((await subscribe({}, limited.base)).status, 400);
    assert.strictEqual((await subscribe({}, limited.base)).status, 400);
    assert.strictEqual((await subscribe({}, limited.base)).status, 429);
  } finally {
    stop(limited.server);
  }
});