# Movie Site Backend

A robust, industrial-grade personal streaming backend. It retrieves movie metadata from TMDB, matches it with YTS torrents, fetches English subtitles from YIFY, and streams files dynamically using HTTP Range Requests or HLS transcoding.

---

## Features

- **TMDB & YTS Integration**: Full metadata fetching and YTS magnet link resolution by IMDb ID.
- **HTTP Range & HLS Streaming**: Support for direct torrent-to-HTTP Range streaming as well as real-time HLS transcoding (supports codec auto-detection and swapping).
- **Asynchronous English Subtitles Engine**:
  - Scrapes `yifysubtitles.ch` by IMDb ID.
  - Downloads, unzips, and parses `.srt` files on-the-fly entirely in-memory.
  - Automatically converts timestamps from SRT to browser-native WebVTT (`.vtt`) format.
  - Supports background pre-fetching and detailed status/progress updates.
- **Storage Management**: APIs to track and delete cached downloads, torrent blocks, and HLS segments.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher.
- **FFmpeg**: Required if HLS streaming is enabled. Ensure `ffmpeg` and `ffprobe` are present in your system's PATH.

---

## Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables (Optional)**:
   Create a `.env` file or configure your shell environment:
   ```ini
   PORT=3000
   TMDB_API_KEY=your_tmdb_api_key_here
   HLS_ENABLED=true
   HLS_TRANSCODE=false
   ```

3. **Start the Server**:
   ```bash
   npm start
   ```

---

## API Reference

### 1. Metadata & Torrents

#### `GET /api/search`
Search for movies on TMDB.
- **Query Parameters**:
  - `q` (string, required): The search query.
  - `page` (number, optional, default: 1): TMDB page index.
- **Response**: Array of TMDB search results.

#### `GET /api/movie/:tmdbId`
Fetch full movie details from TMDB and list corresponding torrents from YTS.
- **Response**:
  ```json
  {
    "tmdb": { ... },
    "yts": { "torrents": [ { "quality": "1080p", "hash": "..." } ] }
  }
  ```

---

### 2. Streaming Control

#### `POST /api/stream/start`
Initialize a torrent session for streaming. Starts seeding/downloading and begins HLS setup in the background.
- **Request Body**:
  ```json
  {
    "imdbId": "tt0816692",
    "quality": "1080p"
  }
  ```
- **Response**:
  ```json
  {
    "sessionId": "48f12e78-78c3-42e2-8715-efde98effb21",
    "streamUrl": "/api/stream/48f12e78-78c3-42e2-8715-efde98effb21",
    "hlsUrl": "/api/stream/48f12e78-78c3-42e2-8715-efde98effb21/hls/index.m3u8"
  }
  ```

#### `GET /api/stream/:sessionId`
Streams the raw media file using HTTP Range requests.
- **Headers**: Supports standard `Range` header (e.g. `bytes=0-1048576`).

#### `GET /api/stream/:sessionId/status`
Retrieve details of the active torrent session.
- **Response**:
  ```json
  {
    "numPeers": 12,
    "progress": 0.05,
    "downloadSpeed": "2.4 MB/s",
    "downloaded": "80 MB",
    "timeRemaining": "15m",
    "name": "Interstellar.2014.1080p.yify.mp4"
  }
  ```

#### `POST /api/stream/stop`
Terminates the active torrent session and shuts down FFmpeg/HLS transcoding.
- **Response**: `{ "ok": true }`

---

### 3. HLS Transcoding (FFmpeg)

#### `GET /api/stream/:sessionId/hls/index.m3u8`
Serves the HLS playlist manifest. Blocks internally for codec probing and playlist generation.

#### `GET /api/stream/:sessionId/hls/:segment`
Serves individual TS segments for HLS chunk playback.

---

### 4. Subtitles Engine

#### `POST /api/movie/:imdbId/subtitle-start`
Triggers asynchronous downloading and conversion of English subtitles in the background.
- **Response**: `{ "ok": true }`

#### `GET /api/movie/:imdbId/subtitle-status`
Returns the status of the subtitle worker.
- **Response**:
  ```json
  {
    "status": "fetching" | "ready" | "failed" | "idle",
    "step": "Downloading subtitle zip package...",
    "error": null
  }
  ```

#### `GET /api/movie/:imdbId/english-sub`
Streams the completed WebVTT file. If the background download is still in progress, this endpoint blocks and awaits completion.
- **Content-Type**: `text/vtt; charset=utf-8`

---

### 5. Storage Management

#### `GET /api/storage`
Fetch cache usage information.
- **Response**:
  ```json
  {
    "totalBytes": 12456012432,
    "movies": [
      { "name": "Interstellar.2014.1080p", "sizeBytes": 21543231 }
    ]
  }
  ```

#### `DELETE /api/storage/movie/:name`
Deletes a specific movie download folder from local storage.
- **Response**: `{ "ok": true }`

#### `DELETE /api/storage/all`
Stops any active sessions, purges the entire HLS output directory, and deletes all downloaded torrent data.
- **Response**: `{ "ok": true }`

---

### 6. Diagnostics

#### `GET /health`
Returns the operational health status of the API backend.
- **Response**: `{ "ok": true }`

---

## Server Rules & Behavior

- **Session Locking**: Only a single active torrent session is allowed at any time. Starting a new stream terminates the previous one.
- **Cleanup**: All downloaded cache data resides in the configured downloads directory and can be completely wiped using the storage purge endpoints.
