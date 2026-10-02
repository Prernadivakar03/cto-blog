const { test } = require("node:test");
const assert = require("node:assert");
const { syncPosts } = require("./storage");

// Minimal in-memory stand-in for a MongoDB collection
const fakeCollection = (initial = []) => {
  let docs = [...initial];
  return {
    docs: () => docs,
    async bulkWrite(ops) {
      for (const { replaceOne } of ops) {
        const i = docs.findIndex((d) => d.id === replaceOne.filter.id);
        if (i >= 0) docs[i] = replaceOne.replacement;
        else docs.push(replaceOne.replacement);
      }
    },
    async deleteMany({ id: { $nin } }) {
      docs = docs.filter((d) => $nin.includes(d.id));
    },
  };
};

test("syncPosts inserts posts into an empty collection", async () => {
  const col = fakeCollection();
  await syncPosts(col, [{ id: 1, title: "A" }, { id: 2, title: "B" }]);
  assert.strictEqual(col.docs().length, 2);
});

test("syncPosts overwrites edited posts instead of duplicating them", async () => {
  const col = fakeCollection([{ id: 1, title: "Old" }]);
  await syncPosts(col, [{ id: 1, title: "New" }]);
  assert.strictEqual(col.docs().length, 1);
  assert.strictEqual(col.docs()[0].title, "New");
});

test("syncPosts removes posts that are no longer in the file", async () => {
  const col = fakeCollection([{ id: 1, title: "A" }, { id: 9, title: "Stale" }]);
  await syncPosts(col, [{ id: 1, title: "A" }]);
  assert.deepStrictEqual(col.docs().map((d) => d.id), [1]);
});

test("syncPosts never wipes the collection when the seed is empty", async () => {
  const col = fakeCollection([{ id: 1, title: "A" }]);
  await syncPosts(col, []);
  assert.strictEqual(col.docs().length, 1);
});