# btechlogs

A developer blog platform designed to empower developers to create, share, and discover technical content.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Deploying to Cloudflare](#deploying-to-cloudflare)
- [Tests](#tests)
- [API](#api)

## About

This platform features a clean, user-friendly interface, authentication, and an intuitive content management system. It allows users to publish blogs, interact with other posts, and manage their profiles.

## Features

- A home page showcasing featured and recent posts
- An explore page to browse through posts
- Categories, sorting and search
- Rich-text authoring with image and video uploads
- Comments, saved posts, and admin-only featuring

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, TanStack Query, React Router
- **Backend:** Hono on Cloudflare Workers
- **Database:** MongoDB Atlas (native `mongodb` driver)
- **Auth:** Clerk
- **Media:** ImageKit

## Architecture

The whole application deploys as **one Cloudflare Worker**:

```
btechlogs.com/            -> client/dist   (static assets, SPA fallback)
btechlogs.com/api/*       -> server/src    (Hono router)
```

`assets.run_worker_first: ["/api/*"]` in [wrangler.jsonc](wrangler.jsonc) sends only API
paths to the Worker; everything else is served straight from the assets bundle, falling
back to `index.html` so client-side routing works on a hard refresh.

Because the SPA and the API share an origin, there is **no CORS configuration anywhere** —
the browser never makes a cross-origin request.

```
.
├── wrangler.jsonc          Worker + static assets configuration
├── client/                 Vite React SPA
│   └── src/
│       ├── components/
│       ├── routes/
│       └── lib/            api client, sanitiser, shared constants
├── server/
│   ├── src/
│   │   ├── index.js        Worker entrypoint (Hono app)
│   │   ├── db.js           Per-request MongoDB connection
│   │   ├── lib/            auth, validation, slugs, ImageKit, Svix
│   │   └── routes/         posts, comments, users, webhooks
│   └── test/               Integration tests against a real MongoDB
└── scripts/setup-db.js     Creates the indexes the API relies on
```

### Database connections on Workers

`server/src/db.js` opens a **connection per request** rather than caching a client in
module scope. This is not an oversight: the Workers runtime ties I/O objects to the
request context that created them, so a cached client serves the first request and then
hangs every request after it. The trade-off is a connection handshake per request;
queries within a single request still share that connection.

## Local development

```bash
npm install
```

That installs both the Worker and the client (via `postinstall`).

Copy the two environment templates and fill them in:

```bash
cp .dev.vars.example .dev.vars
cp client/.env.example client/.env
```

Create the database indexes once:

```bash
npm run db:setup
```

Then:

```bash
npm run dev
```

This runs two processes: `wrangler dev` on `http://localhost:8787` for the API, and Vite
on `http://localhost:5173` for the SPA. **Use the Vite URL** — it proxies `/api` to the
Worker, so requests look exactly as they will in production while you keep hot reload.

To check the real production build end to end:

```bash
npm run preview      # builds the SPA, then serves everything from the Worker
```

## Configuration

Secrets live in `.dev.vars` locally and in Worker secrets in production. Nothing secret
belongs in `client/.env` — that file is compiled into the JS bundle and is public.

| Variable | Where | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Worker secret | MongoDB Atlas connection string |
| `MONGO_DB_NAME` | `wrangler.jsonc` var | Database name |
| `CLERK_SECRET_KEY` | Worker secret | Verifies session tokens |
| `CLERK_PUBLISHABLE_KEY` | Worker secret | Required by `@clerk/backend` |
| `CLERK_WEBHOOK_SECRET` | Worker secret | Verifies Svix webhook signatures |
| `CLERK_AUTHORIZED_PARTIES` | Worker secret (optional) | Comma-separated allowed origins |
| `IK_PRIVATE_KEY` | Worker secret | Signs ImageKit upload credentials |
| `VITE_CLERK_PUBLISHABLE_KEY` | `client/.env` | Clerk frontend |
| `VITE_IK_URL_ENDPOINT` | `client/.env` | ImageKit delivery endpoint |
| `VITE_IK_PUBLIC_KEY` | `client/.env` | ImageKit uploads |
| `VITE_API_URL` | `client/.env` (optional) | Defaults to `/api` |

### Admin role

Admin-only actions (featuring posts, deleting anyone's content) read the role from the
Clerk session token. In the Clerk dashboard, add this to the session token claims:

```json
{ "metadata": "{{user.public_metadata}}" }
```

Then set `{ "role": "admin" }` on a user's public metadata. The API also accepts a
`public_metadata` claim, so either JWT template shape works.

### Clerk webhook

Point a Clerk webhook at `https://<your-domain>/api/webhooks/clerk` subscribed to
`user.created`, `user.updated` and `user.deleted`, and put its signing secret in
`CLERK_WEBHOOK_SECRET`. User records are created by this webhook — without it, signed-in
users have no local profile and writes fail with "User record not found".

## Deploying to Cloudflare

Set the secrets once:

```bash
npx wrangler secret put MONGO_URI
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put CLERK_PUBLISHABLE_KEY
npx wrangler secret put CLERK_WEBHOOK_SECRET
npx wrangler secret put IK_PRIVATE_KEY
```

Then deploy — this builds the SPA and uploads it alongside the Worker:

```bash
npm run deploy
```

Add your domain under the Worker's **Settings → Domains & Routes** in the Cloudflare
dashboard, and allow your Worker's egress IPs in the MongoDB Atlas network access list
(Atlas has no static Worker IP range, so `0.0.0.0/0` plus strong credentials, or an
Atlas Private Endpoint, are the practical options).

## Tests

```bash
npm test
```

43 integration tests run the Hono app against a real MongoDB (`mongodb-memory-server`),
with Clerk stubbed at its own boundary so the authorisation logic runs for real. The
webhook tests sign their fixtures with the official `svix` library to cross-check the
hand-written WebCrypto verification in `server/src/lib/svix.js`.

## API

All routes are under `/api`. Authenticated routes take `Authorization: Bearer <clerk token>`.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | — | Answers even when the database is down |
| GET | `/posts` | — | `page`, `limit`, `cat`, `author`, `search`, `sort`, `featured` |
| GET | `/posts/:slug` | — | Increments the visit counter |
| POST | `/posts` | required | |
| PATCH | `/posts/feature` | admin | Toggles featured |
| DELETE | `/posts/:id` | author or admin | Also deletes the post's comments |
| GET | `/posts/upload-auth` | required | ImageKit upload credentials |
| GET | `/comments/:postId` | — | |
| POST | `/comments/:postId` | required | |
| DELETE | `/comments/:id` | author or admin | |
| GET | `/users/saved` | required | |
| PATCH | `/users/save` | required | Toggles saved |
| POST | `/webhooks/clerk` | Svix signature | |

Errors are always `{ "message": "..." }` with a meaningful status: 400 validation,
401 unauthenticated, 403 not allowed, 404 missing, 503 database unreachable.
