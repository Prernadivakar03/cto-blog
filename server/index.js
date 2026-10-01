const { createApp } = require("./app");
const { createStore } = require("./storage");

const PORT = process.env.PORT || 3000;

async function main() {
  const store = await createStore();
  const app = createApp(store);

  const server = app.listen(PORT, () =>
    console.log(`Server running on port ${PORT} (storage: ${store.kind})`)
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