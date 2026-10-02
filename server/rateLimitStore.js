// A rate-limit store backed by MongoDB, so the limits are shared by every server
// instance (the default store keeps counts in memory, per instance).
// Implements the Store interface used by express-rate-limit v7.

class MongoRateLimitStore {
  // The default memory store sets this to true; shared stores must say false
  localKeys = false;

  constructor(collection, prefix) {
    this.collection = collection;
    this.prefix = prefix;
    this.windowMs = 60 * 1000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  id(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key) {
    const _id = this.id(key);
    const now = new Date();

    // A window that has ended starts over (the TTL index also cleans up, but only every ~60s)
    await this.collection.deleteOne({ _id, resetAt: { $lte: now } });

    const run = () =>
      this.collection.findOneAndUpdate(
        { _id },
        {
          $inc: { hits: 1 },
          $setOnInsert: { resetAt: new Date(now.getTime() + this.windowMs) },
        },
        { upsert: true, returnDocument: "after" }
      );

    let doc;
    try {
      doc = await run();
    } catch (err) {
      // Two first requests racing to create the same key: the loser retries once
      if (err.code !== 11000) throw err;
      doc = await run();
    }
    return { totalHits: doc.hits, resetTime: doc.resetAt };
  }

  async decrement(key) {
    await this.collection.updateOne({ _id: this.id(key) }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await this.collection.deleteOne({ _id: this.id(key) });
  }
}

module.exports = { MongoRateLimitStore };