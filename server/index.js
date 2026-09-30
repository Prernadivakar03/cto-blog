const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SUBS_FILE = path.join(__dirname, "subscribers.json");
const POSTS_FILE = path.join(__dirname, "data", "posts.json");
const DIST = path.join(__dirname, "..", "client", "dist");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

app.use(express.json());

const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
};

// GET /api/posts
app.get("/api/posts", (req, res) => {
  const posts = readJSON(POSTS_FILE);
  res.json({ status: 200, count: posts.length, posts });
});

// POST /api/subscribe
app.post("/api/subscribe", (req, res) => {
  const email = (req.body?.email ?? "").toString().trim().toLowerCase();

  if (!email)
    return res.status(400).json({ status: 400, message: "Email is required" });
  if (!EMAIL_RE.test(email))
    return res
      .status(400)
      .json({ status: 400, message: "Please enter a valid email address" });

  const subs = readJSON(SUBS_FILE);
  if (subs.some((s) => s.email === email))
    return res
      .status(409)
      .json({ status: 409, message: "You're already subscribed" });

  subs.push({ email, subscribedAt: new Date().toISOString() });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));

  res.status(200).json({ status: 200, message: "Subscription successful" });
});

// Serve the built React app only when it exists (production)
if (fs.existsSync(path.join(DIST, "index.html"))) {
  app.use(express.static(DIST));
  app.get("*", (req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  app.get("/", (req, res) =>
    res.send("API is running. Open the frontend at http://localhost:5173")
  );
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));