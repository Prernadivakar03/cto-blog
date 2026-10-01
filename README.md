# CTO Journal: Construction Trade Promotion Organization

A responsive single-page blog for the Construction Trade Promotion Organization (CTO) / Alpha Konnect Koncepts. It has live title search, full article pages, a posts API, and a newsletter form backed by MongoDB.

**Live demo:** https://cto-blog.onrender.com/

> Hosted on Render's free tier. After idle time the first load can take 30 to 50 seconds while the service wakes up.

---

## Features

**Frontend**
- Header with the Alpha Konnect Koncepts logo and a search bar
- Real-time filtering of posts by title as you type
- Grid of 5 posts, each with title, excerpt, date, category tag and a generated SVG blueprint thumbnail
- Full article pages at `#/post/:id`, with a back link, a per-article tab title and meta description
- Fully responsive for mobile, tablet and desktop
- Footer with copyright and working navigation links
- Newsletter form with frontend validation, a loading spinner, a success message and a cleared input
- Accessibility: skip link, visible focus styles, ARIA live regions, reduced-motion support
- Error boundary so a render crash shows a message instead of a blank page

**Backend**
- `GET /api/posts`, `GET /api/posts/:id`, `POST /api/subscribe`, `GET /api/health`
- MongoDB storage with a unique email index; JSON-file storage for local development
- Rate limiting, security headers, strict input validation, JSON errors everywhere

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, plain CSS |
| Backend | Node.js 20+, Express |
| Database | MongoDB Atlas (JSON-file fallback for local dev) |
| Testing | Node test runner, Vitest, React Testing Library |
| CI / Hosting | GitHub Actions, Render |

---

## Project Structure

```
cto-blog/
├── package.json              # root scripts used by Render and tests
├── render.yaml               # Render service definition
├── .github/workflows/ci.yml  # runs tests + build on every push
├── server/
│   ├── index.js              # startup + graceful shutdown
│   ├── app.js                # Express app: routes, security, errors
│   ├── storage.js            # MongoDB store, JSON-file store, post sync
│   ├── api.test.js           # API tests
│   ├── storage.test.js       # post sync tests
│   └── data/posts.json       # source of truth for posts, synced to MongoDB on startup
└── client/
    ├── vite.config.js        # dev proxy + Vitest config
    └── src/
        ├── main.jsx
        ├── App.jsx           # data fetching, search state, hash routing
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
| 200 | `Subscription successful` | Email stored (or already on the list) |
| 400 | `Email is required` | Missing, empty or non-string email |
| 400 | `Please enter a valid email address` | Bad format or over 254 characters |
| 400 | `Invalid JSON body` | Malformed request body |
| 413 | `Request too large` | Body over 10kb |
| 429 | `Too many attempts...` | More than 10 requests per 15 minutes per IP |

Repeat signups also return `200`, so the endpoint can't be used to check whether an address is subscribed.

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

Without `MONGODB_URI`, the server stores subscribers in `server/subscribers.json`. To use MongoDB locally, set `MONGODB_URI` before starting the server.

Production build test:
```bash
npm run build && npm start     # http://localhost:3000
```

---

## Testing

```bash
npm test      # server + client
```
- **Server (Node test runner, 14 tests):** posts routes, security headers, all subscribe cases (missing, non-string, invalid, oversized, success, repeat signup, malformed JSON, rate limiting), and the post sync logic (insert, overwrite, remove stale posts, empty-file guard)
- **Client (Vitest + React Testing Library, 11 tests):** live search filtering, article page, newsletter validation, success, server error and non-JSON error handling
- **CI:** GitHub Actions runs both suites and the production build on every push

The post sync tests run against an in-memory stand-in for the MongoDB collection, not a real database.

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
| `ALLOW_FILE_FALLBACK` | Optional. Set to `true` to allow file storage if MongoDB is unreachable. Off by default so signups are never silently lost |

If `MONGODB_URI` is set but the database can't be reached, the server refuses to start and logs the reason, instead of quietly falling back to a disk that Render resets.

---

## Managing Posts

`server/data/posts.json` is the source of truth. On every start the server syncs it into MongoDB: new and edited posts are upserted, and posts removed from the file are deleted from the database. An empty or unreadable file never wipes the collection. Edit posts in `posts.json` and redeploy; changes made directly in Atlas are overwritten on the next restart.

---

## Security

- Helmet security headers with a Content Security Policy
- Rate limiting on `POST /api/subscribe` (in-memory, suited to a single instance)
- Validation: type check, format check, 254-character limit, 10kb body limit
- Identical response for new and repeat signups, so subscriber membership can't be probed
- Unique database index makes duplicate protection atomic under concurrent requests
- Atomic writes for the file store; JSON errors with no stack traces
- Secrets live in environment variables, never in the repo

---

## Design Notes

A "blueprint and gold" look: charcoal and gold taken from the Alpha Konnect Koncepts logo, a technical-drawing grid, condensed uppercase headings (Barlow Condensed) with Inter for body text, numbered cards, and a featured first post. Thumbnails are generated SVGs, so there are no external image dependencies.

---

## Known Limitations and Next Steps

- **No email is sent.** Signups are stored but there is no mailer, double opt-in or unsubscribe link yet.
- **Hash routing.** Article URLs (`#/post/:id`) set their own title and meta description, but Open Graph tags are shared, so link previews are limited. Server-rendered or path-based routes would fix this.
- **Atlas access list uses `0.0.0.0/0`** because Render's free tier has no fixed outbound IP. Production would use static IPs or a private endpoint.
- **Posts are edited in `posts.json`.** An admin UI would be the next step.
- **Rate limiter is in-memory**, so it applies per instance.
- Possible additions: linting, tests against a real MongoDB instance, end-to-end browser tests.

---

## Author

`Prerna Divakar`