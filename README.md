# Streaming

Self-hosted Netflix-like streaming platform. Browse TMDB metadata, stream movies/TV via WebTorrent with HLS transcoding, multi-audio tracks, subtitle support, watchlist, and continue-watching.

---

## Quick Start

### Prerequisites

- **Node.js** v20+
- **FFmpeg** (with `ffprobe`) in PATH

### Non-Docker (development)

```bash
# Backend (port 3000)
npm install
cp .env.example .env     # edit if needed
npm start

# Frontend (port 3001) — separate terminal
cd frontend
npm install
npm run dev
```

Open `http://localhost:3001`.

### Docker (production)

```bash
cp .env.example .env
NEXT_PUBLIC_API_URL=http://your-host:3000 docker compose up -d
```

Or on Windows (PowerShell):

```powershell
$env:NEXT_PUBLIC_API_URL="http://your-host:3000"; docker compose up -d
```

Backend on `:3000`, frontend on `:3001`.

---

## Self-Host / Reverse Proxy

The compose file exposes ports directly. To serve both behind a single domain with a reverse proxy (Caddy, Nginx, etc.):

- Proxy `/api/*`, `/health`, `/hls/*` → backend (`:3000`)
- Proxy everything else → frontend (`:3001`)

### Caddy example

```
example.com {
    @api path /api/* /health /hls/*
    handle @api {
        reverse_proxy localhost:3000
    }
    handle {
        reverse_proxy localhost:3001
    }
}
```

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Backend port |
| `TMDB_API_KEY` | (built-in key) | TMDB API key |
| `HLS_ENABLED` | `true` | Set to `false` to disable HLS |
| `NEXT_PUBLIC_API_URL` | (required) | Public URL of the backend API |

---

## Architecture

```
Frontend (Next.js 16 + React 19 + Hls.js)  ──HTTP──▶  Backend (Express + WebTorrent)
                                                          │
                                                          ├── TMDB (metadata)
                                                          ├── YTS / Pirate Bay (torrents)
                                                          ├── FFmpeg (HLS transcoding)
                                                          └── YIFY Subtitles
```

All data is cached in `.cache/` (TMDB metadata, downloads, HLS segments).
