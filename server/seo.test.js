const { test } = require("node:test");
const assert = require("node:assert");
const { withMeta } = require("./seo");

const template = `<!DOCTYPE html>
<html><head>
  <title>Site</title>
  <meta name="description" content="Default description" />
  <meta property="og:title" content="Default og title" />
  <meta property="og:description" content="Default og description" />
  <meta property="og:type" content="website" />
</head><body></body></html>`;

test("withMeta rewrites title, description and Open Graph tags for an article", () => {
  const out = withMeta(template, {
    title: "Post · CTO Journal",
    description: "A short excerpt.",
    url: "https://example.com/post/3",
  });
  assert.match(out, /<title>Post · CTO Journal<\/title>/);
  assert.match(out, /name="description" content="A short excerpt\."/);
  assert.match(out, /property="og:title" content="Post · CTO Journal"/);
  assert.match(out, /property="og:description" content="A short excerpt\."/);
  assert.match(out, /property="og:type" content="article"/);
  assert.match(out, /rel="canonical" href="https:\/\/example\.com\/post\/3"/);
  assert.match(out, /property="og:url" content="https:\/\/example\.com\/post\/3"/);
});

test("withMeta escapes HTML and does not treat $ patterns specially", () => {
  const out = withMeta(template, {
    title: `"><script>alert(1)</script> $& $1`,
    description: "x",
    url: "https://example.com/post/1",
  });
  assert.ok(!out.includes("<script>"));
  assert.ok(out.includes("&lt;script&gt;"));
  assert.ok(out.includes("$&amp; $1") || out.includes("$& $1"));
});
