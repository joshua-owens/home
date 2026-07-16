# House

A self-hosted tracker for home projects, quotes, expenses, and inventory. Built with Nuxt 4, Nuxt UI 4, TypeORM (SQLite), and a lightweight username/password auth layer (no roles).

## What it does

- Track home improvement projects from idea through completion, with drag-to-rank ordering.
- Collect and compare contractor quotes per project, with automatic expiry tracking.
- Log expenses against projects and categories, and track inventory items (with warranty badges).
- Optional AI-assisted research reports per project (via OpenRouter).
- A dashboard summarizing recent activity (14/60-day windows).

Single-household use: the first account created via the setup screen becomes the only "kind" of user — there are no roles or multi-tenant isolation.

## Development

```bash
npm install
cp .env.example .env   # if present; otherwise create .env with the vars below
npm run dev
npm test
```

The dev server runs at `http://localhost:3000`. Local data lives in `./data/sqlite.db` by default (`NUXT_DATA_DIR`).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NUXT_SESSION_PASSWORD` | Yes | Secret used to encrypt session cookies. Must be **32+ characters**. Generate with `openssl rand -hex 32`. |
| `NUXT_OPENROUTER_API_KEY` | For research feature | API key for OpenRouter, used by the project research/report feature. |
| `NUXT_RESEARCH_MODEL` | For research feature | Model identifier passed to OpenRouter for research reports (e.g. `anthropic/claude-3.5-sonnet`). |
| `NUXT_DATA_DIR` | No | Directory for the SQLite database and uploaded attachments. Defaults to `./data` in dev; the Docker image sets this to `/data`. |

## Deploying with Docker

Build the image:

```bash
docker build -t house .
```

Run it, mounting a named volume at `/data` for persistence:

```bash
docker run -d --name house -p 3000:3000 \
  -v house-data:/data \
  -e NUXT_SESSION_PASSWORD=$(openssl rand -hex 32) \
  -e NUXT_OPENROUTER_API_KEY=... \
  -e NUXT_RESEARCH_MODEL=... \
  house
```

Visit `http://localhost:3000` — you'll land on the first-run setup screen to create the initial (and only) account.

### Unraid notes

- Map the container's `/data` path to an appdata share (e.g. `/mnt/user/appdata/house`) so the database and uploaded attachments persist across container recreation/updates.
- This app has no built-in HTTPS or multi-user access control beyond a single login — run it LAN-only (do not expose port 3000 directly to the internet). Put it behind your own reverse proxy/VPN if remote access is needed.
- Set `NUXT_SESSION_PASSWORD` as a fixed, secret environment variable in the container config (don't regenerate it on every restart, or existing sessions will be invalidated).

### Backups

All persistent state — the SQLite database and uploaded attachments — lives under the `/data` volume. To back up, stop the container (or accept a brief inconsistency window) and copy the volume/appdata directory. To restore, stop the container, replace the contents of `/data`, and start it again.

### Password reset (lockout escape hatch)

There is no self-service "forgot password" flow. If you're locked out, reset the password directly from inside the running container:

```bash
docker exec <container-name-or-id> node scripts/reset-password.mjs <username> <new-password>
```

The new password must be at least 8 characters. This writes directly to the SQLite database at `NUXT_DATA_DIR/sqlite.db` (`/data/sqlite.db` in the container).
