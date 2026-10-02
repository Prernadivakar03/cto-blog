// The same behaviour tests run against the file store and, when MONGODB_TEST_URI
// is set, against a real MongoDB database (a throwaway database that is dropped after).
const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createFileStore, createMongoStore } = require("./storage");

const TOKEN_RE = /^[a-f0-9]{48}$/;
let counter = 0;
const nextEmail = () => `user${++counter}-${Date.now()}@example.com`;

function runContract(label, makeStore, options = {}) {
  const t = (name, fn) => test(`${label}: ${name}`, options, fn);

  t("subscribe creates a pending subscriber and returns a token", async () => {
    const store = await makeStore();
    const res = await store.subscribe(nextEmail());
    assert.strictEqual(res.action, "confirm");
    assert.match(res.token, TOKEN_RE);
  });

  t("subscribing again while pending reuses the same token", async () => {
    const store = await makeStore();
    const email = nextEmail();
    const first = await store.subscribe(email);
    const second = await store.subscribe(email);
    assert.strictEqual(second.action, "confirm");
    assert.strictEqual(second.token, first.token);
  });

  t("confirm works, is idempotent, and stops further confirmation emails", async () => {
    const store = await makeStore();
    const email = nextEmail();
    const { token } = await store.subscribe(email);
    assert.strictEqual(await store.confirm(token), true);
    assert.strictEqual(await store.confirm(token), true);
    assert.deepStrictEqual(await store.subscribe(email), { action: "none" });
  });

  t("confirm and unsubscribe reject unknown or malformed tokens", async () => {
    const store = await makeStore();
    assert.strictEqual(await store.confirm("f".repeat(48)), false);
    assert.strictEqual(await store.unsubscribe("f".repeat(48)), false);
    assert.strictEqual(await store.confirm({ $ne: "" }), false);
    assert.strictEqual(await store.unsubscribe(undefined), false);
  });

  t("listConfirmed returns only confirmed subscribers with their tokens", async () => {
    const store = await makeStore();
    const confirmed = await store.subscribe(nextEmail());
    const pending = await store.subscribe(nextEmail());
    const gone = await store.subscribe(nextEmail());
    await store.confirm(confirmed.token);
    await store.confirm(gone.token);
    await store.unsubscribe(gone.token);

    const { recipients, skipped } = await store.listConfirmed();
    const tokens = recipients.map((r) => r.token);
    assert.ok(tokens.includes(confirmed.token));
    assert.ok(!tokens.includes(pending.token));
    assert.ok(!tokens.includes(gone.token));
    assert.strictEqual(typeof skipped, "number");
  });

  t("unsubscribe blocks later confirmation, and the person can sign up again", async () => {
    const store = await makeStore();
    const email = nextEmail();
    const { token } = await store.subscribe(email);
    await store.confirm(token);

    assert.strictEqual(await store.unsubscribe(token), true);
    assert.strictEqual(await store.unsubscribe(token), true); // idempotent
    assert.strictEqual(await store.confirm(token), false);

    const again = await store.subscribe(email);
    assert.strictEqual(again.action, "confirm");
    assert.strictEqual(await store.confirm(again.token), true);
  });
}

// File store: always runs
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cto-contract-"));
let fileCount = 0;
runContract("file store", () =>
  createFileStore(path.join(tmpDir, `subs-${++fileCount}.json`))
);
after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

// MongoDB: runs only when MONGODB_TEST_URI is provided (CI starts a Mongo service)
const mongoUri = process.env.MONGODB_TEST_URI;
if (mongoUri) {
  const dbName = `cto_blog_test_${Date.now()}`;
  let storePromise;
  const getMongo = () => {
    process.env.MONGODB_DB = dbName;
    storePromise ||= createMongoStore(mongoUri);
    return storePromise;
  };
  runContract("mongodb store", getMongo);

  test("mongodb store: lists posts without bodies and loads one with its body", async () => {
    const store = await getMongo();
    const list = await store.listPosts();
    assert.ok(list.length >= 3);
    assert.strictEqual(list[0].content, undefined);
    assert.ok(Array.isArray((await store.getPost(1)).content));
  });

  test("mongodb store: unique email index blocks concurrent duplicates", async () => {
    const store = await getMongo();
    const email = nextEmail();
    const results = await Promise.all(Array.from({ length: 5 }, () => store.subscribe(email)));
    // Every call resolves (no crash) and they all agree on one token
    assert.ok(results.every((r) => r.action === "confirm" || r.action === "none"));
    const tokens = new Set(results.filter((r) => r.token).map((r) => r.token));
    assert.strictEqual(tokens.size, 1);
  });

  test("mongodb store: shared rate-limit counter counts, resets and expires", async () => {
    const store = await getMongo();
    const limiter = store.rateLimitStore(`t${Date.now()}`);
    limiter.init({ windowMs: 60000 });

    assert.strictEqual((await limiter.increment("1.2.3.4")).totalHits, 1);
    assert.strictEqual((await limiter.increment("1.2.3.4")).totalHits, 2);
    assert.strictEqual((await limiter.increment("9.9.9.9")).totalHits, 1);
    await limiter.decrement("1.2.3.4");
    assert.strictEqual((await limiter.increment("1.2.3.4")).totalHits, 2);
    await limiter.resetKey("1.2.3.4");
    assert.strictEqual((await limiter.increment("1.2.3.4")).totalHits, 1);

    const short = store.rateLimitStore(`s${Date.now()}`);
    short.init({ windowMs: 50 });
    assert.strictEqual((await short.increment("x")).totalHits, 1);
    await new Promise((r) => setTimeout(r, 120));
    assert.strictEqual((await short.increment("x")).totalHits, 1); // new window
  });

  after(async () => {
    const store = await getMongo();
    const { MongoClient } = require("mongodb");
    const c = new MongoClient(mongoUri);
    await c.connect();
    await c.db(dbName).dropDatabase();
    await c.close();
    await store.close();
  });
} else {
  test("mongodb store tests (set MONGODB_TEST_URI to run them)", { skip: true }, () => {});
}