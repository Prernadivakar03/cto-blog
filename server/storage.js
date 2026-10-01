const fs = require("fs");
const path = require("path");

const POSTS_FILE = path.join(__dirname, "data", "posts.json");
const DEFAULT_SUBS_FILE = path.join(__dirname, "subscribers.json");

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

function createFileStore(subsFile = DEFAULT_SUBS_FILE) {
  return {
    kind: "file",
    async listPosts() {
      return readJSON(POSTS_FILE)
        .map(({ content, ...rest }) => rest)
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    async getPost(id) {
      return readJSON(POSTS_FILE).find((p) => p.id === id) || null;
    },
    async addSubscriber(email) {
      const subs = readJSON(subsFile);
      if (subs.some((s) => s.email === email)) return "duplicate";
      subs.push({ email, subscribedAt: new Date().toISOString() });
      writeJSONAtomic(subsFile, subs);
      return "created";
    },
    async close() {},
  };
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

  // posts.json is the source of truth: sync it into the database on every start
  await posts.bulkWrite(
    readJSON(POSTS_FILE).map((p) => ({
      replaceOne: { filter: { id: p.id }, replacement: p, upsert: true },
    }))
  );

  return {
    kind: "mongodb",
    listPosts: () =>
      posts
        .find({}, { projection: { _id: 0, content: 0 } })
        .sort({ date: -1 })
        .toArray(),
    getPost: (id) => posts.findOne({ id }, { projection: { _id: 0 } }),
    async addSubscriber(email) {
      try {
        await subs.insertOne({ email, subscribedAt: new Date().toISOString() });
        return "created";
      } catch (err) {
        if (err.code === 11000) return "duplicate";
        throw err;
      }
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

module.exports = { createStore, createFileStore };