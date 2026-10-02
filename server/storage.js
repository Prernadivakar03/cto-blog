const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoRateLimitStore } = require("./rateLimitStore");

const POSTS_FILE = path.join(__dirname, "data", "posts.json");
const DEFAULT_SUBS_FILE = path.join(__dirname, "subscribers.json");

// 24 random bytes -> 48 hex characters. Used in confirm / unsubscribe links.
const newToken = () => crypto.randomBytes(24).toString("hex");

// Subscribers saved before double opt-in existed have no status; treat them as confirmed
const statusOf = (sub) => sub.status ?? "confirmed";

const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
};

// Write to a temp file, then rename, so a crash can't corrupt the data
const writeJSONAtomic = (file, data) => {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
};

/*
 * Subscriber store contract (identical for the file and MongoDB stores):
 *
 *   subscribe(email)   -> { action: "confirm", token } when a confirmation email
 *                         should be sent (new, still pending, or re-subscribing)
 *                      -> { action: "none" } when already confirmed
 *   confirm(token)     -> true if the token is valid (idempotent), else false
 *   unsubscribe(token) -> true if the token exists, else false
 *   listConfirmed()    -> { recipients: [{ email, token }], skipped } where skipped counts
 *                         confirmed people with no token (they can't get an unsubscribe link)
 */
function createFileStore(subsFile = DEFAULT_SUBS_FILE) {
  const posts = () => readJSON(POSTS_FILE);

  return {
    kind: "file",
    async listPosts() {
      return posts()
        .map(({ content, ...rest }) => rest)
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    async getPost(id) {
      return posts().find((p) => p.id === id) || null;
    },
    async subscribe(email) {
      const subs = readJSON(subsFile);
      const existing = subs.find((s) => s.email === email);

      if (existing) {
        if (statusOf(existing) === "confirmed") return { action: "none" };
        existing.status = "pending";
        existing.token = existing.token || newToken();
        writeJSONAtomic(subsFile, subs);
        return { action: "confirm", token: existing.token };
      }

      const token = newToken();
      subs.push({
        email,
        token,
        status: "pending",
        subscribedAt: new Date().toISOString(),
      });
      writeJSONAtomic(subsFile, subs);
      return { action: "confirm", token };
    },
    async confirm(token) {
      if (typeof token !== "string" || !token) return false;
      const subs = readJSON(subsFile);
      const sub = subs.find((s) => s.token === token);
      if (!sub) return false;
      if (statusOf(sub) === "confirmed") return true;
      if (sub.status === "unsubscribed") return false;
      sub.status = "confirmed";
      sub.confirmedAt = new Date().toISOString();
      writeJSONAtomic(subsFile, subs);
      return true;
    },
    async unsubscribe(token) {
      if (typeof token !== "string" || !token) return false;
      const subs = readJSON(subsFile);
      const sub = subs.find((s) => s.token === token);
      if (!sub) return false;
      if (sub.status !== "unsubscribed") {
        sub.status = "unsubscribed";
        sub.unsubscribedAt = new Date().toISOString();
        writeJSONAtomic(subsFile, subs);
      }
      return true;
    },
    async listConfirmed() {
      const confirmed = readJSON(subsFile).filter((s) => statusOf(s) === "confirmed");
      const recipients = confirmed
        .filter((s) => s.token)
        .map(({ email, token }) => ({ email, token }));
      return { recipients, skipped: confirmed.length - recipients.length };
    },
    async close() {},
  };
}

// posts.json is the source of truth: upsert every post, delete any that were removed
async function syncPosts(collection, seed) {
  if (!seed.length) return; // never wipe the collection because of an empty or bad file
  await collection.bulkWrite(
    seed.map((p) => ({
      replaceOne: { filter: { id: p.id }, replacement: p, upsert: true },
    }))
  );
  await collection.deleteMany({ id: { $nin: seed.map((p) => p.id) } });
}

async function createMongoStore(uri) {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();

  const db = client.db(process.env.MONGODB_DB || "cto_blog");
  const subs = db.collection("subscribers");
  const posts = db.collection("posts");

  // The unique index makes duplicate protection atomic, even under concurrent requests
  await subs.createIndex({ email: 1 }, { unique: true });
  // Sparse so older subscribers without a token don't collide on "missing"
  await subs.createIndex({ token: 1 }, { unique: true, sparse: true });

  // Shared rate-limit counters; expired windows are removed automatically
  const limits = db.collection("ratelimits");
  await limits.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });

  await syncPosts(posts, readJSON(POSTS_FILE));

  const confirmedFilter = { $or: [{ status: "confirmed" }, { status: { $exists: false } }] };

  return {
    kind: "mongodb",
    rateLimitStore: (prefix) => new MongoRateLimitStore(limits, prefix),
    listPosts: () =>
      posts
        .find({}, { projection: { _id: 0, content: 0 } })
        .sort({ date: -1 })
        .toArray(),
    getPost: (id) => posts.findOne({ id }, { projection: { _id: 0 } }),
    async subscribe(email) {
      const token = newToken();
      try {
        await subs.insertOne({
          email,
          token,
          status: "pending",
          subscribedAt: new Date().toISOString(),
        });
        return { action: "confirm", token };
      } catch (err) {
        if (err.code !== 11000) throw err;
      }

      // Email already exists
      const existing = await subs.findOne({ email });
      if (!existing || statusOf(existing) === "confirmed") return { action: "none" };

      const useToken = existing.token || token;
      await subs.updateOne({ email }, { $set: { status: "pending", token: useToken } });
      return { action: "confirm", token: useToken };
    },
    async confirm(token) {
      if (typeof token !== "string" || !token) return false;
      const res = await subs.updateOne(
        { token, status: "pending" },
        { $set: { status: "confirmed", confirmedAt: new Date().toISOString() } }
      );
      if (res.matchedCount > 0) return true;
      return (await subs.countDocuments({ token, status: "confirmed" })) > 0;
    },
    async unsubscribe(token) {
      if (typeof token !== "string" || !token) return false;
      const res = await subs.updateOne(
        { token },
        { $set: { status: "unsubscribed", unsubscribedAt: new Date().toISOString() } }
      );
      return res.matchedCount > 0;
    },
    async listConfirmed() {
      const recipients = await subs
        .find({ ...confirmedFilter, token: { $exists: true } }, { projection: { _id: 0, email: 1, token: 1 } })
        .toArray();
      const skipped = await subs.countDocuments({ ...confirmedFilter, token: { $exists: false } });
      return { recipients, skipped };
    },
    close: () => client.close(),
  };
}

async function createStore() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return createFileStore(process.env.SUBS_FILE);

  try {
    return await createMongoStore(uri);
  } catch (err) {
    // A configured database that is unreachable must not silently lose signups
    if (process.env.ALLOW_FILE_FALLBACK === "true") {
      console.error("MongoDB failed, using file storage:", err.message);
      return createFileStore(process.env.SUBS_FILE);
    }
    throw err;
  }
}

module.exports = { createStore, createFileStore, createMongoStore, syncPosts };