const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { esc, withMeta } = require("./seo");
const { buildNewsletterMessages } = require("./newsletter");

const DEFAULT_DIST = path.join(__dirname, "..", "client", "dist");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN_RE = /^[a-f0-9]{48}$/;
const MAX_EMAIL_LENGTH = 254;
const SITE_NAME = "CTO Journal";

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 8000; // stays under the 10kb JSON body limit

// Constant-time comparison so the admin token can't be guessed from response timing
const safeEqual = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Express 4 doesn't catch rejected promises, so route them to the error handler
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Only accept a token that is exactly the shape we generate. This also stops
// objects like ?token[$ne]=x from ever reaching the database.
const tokenFrom = (req) => {
  const t = req.query.token;
  return typeof t === "string" && TOKEN_RE.test(t) ? t : null;
};

function createApp(
  store,
  {
    subscribeLimit = 10,
    linkLimit = 60,
    adminLimit = 10,
    mailer = {
      sendConfirmation: async () => {},
      sendNewsletter: async (messages) => ({ sent: messages.length, failed: 0 }),
    },
    publicUrl = "",
    adminToken = "",
    distDir = DEFAULT_DIST,
  } = {}
) {
  const app = express();

  // Render sits behind one proxy; needed so rate limiting sees the real client IP
  app.set("trust proxy", 1);

  // Links in emails must not depend on the request's Host header (it can be forged),
  // so use PUBLIC_URL when configured
  const baseUrl = (req) =>
    (publicUrl || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          fontSrc: ["'self'", "data:"], // fonts are self-hosted; data: covers tiny inlined files
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

  // With MongoDB the counters are shared by all instances; otherwise they live in memory.
  // If the shared store is briefly unavailable, requests are allowed rather than blocked.
  const makeLimiter = (name, limit) => {
    const sharedStore = store.rateLimitStore?.(name);
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        status: 429,
        message: "Too many attempts. Please try again in a few minutes.",
      },
      ...(sharedStore ? { store: sharedStore, passOnStoreError: true } : {}),
    });
  };

  const subscribeLimiter = makeLimiter("subscribe", subscribeLimit);
  // Confirm / unsubscribe links get a looser limit so token guessing is still throttled
  const linkLimiter = makeLimiter("link", linkLimit);
  // Applied before the token check, so guessing the admin token is throttled too
  const adminLimiter = makeLimiter("admin", adminLimit);

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

      const result = await store.subscribe(email);

      if (result.action === "confirm") {
        const base = baseUrl(req);
        const links = {
          confirmUrl: `${base}/api/confirm?token=${result.token}`,
          unsubscribeUrl: `${base}/api/unsubscribe?token=${result.token}`,
        };
        // Not awaited, so response time doesn't reveal whether the address was new.
        // A failed send is logged; the person can simply submit the form again.
        Promise.resolve(mailer.sendConfirmation(email, links)).catch((err) =>
          console.error("Confirmation email failed:", err.message)
        );
      }

      // Same response for new, pending and already-confirmed addresses,
      // so the endpoint can't be used to check who is subscribed
      res.status(200).json({
        status: 200,
        message: "Please check your inbox to confirm your subscription",
      });
    })
  );

  app.get(
    "/api/confirm",
    linkLimiter,
    wrap(async (req, res) => {
      const token = tokenFrom(req);
      const ok = token ? await store.confirm(token) : false;
      res.redirect(303, `/?subscription=${ok ? "confirmed" : "invalid"}`);
    })
  );

  app.get(
    "/api/unsubscribe",
    linkLimiter,
    wrap(async (req, res) => {
      const token = tokenFrom(req);
      const ok = token ? await store.unsubscribe(token) : false;
      res.redirect(303, `/?subscription=${ok ? "unsubscribed" : "invalid"}`);
    })
  );

  // One-click unsubscribe (RFC 8058): mail clients POST to the List-Unsubscribe URL
  app.post(
    "/api/unsubscribe",
    linkLimiter,
    wrap(async (req, res) => {
      const token = tokenFrom(req);
      const ok = token ? await store.unsubscribe(token) : false;
      if (!ok)
        return res
          .status(400)
          .json({ status: 400, message: "Invalid unsubscribe link" });
      res.json({ status: 200, message: "You have been unsubscribed" });
    })
  );

  // Send a newsletter issue to every confirmed subscriber.
  // Disabled (404) unless ADMIN_TOKEN is set. Without `"send": true` it only previews.
  app.post(
    "/api/admin/newsletter",
    adminLimiter,
    wrap(async (req, res) => {
      if (!adminToken)
        return res.status(404).json({ status: 404, message: "Not found" });

      const header = req.get("authorization") || "";
      const given = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!given || !safeEqual(given, adminToken))
        return res.status(401).json({ status: 401, message: "Unauthorized" });

      const { subject, body, send } = req.body || {};
      if (
        typeof subject !== "string" ||
        !subject.trim() ||
        subject.length > MAX_SUBJECT_LENGTH ||
        typeof body !== "string" ||
        !body.trim() ||
        body.length > MAX_BODY_LENGTH
      )
        return res.status(400).json({
          status: 400,
          message: `Provide a subject (max ${MAX_SUBJECT_LENGTH} characters) and a body (max ${MAX_BODY_LENGTH} characters)`,
        });

      const { recipients, skipped } = await store.listConfirmed();

      if (send !== true)
        return res.json({
          status: 200,
          preview: true,
          recipients: recipients.length,
          skipped,
          message: 'Nothing was sent. Add "send": true to send this issue.',
        });

      const messages = buildNewsletterMessages(
        recipients,
        { subject: subject.trim(), body: body.trim() },
        baseUrl(req)
      );
      const result = messages.length
        ? await mailer.sendNewsletter(messages)
        : { sent: 0, failed: 0 };

      res.json({ status: 200, preview: false, recipients: recipients.length, skipped, ...result });
    })
  );

  // Unknown /api routes return JSON, not HTML
  app.use("/api", (req, res) =>
    res.status(404).json({ status: 404, message: "Not found" })
  );

  // SEO helpers
  app.get("/robots.txt", (req, res) =>
    res
      .type("text/plain")
      .send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl(req)}/sitemap.xml\n`)
  );

  app.get(
    "/sitemap.xml",
    wrap(async (req, res) => {
      const base = baseUrl(req);
      const posts = await store.listPosts();
      const urls = [`${base}/`, ...posts.map((p) => `${base}/post/${p.id}`)];
      res
        .type("application/xml")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n") +
            `\n</urlset>\n`
        );
    })
  );

  // Serve the built React app only when it exists (production)
  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    const indexHtml = fs.readFileSync(indexPath, "utf8");

    app.use(express.static(distDir, { index: false }));

    app.get(
      "/post/:id",
      wrap(async (req, res) => {
        const post = /^\d+$/.test(req.params.id)
          ? await store.getPost(Number(req.params.id))
          : null;

        res.type("html");
        if (!post) return res.status(404).send(indexHtml); // the React app shows "not found"

        res.send(
          withMeta(indexHtml, {
            title: `${post.title} · ${SITE_NAME}`,
            description: post.excerpt,
            url: `${baseUrl(req)}/post/${post.id}`,
          })
        );
      })
    );

    app.get("*", (req, res) => res.type("html").send(indexHtml));
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