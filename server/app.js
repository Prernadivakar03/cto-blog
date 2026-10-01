const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "client", "dist");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

// Express 4 doesn't catch rejected promises, so route them to the error handler
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function createApp(store, { subscribeLimit = 10 } = {}) {
  const app = express();

  // Render sits behind one proxy; needed so rate limiting sees the real client IP
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "https://fonts.googleapis.com"],
          fontSrc: ["https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          "upgrade-insecure-requests": null, // keeps http://localhost working
        },
      },
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "10kb" }));

  // API responses must never be cached
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const subscribeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: subscribeLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: "Too many attempts. Please try again in a few minutes.",
    },
  });

  app.get("/api/health", (req, res) =>
    res.json({ status: 200, storage: store.kind })
  );

  app.get(
    "/api/posts",
    wrap(async (req, res) => {
      const posts = await store.listPosts();
      res.json({ status: 200, count: posts.length, posts });
    })
  );

  app.get(
    "/api/posts/:id",
    wrap(async (req, res) => {
      const post = await store.getPost(Number(req.params.id));
      if (!post)
        return res.status(404).json({ status: 404, message: "Post not found" });
      res.json({ status: 200, post });
    })
  );

  app.post(
    "/api/subscribe",
    subscribeLimiter,
    wrap(async (req, res) => {
      const raw = req.body?.email;

      if (typeof raw !== "string" || !raw.trim())
        return res
          .status(400)
          .json({ status: 400, message: "Email is required" });

      const email = raw.trim().toLowerCase();
      if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email))
        return res
          .status(400)
          .json({ status: 400, message: "Please enter a valid email address" });

      // Same response whether or not the address was already on the list,
      // so the endpoint can't be used to check who is subscribed
      await store.addSubscriber(email);
      res.status(200).json({ status: 200, message: "Subscription successful" });
    })
  );

  // Unknown /api routes return JSON, not HTML
  app.use("/api", (req, res) =>
    res.status(404).json({ status: 404, message: "Not found" })
  );

  // Serve the built React app only when it exists (production)
  if (fs.existsSync(path.join(DIST, "index.html"))) {
    app.use(express.static(DIST));
    app.get("*", (req, res) => res.sendFile(path.join(DIST, "index.html")));
  } else {
    app.get("/", (req, res) =>
      res.send("API is running. Open the frontend at http://localhost:5173")
    );
  }

  // Central error handler: JSON responses, no stack traces leaked
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ status: 400, message: "Invalid JSON body" });
    if (err.type === "entity.too.large")
      return res.status(413).json({ status: 413, message: "Request too large" });
    console.error(err);
    res
      .status(500)
      .json({ status: 500, message: "Something went wrong on the server" });
  });

  return app;
}

module.exports = { createApp };