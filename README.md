# CTO Journal: Construction Trade Promotion Organization

A responsive single-page blog for the Construction Trade Promotion Organization (CTO) / Alpha Konnect Koncepts. It has live title search, full article pages, a posts API, and a double opt-in newsletter (confirmation, unsubscribe and sending) backed by MongoDB.

**Live demo:** https://cto-blog.onrender.com/

> Hosted on Render's free tier. After idle time the first load can take 30 to 50 seconds while the service wakes up.

---

## Features

**Frontend**
- Header with the Alpha Konnect Koncepts logo and a search bar
- Real-time filtering of posts by title as you type
- Grid of 5 posts, each with title, excerpt, date, category tag and a generated SVG blueprint thumbnail
- Full article pages at `/post/:id` (real URLs, with server-rendered title, description and Open Graph tags), with a back link, a per-article tab title and meta description
- Fully responsive for mobile, tablet and desktop
- Footer with copyright and working navigation links
- Newsletter form with frontend validation, a loading spinner, a success message and a cleared input
- Accessibility: skip link, visible focus styles, ARIA live regions, reduced-motion support
- Error boundary so a render crash shows a message instead of a blank page

**Backend**
- `GET /api/posts`, `GET /api/posts/:id`, `POST /api/subscribe`, `GET /api/confirm`, `GET|POST /api/unsubscribe`, `POST /api/admin/newsletter`, `GET /api/health`, plus `/sitemap.xml` and `/robots.txt`
- Double opt-in newsletter: confirmation email, one-click unsubscribe, and an admin endpoint that sends an issue to confirmed subscribers
- MongoDB storage with a unique email index; JSON-file storage for local development
- Rate limiting shared across server instances when MongoDB is used, security headers, strict input validation, JSON errors everywhere

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, plain CSS, self-hosted fonts (Fontsource) |
| Backend | Node.js 20+, Express |
| Database | MongoDB Atlas (JSON-file fallback for local dev) |
| Email | Resend (HTTP API) |
| Testing | Node test runner, Vitest, React Testing Library, Playwright |
| Quality | ESLint (flat config) |
| CI / Hosting | GitHub Actions, Render |

---

## Project Structure

```
cto-blog/
├── package.json              # root scripts used by Render, CI and tests
├── eslint.config.mjs         # lint rules for server, client and tests
├── playwright.config.js      # end-to-end test setup (starts the real server)
├── render.yaml               # Render service definition
├── .github/workflows/ci.yml  # lint, tests, build and e2e on every push
├── e2e/
│   ├── blog.spec.js          # browser tests: reading, newsletter, mobile
│   └── global-setup.js       # empties the test subscriber file before each run
├── server/
│   ├── index.js              # startup + graceful shutdown
│   ├── app.js                # Express app: routes, security, errors
│   ├── storage.js            # MongoDB store, JSON-file store, post sync
│   ├── rateLimitStore.js     # MongoDB-backed rate-limit counters (shared across instances)
│   ├── mailer.js             # Resend email sending, console fallback for local dev
│   ├── newsletter.js         # builds one personal email per subscriber
│   ├── seo.js                # per-article title, description and Open Graph tags
│   ├── *.test.js             # API, storage, contract, mailer, newsletter and SEO tests
│   └── data/posts.json       # source of truth for posts, synced to MongoDB on startup
└── client/
    ├── vite.config.js        # dev proxy + Vitest config
    ├── .env.example          # VITE_CONTACT_EMAIL
    └── src/
        ├── main.jsx
        ├── App.jsx           # data fetching, search state, path routing
        ├── router.js         # History API helpers for /post/:id
        ├── styles.css
        ├── test-setup.js
        ├── assets/           # logo files
        └── components/
            ├── Header.jsx
            ├── PostCard.jsx
            ├── Article.jsx
            ├── Thumb.jsx         # generated SVG thumbnails
            ├── Newsletter.jsx
            ├── Footer.jsx
            ├── ErrorBoundary.jsx
            └── *.test.jsx        # component tests
```

---

## API Reference

### `GET /api/posts`
Returns all posts (without article bodies), newest first.
```json
{ "status": 200, "count": 5, "posts": [ { "id": 1, "title": "...", "excerpt": "...", "date": "2026-09-22", "category": "3D Printing" } ] }
```

### `GET /api/posts/:id`
Returns one post including its `content` array. Unknown ids return `404`.

### `POST /api/subscribe`
Request: `{ "email": "you@example.com" }`

| Status | Message | When |
|---|---|---|
| 200 | `Please check your inbox to confirm your subscription` | Signup accepted. A confirmation email is sent (double opt-in). Same reply for new, pending and confirmed addresses |
| 400 | `Email is required` | Missing, empty or non-string email |
| 400 | `Please enter a valid email address` | Bad format or over 254 characters |
| 400 | `Invalid JSON body` | Malformed request body |
| 413 | `Request too large` | Body over 10kb |
| 429 | `Too many attempts...` | More than 10 requests per 15 minutes per IP |

### `GET /api/confirm?token=...` and `GET|POST /api/unsubscribe?token=...`
Links sent in the email. Both redirect to `/?subscription=confirmed|unsubscribed|invalid`; `POST /api/unsubscribe` supports one-click unsubscribe and returns JSON. Tokens are 48 hex characters and anything else is rejected before reaching the database.

Repeat signups also return `200`, so the endpoint can't be used to check whether an address is subscribed.

### `POST /api/admin/newsletter`
Sends one issue to every confirmed subscriber, each email with its own unsubscribe link.

- Disabled (`404`) unless the `ADMIN_TOKEN` environment variable is set (at least 24 characters).
- Requires the header `Authorization: Bearer <ADMIN_TOKEN>`; a missing or wrong token returns `401`. Requests are rate limited before the token is checked, so guessing is throttled.
- Request: `{ "subject": "...", "body": "...", "send": true }`. Blank lines in `body` become paragraphs.
- Without `"send": true` it only previews and returns the recipient count. Nothing is emailed.

```bash
# preview
curl -X POST https://cto-blog.onrender.com/api/admin/newsletter \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"subject":"October issue","body":"Hello subscribers."}'

# send: same request with "send": true added to the JSON
```

### `GET /api/health`
Returns `{ "status": 200, "storage": "mongodb" }` or `"file"`, showing which backend is active.

---

## Running Locally

Requires Node.js 20 or newer.

```bash
git clone https://github.com/Prernadivakar03/cto-blog.git
cd cto-blog

# terminal 1: backend
cd server && npm install && npm run dev      # http://localhost:3000

# terminal 2: frontend
cd client && npm install && npm run dev      # http://localhost:5173
```

Without `MONGODB_URI`, the server stores subscribers in `server/subscribers.json`. To use MongoDB locally, set `MONGODB_URI` before starting the server. Without `RESEND_API_KEY` and `MAIL_FROM`, confirmation links are printed in the server console instead of emailed.

Production build test:
```bash
npm run build && npm start     # http://localhost:3000
```

---

## Testing

```bash
npm run install:all   # installs root, server and client dependencies once
npm test              # server + client
npm run lint          # ESLint

npx playwright install chromium   # once, downloads the test browser
npm run build                     # the e2e tests run against the real built app
npm run test:e2e                  # browser tests
```
To also run the server tests against a real MongoDB: `MONGODB_TEST_URI=mongodb://localhost:27017 npm test --prefix server` (CI does this with a Mongo service container).

- **Server (Node test runner):** 39 tests run without a database: posts routes, security headers, all subscribe cases, confirm and unsubscribe, the admin newsletter endpoint (disabled, unauthorized, preview, send), rate limiting, mailer and newsletter builders, SEO tags, and post sync logic. When `MONGODB_TEST_URI` is set, the same storage behaviour tests also run against a real MongoDB, including the shared rate-limit counter.
- **Client (Vitest + React Testing Library, 16 tests):** live search filtering, routing, article page, newsletter validation, success, server error and non-JSON error handling
- **End-to-end (Playwright, 10 tests):** search, real `/post/:id` URLs and reloads, article tags in the served HTML, 404 handling, sitemap and robots.txt, the full subscribe, confirm and unsubscribe flow, form validation, and a mobile-width layout
- **CI:** GitHub Actions runs lint, both test suites against a real MongoDB, the production build and the browser tests on every push

The post sync unit tests use an in-memory stand-in for the MongoDB collection; the real-database behaviour is covered by the contract tests above.

---

## Deployment (Render)

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

| Environment variable | Purpose |
|---|---|
| `NODE_VERSION` | `20` |
| `MONGODB_URI` | MongoDB Atlas connection string (secret) |
| `MONGODB_DB` | Optional database name (default `cto_blog`) |
| `PUBLIC_URL` | Public site URL, used in email links, canonical URLs and the sitemap |
| `RESEND_API_KEY`, `MAIL_FROM` | Enable emails via Resend. Without them links are only logged |
| `ADMIN_TOKEN` | At least 24 random characters. Enables `/api/admin/newsletter`; the endpoint stays off when unset |
| `VITE_CONTACT_EMAIL` | Optional footer Contact link (build time). Hidden when unset |
| `ALLOW_FILE_FALLBACK` | Optional. Set to `true` to allow file storage if MongoDB is unreachable. Off by default so signups are never silently lost |

If `MONGODB_URI` is set but the database can't be reached, the server refuses to start and logs the reason, instead of quietly falling back to a disk that Render resets.

---

## Managing Posts

`server/data/posts.json` is the source of truth. On every start the server syncs it into MongoDB: new and edited posts are upserted, and posts removed from the file are deleted from the database. An empty or unreadable file never wipes the collection. Edit posts in `posts.json` and redeploy; changes made directly in Atlas are overwritten on the next restart.

---

## Security

- Helmet security headers with a Content Security Policy (no external script, style or font sources)
- Rate limiting on signup, on confirm and unsubscribe links, and on the admin endpoint. With MongoDB the counters are shared by every instance; without it they are kept in memory
- Admin endpoint is off unless configured, uses a bearer token compared in constant time, and is rate limited before the token check
- Validation: type check, format check, 254-character limit, 10kb body limit, 48-hex-character tokens
- Identical response for new and repeat signups, so subscriber membership can't be probed
- Unique database index makes duplicate protection atomic under concurrent requests
- Atomic writes for the file store; JSON errors with no stack traces
- Secrets live in environment variables, never in the repo; no personal email address in the source

---

## Design Notes

A "blueprint and gold" look: charcoal and gold taken from the Alpha Konnect Koncepts logo, a technical-drawing grid, condensed uppercase headings (Barlow Condensed) with Inter for body text, numbered cards, and a featured first post. Fonts are self-hosted via Fontsource. Thumbnails are generated SVGs, so there are no external image dependencies.

---

## Known Limitations and Next Steps

- **Confirmation links are GET requests**, so mail scanners that prefetch links can confirm or unsubscribe someone automatically. A confirm button on a page (POST) would fix this.
- **Confirmation and unsubscribe tokens do not expire**, and one token serves both links.
- **Sending an issue is an API call**, not a screen. An admin UI for writing and sending issues would be the next step.
- **Atlas access list uses `0.0.0.0/0`** because Render's free tier has no fixed outbound IP. Production would use static IPs or a private endpoint.
- **Posts are edited in `posts.json`.** A posts editor would be the next step.
- **The shared rate limiter fails open**: if MongoDB is briefly unavailable, requests are allowed rather than blocked.

---

## Author

`Prerna Divakar`