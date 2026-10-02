const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const SUBS_FILE = path.join(__dirname, ".tmp", "subscribers.json");
const readSubscribers = () => JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"));

test.describe("reading", () => {
  test("home page lists the articles and search filters them", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator("article.card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(3);

        const firstTitle = ((await cards.first().locator("h3").textContent()) ?? "").trim();
    await page.getByLabel("Search posts").fill(firstTitle);
    await expect(cards.first().locator("h3")).toHaveText(firstTitle);

    await page.getByLabel("Search posts").fill("zzzzqqqq");
    await expect(page.getByText(/no articles match/i)).toBeVisible();
  });

  test("clicking an article opens a real /post/:id URL and the back link returns home", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /read article/i }).first().click();

    await expect(page).toHaveURL(/\/post\/\d+$/);
    await expect(page.locator("main.article h1")).toBeVisible();
    await expect(page).toHaveTitle(/· CTO Journal/);

    await page.getByRole("link", { name: /all articles/i }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("article.card").first()).toBeVisible();
  });

  test("an article URL works when opened directly or reloaded", async ({ page }) => {
    await page.goto("/post/1");
    await expect(page.locator("main.article h1")).toBeVisible();
    await page.reload();
    await expect(page.locator("main.article h1")).toBeVisible();
  });

  test("the server puts article-specific tags in the HTML, for search engines and link previews", async ({ request }) => {
    const html = await (await request.get("/post/1")).text();
    expect(html).toMatch(/<title>.+ · CTO Journal<\/title>/);
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('property="og:type" content="article"');
  });

  test("an unknown article shows a not-found message and a 404", async ({ page, request }) => {
    expect((await request.get("/post/9999")).status()).toBe(404);
    await page.goto("/post/9999");
    await expect(page.getByText(/couldn't find that article/i)).toBeVisible();
  });

  test("sitemap and robots.txt are served", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/post/1");
    expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  });
});

test.describe("newsletter", () => {
  test("subscribe, confirm by email link, then unsubscribe", async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;

    await page.goto("/");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText(/check your inbox/i)).toBeVisible();

    // No real email is sent in this test setup, so read the token the server saved
    const saved = readSubscribers().find((s) => s.email === email);
    expect(saved.status).toBe("pending");

    await page.goto(`/api/confirm?token=${saved.token}`);
    await expect(page.getByText(/subscription is confirmed/i)).toBeVisible();
    expect(readSubscribers().find((s) => s.email === email).status).toBe("confirmed");

    await page.goto(`/api/unsubscribe?token=${saved.token}`);
    await expect(page.getByText(/unsubscribed/i)).toBeVisible();
    expect(readSubscribers().find((s) => s.email === email).status).toBe("unsubscribed");
  });

  test("an invalid email is rejected in the form", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email address").fill("abc@site");
    await page.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText(/doesn't look like a valid email/i)).toBeVisible();
  });

  test("a bad confirmation link shows an invalid-link notice", async ({ page }) => {
    await page.goto(`/api/confirm?token=${"f".repeat(48)}`);
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test("search, cards and the subscribe form fit a phone screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Search posts")).toBeVisible();

    const card = page.locator("article.card").first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(375);

    await expect(page.getByLabel("Email address")).toBeVisible();
  });
});