# Fix Vercel Server — Output

## Deployment URL

https://local-ai-agency-os.vercel.app

## Health Check

```
GET https://local-ai-agency-os.vercel.app/
→ {"status":"ok","service":"Local AI Freelance Agency OS","version":"1.0.0"}
```

## Changes Made

| File | Change |
|------|--------|
| `src/modules/intake/api.ts` | Added `handleIntakeRequest()` export (wrapper around private handler) |
| `src/server.ts` | New file — Node.js HTTP server, mounts intake + dispatch routes, listens on PORT (default 3000) |
| `api/index.ts` | New file — Vercel Serverless Function entry, exports default handler |
| `vercel.json` | Updated to use `@vercel/node` builds + catch-all route to `api/index.ts` |
| `package.json` | Changed `start` script from `dist/index.js` to `dist/server.js` |

## Routes Available

- `GET /` — health check JSON
- `POST /api/intake` — intake form processing
- `POST /api/dispatch` — dispatch a task
- `GET /api/dispatch/tasks` — list tasks
- `GET /api/dispatch/tasks/:id` — get task by ID
- `POST /api/dispatch/tasks/:id/answer` — answer a pending question
- `DELETE /api/dispatch/tasks/:id` — stop a task
