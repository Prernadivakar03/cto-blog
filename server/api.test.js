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

// Fake mailer that records what would have been emailed
const sent = [];
const mailer = {
  sendConfirmation: async (email, links) => {
    sent.push({ email, ...links });
  },
};
const tokenOf = (url) => new URL(url).searchParams.get("token");

let main;
before(async () => {
  main = await listen(
    createApp(createFileStore(subsFile), { mailer, publicUrl: "https://cto.example" })
  );
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

test("subscribe stores a pending subscriber, emails one confirmation, and answers identically on repeats", async () => {
  const first = await subscribe({ email: "Test@Example.com " });
  assert.strictEqual(first.status, 200);
  const firstBody = await first.json();

  const second = await subscribe({ email: "test@example.com" });
  assert.strictEqual(second.status, 200);
  assert.deepStrictEqual(await second.json(), firstBody);

  const saved = JSON.parse(fs.readFileSync(subsFile, "utf8"));
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].email, "test@example.com");
  assert.strictEqual(saved[0].status, "pending");

  // The pending address is re-sent the same link, never a different token
  assert.strictEqual(sent.length, 2);
  assert.strictEqual(tokenOf(sent[0].confirmUrl), tokenOf(sent[1].confirmUrl));
  assert.ok(sent[0].confirmUrl.startsWith("https://cto.example/api/confirm?token="));
});

test("confirm link activates the subscription and later signups send no email", async () => {
  const { confirmUrl } = sent.find((m) => m.email === "test@example.com");
  const res = await fetch(`${main.base}/api/confirm?token=${tokenOf(confirmUrl)}`, {
    redirect: "manual",
  });
  assert.strictEqual(res.status, 303);
  assert.strictEqual(res.headers.get("location"), "/?subscription=confirmed");

  const saved = JSON.parse(fs.readFileSync(subsFile, "utf8"));
  assert.strictEqual(saved[0].status, "confirmed");

  const before = sent.length;
  assert.strictEqual((await subscribe({ email: "test@example.com" })).status, 200);
  assert.strictEqual(sent.length, before);
});

test("confirm and unsubscribe reject bad, unknown or object-shaped tokens", async () => {
  for (const q of ["token=nope", `token=${"f".repeat(48)}`, "token[$ne]=x", ""]) {
    const c = await fetch(`${main.base}/api/confirm?${q}`, { redirect: "manual" });
    assert.strictEqual(c.headers.get("location"), "/?subscription=invalid");
    const u = await fetch(`${main.base}/api/unsubscribe?${q}`, { redirect: "manual" });
    assert.strictEqual(u.headers.get("location"), "/?subscription=invalid");
  }
});

test("unsubscribe link works via GET and via one-click POST", async () => {
  const { unsubscribeUrl } = sent.find((m) => m.email === "test@example.com");
  const token = tokenOf(unsubscribeUrl);

  const get = await fetch(`${main.base}/api/unsubscribe?token=${token}`, { redirect: "manual" });
  assert.strictEqual(get.status, 303);
  assert.strictEqual(get.headers.get("location"), "/?subscription=unsubscribed");
  assert.strictEqual(JSON.parse(fs.readFileSync(subsFile, "utf8"))[0].status, "unsubscribed");

  const post = await fetch(`${main.base}/api/unsubscribe?token=${token}`, { method: "POST" });
  assert.strictEqual(post.status, 200);

  const bad = await fetch(`${main.base}/api/unsubscribe?token=nope`, { method: "POST" });
  assert.strictEqual(bad.status, 400);
});

test("a failing mailer never breaks the signup response", async () => {
  const failing = await listen(
    createApp(createFileStore(path.join(tmpDir, "fail.json")), {
      mailer: { sendConfirmation: async () => Promise.reject(new Error("smtp down")) },
    })
  );
  try {
    assert.strictEqual((await subscribe({ email: "x@example.com" }, failing.base)).status, 200);
  } finally {
    stop(failing.server);
  }
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

test("article pages get their own title, description and canonical URL", async () => {
  const dist = fs.mkdtempSync(path.join(tmpDir, "dist-"));
  fs.writeFileSync(
    path.join(dist, "index.html"),
    `<!DOCTYPE html><html><head>
  <title>Default</title>
  <meta name="description" content="Default description" />
  <meta property="og:title" content="Default" />
  <meta property="og:description" content="Default" />
  <meta property="og:type" content="website" />
</head><body><div id="root"></div></body></html>`
  );
  const store = createFileStore(path.join(tmpDir, "seo.json"));
  const seo = await listen(createApp(store, { distDir: dist, publicUrl: "https://cto.example" }));
  try {
    const post = await store.getPost(1);

    const page = await fetch(`${seo.base}/post/1`);
    const html = await page.text();
    assert.strictEqual(page.status, 200);
    assert.ok(html.includes(`<title>${post.title} · CTO Journal</title>`));
    assert.ok(html.includes('rel="canonical" href="https://cto.example/post/1"'));

    const missing = await fetch(`${seo.base}/post/9999`);
    assert.strictEqual(missing.status, 404);
    assert.ok((await missing.text()).includes("Default")); // React app renders "not found"

    const home = await fetch(`${seo.base}/some/client/route`);
    assert.strictEqual(home.status, 200);

    const sitemap = await (await fetch(`${seo.base}/sitemap.xml`)).text();
    assert.ok(sitemap.includes("<loc>https://cto.example/post/1</loc>"));

    const robots = await (await fetch(`${seo.base}/robots.txt`)).text();
    assert.ok(robots.includes("Sitemap: https://cto.example/sitemap.xml"));
  } finally {
    stop(seo.server);
  }
});



// ---------- Newsletter admin ----------

const ADMIN = "x".repeat(32);
const adminCall = (base, body, token = ADMIN) =>
  fetch(`${base}/api/admin/newsletter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

test("newsletter admin is disabled (404) when ADMIN_TOKEN is not set", async () => {
  const res = await adminCall(main.base, { subject: "s", body: "b" });
  assert.strictEqual(res.status, 404);
});

test("newsletter admin rejects a missing or wrong token", async () => {
  const store = createFileStore(path.join(tmpDir, "admin-auth.json"));
  const app = await listen(createApp(store, { adminToken: ADMIN }));
  try {
    assert.strictEqual((await adminCall(app.base, { subject: "s", body: "b" }, "")).status, 401);
    assert.strictEqual((await adminCall(app.base, { subject: "s", body: "b" }, "wrong")).status, 401);
  } finally {
    stop(app.server);
  }
});

test("newsletter admin previews by default and sends only to confirmed subscribers", async () => {
  const store = createFileStore(path.join(tmpDir, "admin-send.json"));
  const confirmed = await store.subscribe("yes@example.com");
  await store.confirm(confirmed.token);
  await store.subscribe("pending@example.com"); // never confirmed

  const batches = [];
  const fakeMailer = {
    sendConfirmation: async () => {},
    sendNewsletter: async (messages) => {
      batches.push(messages);
      return { sent: messages.length, failed: 0 };
    },
  };
  const app = await listen(
    createApp(store, { adminToken: ADMIN, mailer: fakeMailer, publicUrl: "https://cto.example" })
  );
  try {
    // 400 for invalid input
    assert.strictEqual((await adminCall(app.base, { subject: "", body: "b" })).status, 400);
    assert.strictEqual((await adminCall(app.base, { subject: "s" })).status, 400);

    // No "send": true -> preview only
    const preview = await (await adminCall(app.base, { subject: "Issue 1", body: "Hello" })).json();
    assert.strictEqual(preview.preview, true);
    assert.strictEqual(preview.recipients, 1);
    assert.strictEqual(batches.length, 0);

    // "send": true -> one personal message to the confirmed subscriber
    const sentRes = await (await adminCall(app.base, { subject: "Issue 1", body: "Hello", send: true })).json();
    assert.strictEqual(sentRes.sent, 1);
    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0][0].email, "yes@example.com");
    assert.ok(
      batches[0][0].unsubscribeUrl.startsWith("https://cto.example/api/unsubscribe?token=")
    );
  } finally {
    stop(app.server);
  }
});