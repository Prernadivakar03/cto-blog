# CTO Journal: Construction Trade Promotion Organization

A responsive single-page blog built for the Construction Trade Promotion Organization (CTO) / Alpha Konnect Koncepts. It has a live title search, a dynamic posts API, and a newsletter form backed by an Express server.

**Live demo:** https://cto-blog.onrender.com/


> The app is hosted on Render's free tier. If it has been idle, the first load can take 30 to 50 seconds while the service wakes up.

---

## Features

**Frontend**
- Header with the Alpha Konnect Koncepts logo on the left and a search bar
- Real-time filtering of posts by title as you type
- Grid of 5 blog posts, each with a title, excerpt, published date, category tag and thumbnail
- The first post is shown as a wider featured card on desktop
- Thumbnails are generated SVG blueprint illustrations, so no external images are needed
- Fully responsive on mobile, tablet and desktop
- Footer with a copyright notice and placeholder navigation links
- Newsletter form with:
  - frontend email validation (empty and bad-format checks) before any request is sent
  - a loading spinner and disabled button while the request is in flight
  - a clear success message and a cleared input on success
  - inline error messages for validation, duplicate or network failures

**Backend**
- `GET /api/posts` serves the blog data dynamically from JSON
- `POST /api/subscribe` validates the email and stores it in `subscribers.json`
- Duplicate emails are rejected
- In production, Express also serves the built React app, so one service runs everything

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, plain CSS |
| Backend | Node.js, Express |
| Storage | Local JSON file (`subscribers.json`) |
| Hosting | Render (single web service) |

---

## Project Structure

```
cto-blog/
├── package.json              # root scripts used by Render
├── .gitignore
├── README.md
├── server/
│   ├── package.json
│   ├── index.js              # Express API + static file serving
│   └── data/posts.json       # blog post data
└── client/
    ├── package.json
    ├── vite.config.js        # dev proxy: /api -> localhost:3000
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx           # data fetching + search state
        ├── styles.css
        ├── assets/           # logo files
        └── components/
            ├── Header.jsx
            ├── PostCard.jsx
            ├── Thumb.jsx     # generated SVG thumbnails
            ├── Newsletter.jsx
            └── Footer.jsx
```

---

## API Reference

### `GET /api/posts`

Returns all blog posts.

```json
{
  "status": 200,
  "count": 5,
  "posts": [
    {
      "id": 1,
      "title": "Novel 3D Printing in Modern Civil Engineering",
      "excerpt": "Layer-by-layer concrete extrusion is ...",
      "date": "2026-09-22",
      "category": "3D Printing"
    }
  ]
}
```

### `POST /api/subscribe`

**Request body**
```json
{ "email": "you@example.com" }
```

**Responses**

| Status | Body | When |
|---|---|---|
| 200 | `{ "status": 200, "message": "Subscription successful" }` | Email saved |
| 400 | `{ "status": 400, "message": "Email is required" }` | Missing or empty email |
| 400 | `{ "status": 400, "message": "Please enter a valid email address" }` | Invalid format |
| 409 | `{ "status": 409, "message": "You're already subscribed" }` | Duplicate email |

Subscribers are stored in `server/subscribers.json`:

```json
[
  { "email": "test@example.com", "subscribedAt": "2026-09-30T14:10:22.531Z" }
]
```

---

## Running Locally

**Requirements:** Node.js 18 or newer

```bash
# 1. Clone the repo
git clone https://github.com/Prernadivakar03/cto-blog.git
cd cto-blog

# 2. Start the backend (terminal 1)
cd server
npm install
npm run dev          # http://localhost:3000

# 3. Start the frontend (terminal 2)
cd client
npm install
npm run dev          # http://localhost:5173
```

Open **http://localhost:5173**. Vite proxies `/api` requests to the Express server.

### Production build (optional local test)

```bash
# from the project root
npm run build
npm start            # http://localhost:3000 serves the full app
```

---

## Deployment (Render)

The project is deployed as a single Render Web Service.

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Environment variable | `NODE_VERSION=20` |

The build installs the client dependencies, builds the React app into `client/dist`, and installs the server dependencies. Express then serves `client/dist` along with the API routes.

---

## Design Notes

The visual direction is a "blueprint and gold" look:
- Charcoal and gold palette taken from the Alpha Konnect Koncepts logo
- A technical-drawing grid pattern in the hero and thumbnails
- Condensed uppercase headings (Barlow Condensed) with Inter for body text
- Numbered cards and a featured first post for an editorial feel

---
## Security

- Helmet security headers with a Content Security Policy
- Rate limiting on `POST /api/subscribe` (10 requests per 15 minutes per IP)
- Strict validation: type check, format check, 254-character limit, 10kb body limit
- Unique database index prevents duplicate subscribers, even under concurrent requests
- Atomic file writes, JSON error responses and no stack traces leaked
- Secrets (`MONGODB_URI`) live in environment variables, never in the repo

## Storage

- **Production:** MongoDB Atlas (`MONGODB_URI`). Posts are seeded on first run and subscribers are stored with a unique email index.
- **Local / fallback:** JSON files, used automatically when `MONGODB_URI` is not set or the connection fails.
- `GET /api/health` reports which backend is active.

## Testing

```bash
npm test            # server + client
```
- Server (Node test runner): posts routes, security headers, every subscribe case, malformed JSON, rate limiting
- Client (Vitest + React Testing Library): live search filtering, newsletter validation, success, server error and non-JSON error handling
- GitHub Actions runs the tests and the production build on every push.

## Known Limitations and Next Steps

- Posts are managed directly in MongoDB; an admin UI would be the next step
- Double opt-in email confirmation and an unsubscribe link
- End-to-end browser tests (Playwright)


## Author

`Prerna Divakar`