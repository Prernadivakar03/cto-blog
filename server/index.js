const { createApp } = require("./app");
const { createStore } = require("./storage");
const { createMailer } = require("./mailer");

const PORT = process.env.PORT || 3000;

async function main() {
  const store = await createStore();
  const mailer = createMailer();
  const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
  const adminToken = process.env.ADMIN_TOKEN || "";

  if (adminToken && adminToken.length < 24)
    throw new Error("ADMIN_TOKEN must be at least 24 characters long");

  if (process.env.NODE_ENV === "production") {
    if (mailer.kind === "console")
      console.warn(
        "RESEND_API_KEY / MAIL_FROM not set: confirmation emails are NOT being sent, so nobody can confirm a subscription."
      );
    if (!publicUrl)
      console.warn(
        "PUBLIC_URL not set: links in emails and the sitemap will use the request's Host header."
      );
  }

  const app = createApp(store, { mailer, publicUrl, adminToken });

  const server = app.listen(PORT, () =>
    console.log(
      `Server running on port ${PORT} (storage: ${store.kind}, mail: ${mailer.kind}, newsletter admin: ${adminToken ? "on" : "off"})`
    )
  );

  // Graceful shutdown so Render restarts don't drop in-flight requests
  const shutdown = () => {
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});