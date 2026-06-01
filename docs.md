# Bitcine — Architecture & Implementation Guide

A self-hosted Netflix-like streaming platform. TMDB metadata + WebTorrent P2P streaming + FFmpeg HLS transcoding + Hls.js playback, all in two Docker containers.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Backend — Inside Out](#2-backend--inside-out)
   - [2.1 server.js — API Layer](#21-serverjs--api-layer)
   - [2.2 torrent.js — Streaming Engine](#22-torrentjs--streaming-engine)
   - [2.3 hls.js — FFmpeg Transcoding](#23-hlsjs--ffmpeg-transcoding)
   - [2.4 tmdb.js — Metadata Provider](#24-tmdbjs--metadata-provider)
   - [2.5 piratebay.js — Torrent Search](#25-piratebayjs--torrent-search)
   - [2.6 subtitles.js — Subtitle Engine](#26-subtitlesjs--subtitle-engine)
   - [2.7 cache.js — Two-Layer Cache](#27-cachejs--two-layer-cache)
   - [2.8 user-db.js — User Data](#28-user-dbjs--user-data)
   - [2.9 storage.js — Disk Management](#29-storagejs--disk-management)
3. [Frontend — Inside Out](#3-frontend--inside-out)
   - [3.1 page.tsx — Main Application](#31-pagetsx--main-application)
   - [3.2 Player System](#32-player-system)
   - [3.3 Component Library](#33-component-library)
4. [Streaming Pipeline — Deep Dive](#4-streaming-pipeline--deep-dive)
   - [4.1 Torrent Session Lifecycle](#41-torrent-session-lifecycle)
   - [4.2 HLS Transcoding Flow](#42-hls-transcoding-flow)
   - [4.3 Seek Mechanics](#43-seek-mechanics)
   - [4.4 Resume & Continue-Watching](#44-resume--continue-watching)
   - [4.5 Subtitle System](#45-subtitle-system)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Docker & Deployment](#6-docker--deployment)

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Next.js SPA (React 19, Tailwind v4, Framer Motion)          │  │
│  │  Hls.js for playback                                         │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │ HTTP                                    │
└─────────────────────────┼──────────────────────────────────────────┘
                          │
┌─────────────────────────┼──────────────────────────────────────────┐
│  Docker / Host          │                                          │
│  ┌──────────────────────┴───────────────────────────────────────┐  │
│  │  Express.js Backend (port 3000)                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │  TMDB    │ │ Pirate   │ │ YIFY     │ │  User DB     │   │  │
│  │  │  Client  │ │ Bay API  │ │ Subtitles│ │  (JSON file) │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  WebTorrent Client (P2P Streaming)                   │   │  │
│  │  └──────────────────────┬───────────────────────────────┘   │  │
│  │  ┌──────────────────────┴───────────────────────────────┐   │  │
│  │  │  FFmpeg (HLS Transcoding, fMP4 segments)            │   │  │
│  │  └──────────────────────┬───────────────────────────────┘   │  │
│  │                         │                                    │  │
│  │              .cache/ (disk storage)                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │  │
│  │  │ tmdb/    │ │downloads/│ │ hls/     │                    │  │
│  │  │ (JSON)   │ │(torrent) │ │(segments)│                    │  │
│  │  └──────────┘ └──────────┘ └──────────┘                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Next.js Frontend (port 3001)                                │  │
│  │  SSG + client-side hydration                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

| Decision | Rationale |
|----------|-----------|
| Single active torrent session | Simpler state management, avoids port/resource contention |
| HTTP Range streaming for raw + HLS | Single source of truth; FFmpeg consumes the same HTTP stream as a browser would |
| `-c:v copy` (no video transcoding) | 4K HEVC transcoding is CPU-prohibitive; stream copy preserves quality |
| `-c:a aac` fallback when needed | Hls.js requires AAC; many torrents use AC3/DTS which must be transcoded |
| fMP4 segments (`-hls_segment_type fmp4`) | Better MSE compatibility, lower latency than TS |
| No `-copyts` | Source files often have non-zero start PTS; without it FFmpeg normalizes to 0 |
| `default_base_moof` | Forces each segment's `tfdt` to use relative base; player constructs timeline from `#EXTINF` |

---

## 2. Backend — Inside Out

### 2.1 server.js — API Layer

**File:** `src/server.js` (580 lines)

The Express server defines all HTTP routes. Organized by domain:

**Metadata & Discovery**
| Route | Function | Source |
|-------|----------|--------|
| `GET /api/search?q=&type=` | Search movies, TV, or multi | TMDB |
| `GET /api/movie/:tmdbId` | Movie details + YTS torrents | TMDB + Pirate Bay |
| `GET /api/tv/:tmdbId` | TV show details | TMDB |
| `GET /api/tv/:tmdbId/season/:s/episode/:e` | Episode torrent lookup | Pirate Bay |
| `GET /api/movies/trending` | Trending movies | TMDB |
| `GET /api/movies/top-rated` | Top rated | TMDB |
| `GET /api/movies/genre/:genreId` | By genre | TMDB |
| `GET /api/resolve-media-type/:imdbId` | Resolve movie vs TV from IMDb ID | TMDB find |

**User Data (JSON file backed)**
| Route | Function |
|-------|----------|
| `GET/POST /api/watchlist` | List / add |
| `DELETE /api/watchlist/:imdbId` | Remove |
| `GET /api/continue-watching` | Sorted by last-watched |
| `POST /api/progress` | Save position (auto-removes at 95% → moves to history) |
| `GET/POST/DELETE /api/history` | Watch history |
| `GET /api/ratings` | All ratings |
| `POST /api/ratings/:id` | Rate 1-5 |

**Streaming**
| Route | Function |
|-------|----------|
| `POST /api/stream/start` | Start torrent + begin HLS in background |
| `GET /api/stream/:sessionId` | HTTP Range streaming of raw file |
| `GET /api/stream/:sessionId/status` | Torrent status + `sourceDuration` |
| `GET /api/stream/:sessionId/subs` | List torrent-internal subtitle files |
| `GET /api/stream/:sessionId/subs/:index` | Serve subtitle file (SRT→VTT conversion) |
| `GET /api/stream/:sessionId/audio-tracks` | List audio tracks via ffprobe |
| `GET /api/stream/:sessionId/hls/index.m3u8` | HLS playlist (calls `ensureHls`) |
| `GET /api/stream/:sessionId/hls/:segment` | HLS segment (init.mp4, segment_*.m4s) |
| `POST /api/stream/:sessionId/seek` | Reprioritize torrent + restart FFmpeg |
| `POST /api/stream/stop` | Kill session + cleanup |

**Storage**
| Route | Function |
|-------|----------|
| `GET /api/storage` | Usage stats |
| `DELETE /api/storage/movie/:name` | Delete one (path-traversal sanitized) |
| `DELETE /api/storage/all` | Nuke all |

**`POST /api/progress` — duration resolution:**

```javascript
// Uses sourceDuration from the session (ffprobe result) when available.
// This gives the true movie length, NOT the growing HLS playlist duration.
let finalDuration = Number(duration);
if (sessionId) {
    const session = getSession(sessionId);
    if (session?.sourceDuration) {
        finalDuration = session.sourceDuration;
    }
}
```

This is critical: `video.duration` in Hls.js reflects the playlist's growing timeline. Using `sourceDuration` (from ffprobe on the actual file) gives the real progress percentage.

---

### 2.2 torrent.js — Streaming Engine

**File:** `src/torrent.js` (277 lines)

**WebTorrent client configuration:**
```javascript
const client = new WebTorrent({
    utp: false,       // uTP causes issues on some networks; fall back to TCP
    maxConns: 300,    // connection limit
    dht: true,        // DHT peer discovery
    pex: true         // Peer exchange
});
```

**File selection (`selectBestFile`):**
Finds the largest video file (`.mkv`, `.mp4`, `.webm`, `.avi`) from the torrent. If no video files found, falls back to the largest file overall.

**Startup prioritization (`prioritizeStartup`):**
```
1. Prioritize subtitle files (srt, vtt) first via torrent.critical()
2. Prioritize first 50MB of the video file (fast playback start)
3. Prioritize last 5MB (MP4 moov atom is often at the end)
4. Select all pieces for sequential streaming (torrent.select)
```

**Session management:**
- Single `activeSession` at a time
- Storage check before starting: if `totalStorageUsed > 20GB`, purge everything
- Torrent metadata is cached to `.cache/downloads/<hash>.torrent` for fast restart

**`probeSourceDuration`:**
Runs `ffprobe -v error -show_entries format=duration` against the HTTP stream URL. Retries 6 times with 5s intervals (30s total). The stream URL is `http://127.0.0.1:${port}/api/stream/${session.id}` — this means FFprobe reads from the torrent's HTTP server, so it only needs whatever bytes are already downloaded.

**`waitForBuffer`:**
Returns a Promise that resolves when either:
- Torrent progress ≥ 2% (or 1MB, whichever is smaller)
- 30s timeout (so startup doesn't hang on dead torrents)

**`seekToPosition` (seeking):**
```javascript
const byteOffset = (seekTime / sourceDuration) * file.length;
const targetPiece = Math.floor(byteOffset / bytesPerPiece);
const windowPieces = Math.ceil(5MB / bytesPerPiece);

// Critical (highest priority) around target
torrent.critical(targetPiece - windowPieces, targetPiece + windowPieces);
// Always prioritize last 5MB (moov atom)
torrent.critical(lastPiecesStart, totalPieces - 1);
```

---

### 2.3 hls.js — FFmpeg Transcoding

**File:** `src/hls.js` (225 lines)

**State management — two Maps:**
- `active: Map<sessionId, {proc, playlistPath, sessionDir, audioTrack, startTime}>` — running FFmpeg processes
- `starting: Map<sessionId, {promise, audioTrack, startTime}>` — in-flight starts (deduplication)

**`ensureHls(session, audioTrack = 0, startTime = 0)`:**
The central function. Idempotent — if a process is already running with the same `(sessionId, audioTrack, startTime)`, returns the existing record. Otherwise:

1. **Clean slate:** Delete all old playlist/segment files in the session's HLS directory
2. **Probe codecs:** Run `ffprobe` on the HTTP stream to detect video/audio codecs
3. **Build FFmpeg args:**

```
ffmpeg
  -err_detect ignore_err          # Keep going on minor errors
  -fflags +genpts                 # Generate PTS from DTS when missing
  [-ss <startTime> -accurate_seek]  # Only when seeking (startTime > 0)
  -i http://127.0.0.1:3000/...   # Input = HTTP stream from torrent
  -map 0:v:0 -map 0:a:<track>
  -c:v copy                       # Stream copy video (no transcode)
  -c:a <copy|aac>                 # Transcode audio only if needed
  -threads 0                      # Auto thread count
  -f hls
  -hls_time 5                     # 5-second segments
  -hls_playlist_type event        # Append to playlist as segments are produced
  -hls_segment_type fmp4          # Fragmented MP4 (not TS)
  -hls_flags independent_segments # Each segment starts with a keyframe
  -movflags frag_keyframe+default_base_moof  # Proper fMP4 formatting
  -hls_segment_filename <pattern>
  <playlist path>
```

Key flags explained:
- **`-err_detect ignore_err`**: Prevents FFmpeg from aborting on recoverable packet errors common in P2P streams
- **`-fflags +genpts`**: Generates PTS timestamps from DTS when the container lacks them
- **No `-copyts`**: Without this flag, FFmpeg normalizes the timeline to start at 0. Source files (especially MKV) often have PTS starting at 1-3min; without normalization the player timeline is offset
- **`-movflags frag_keyframe+default_base_moof`**: `default_base_moof` ensures each segment's `tfdt` box uses a relative base, so the timeline is built from `#EXTINF` durations rather than source PTS

**Codec handling:**
- Video: always `copy` (never transcode — 4K HEVC would destroy CPU)
- Audio: `copy` if AAC or MP3 (Hls.js-compatible), transcode to AAC 192k stereo if DTS/AC3/EAC3/etc

**`getAudioTracks`:**
Runs `ffprobe -select_streams a -show_entries stream=codec_name:stream_tags=language,title -of json` against the HTTP stream. Returns array of `{id, language, title, codec}`.

**Process lifecycle:**
- Stderr monitored for "Error" strings (suppresses frame-level spam)
- On exit: if code 0, marks `completed: true`; otherwise removes from `active` map
- `stopHls(sessionId)`: `SIGKILL` + delete directory
- `stopAllHls()`: Kill all processes + clear `active`/`starting` maps

---

### 2.4 tmdb.js — Metadata Provider

**File:** `src/tmdb.js` (77 lines)

Thin wrapper around TMDB API v3 with disk-backed caching.

**Cache strategy:**
- SHA1 hash of URL → `{savedAt, value}` written as JSON to `.cache/tmdb/<hash>.json`
- Two-layer: in-memory `Map` first, then disk read
- TTL: 24 hours (`tmdbCacheTtlMs`)
- Cache-busting: writes always update both layers; reads check memory first

**API key:**
Default key baked into `config.js`. Override via `TMDB_API_KEY` env var.

**Endpoints exposed:**
- `/search/movie`, `/search/tv`, `/search/multi`
- `/movie/:id` with `append_to_response=credits,external_ids,videos`
- `/tv/:id` with `append_to_response=credits,external_ids,videos`
- `/trending/movie/week`, `/trending/tv/week`
- `/movie/top_rated`
- `/discover/movie` with genre filter
- `/find/:imdbId` with `external_source=imdb_id` (media type resolution)

---

### 2.5 piratebay.js — Torrent Search

**File:** `src/piratebay.js` (91 lines)

Uses `apibay.org` (PirateBay JSON API) for torrent search. Two search modes:

**By IMDb ID:**
```
GET https://apibay.org/q.php?q=tt0816692&cat=0
```
Falls back to title search if IMDb search returns no results.

**By title (episodes):**
```
GET https://apibay.org/q.php?q=Show+Name+S01E01&cat=0
```

**Response processing:**
- Filters out "No results returned" entries
- Excludes torrents > 7GB (anti-remux filter)
- Maps to `{quality, hash, size, seeds, peers}`
- Sorts by seed count, returns top 10

**Magnet link builder (`buildMagnet`):**
Constructs a magnet URI with all configured trackers appended:
```
magnet:?xt=urn:btih:<hash>&dn=<name>&tr=<tracker1>&tr=<tracker2>&...
```

---

### 2.6 subtitles.js — Subtitle Engine

**File:** `src/subtitles.js` (132 lines)

Scrapes `yts-subs.com` for English subtitles. Entirely in-memory (no disk writes).

**Flow:**
1. `startSubtitleDownload(imdbId)` initiates async pipeline
2. Scrape `https://yts-subs.com/movie-imdb/<imdbId>` for English subtitle link
3. Follow link to subtitle page, extract `data-link` attribute (base64-encoded URL)
4. Download ZIP, extract `.srt` file via `unzipper`
5. Convert SRT→WebVTT: replace commas with dots in timestamps, prepend `WEBVTT\n\n`
6. Store in `subtitleCache` Map (in-memory)

**`getEnglishVtt(imdbId)`:**
- Calls `startSubtitleDownload` (no-op if already in progress or done)
- If ready, returns cached VTT string
- If in progress, polls every 100ms for up to 30s
- If failed, throws error

**Concurrency:** Uses a single async task per IMDb ID. Subsequent calls reuse the cached result or join the in-progress download.

---

### 2.7 cache.js — Two-Layer Cache

**File:** `src/cache.js` (77 lines)

Generic cache with memory + disk layers.

- **Memory:** `Map<urlHash, {value, expiresAt}>` — fast, process-local
- **Disk:** `.cache/<cacheDir>/<sha1>.json` — persists across restarts
- **TTL:** checked at both layers; expired entries are deleted
- **`ensureDir`:** `mkdirSync` with `recursive: true` (used by many modules)

---

### 2.8 user-db.js — User Data

**File:** `src/user-db.js` (147 lines)

JSON file database at `.cache/user-data.json`. Single file with all user data:

```json
{
    "watchlist": [{ "imdbId": "...", "movieDetails": {...}, "mediaType": "movie", "addedAt": 12345 }],
    "progress": {
        "tt1234567": { "timestamp": 1800, "duration": 7200, "movieDetails": {...}, "mediaType": "movie", "updatedAt": 12345 }
    },
    "history": [{ "imdbId": "...", "movieDetails": {...}, "watchedAt": 12345 }],
    "ratings": {
        "tt1234567": { "rating": 4, "movieDetails": {...}, "ratedAt": 12345 }
    }
}
```

**Progress rules:**
- If `timestamp / duration > 0.95` → remove from progress (completed), add to history
- Otherwise, save/update progress entry
- Continue-watching list sorted by `updatedAt` descending

**Rating rules:**
- 1-5 scale, integer
- One rating per ID (last write wins)

**History:** Max 50 entries (FIFO eviction).

---

### 2.9 storage.js — Disk Management

**File:** `src/storage.js` (75 lines)

Filesystem operations for cache management.

- **`listMovies()`:** Reads `.cache/downloads/` top-level entries
- **`deleteMovie(name)`:** Path-traversal sanitized (rejects `..`, `/`, `\`)
- **`deleteAllMovies()`:** `rmSync` + `mkdirSync` to recreate empty directory
- **`totalStorageUsed()`:** Recursively sums downloads + hls directories
- **`MAX_STORAGE_BYTES`:** 20GB — triggers auto-purge on next stream start

---

## 3. Frontend — Inside Out

### 3.1 page.tsx — Main Application

**File:** `frontend/app/page.tsx` (~2000 lines)

Single-page application with all UI in one file. Sections:

| Lines | Section |
|-------|---------|
| 1-57 | Imports, config, type definitions |
| 59-180 | State declarations, refs, utility functions |
| 182-280 | `useEffect`: initial data fetch, event listeners |
| 282-330 | `fetchUserLists`: watchlist, continue-watching, history, ratings, storage |
| 330-475 | `toggleWatchlist`, `handleCardClick`, hero selection, hero autoplay |
| 476-645 | `playMovie`: torrent session orchestration |
| 647-695 | `changeTorrentQuality`, `changeEpisode` |
| 693-754 | `pollHlsReady`: wait for playlist + resume seek logic |
| 756-828 | `initializeVideoPlayer`: Hls.js setup, event listeners |
| 830-862 | `reportProgress`: save position to backend |
| 864-960 | `seekTo`: manual seeking (buffered fast path + FFmpeg restart) |
| 962-1040 | `startTorrentStatusPolling`, subtitle upload/download, `closePlayer` |
| 1040-1200 | JSX: header, hero section, category rows |
| 1200-1500 | JSX: continue-watching, watchlist, history, search results |
| 1500-2004 | JSX: player overlay, sidebar (audio, quality, subs), storage, log viewer |

**Key state machine for playback:**

```
idle → playMovie() → pollHlsReady() → initializeVideoPlayer() → playing
                                                                     ↓
                                                               seekTo() → seeking → playing
                                                                     ↓
                                                           closePlayer() → idle
```

### 3.2 Player System

**Hls.js initialization:**
```javascript
const hls = new Hls({
    maxBufferLength: 30,
    maxBufferSize: 60 * 1000 * 1000  // 60MB
});
hls.loadSource(url);
hls.attachMedia(video);
hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video.currentTime = startTimeOrZero;
    video.play();
});
hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else { setHlsErrorMsg(...); hls.destroy(); }
    }
});
```

**Player UI — custom controls:**
No native `<video controls>`. Custom overlay with:
- **Seek bar:** Transparent div capturing clicks + mousemove (for hover preview, though not yet implemented). Width = `(seekOffset + currentTime) / sourceDuration`.
- **Time display:** `formatTime(absTime)` — shows `h:mm:ss` when ≥ 1 hour, `m:ss` otherwise.
- **Fullscreen button:** Calls `playerContainerRef.current.requestFullscreen()` (targets the player div, not the whole page).
- **Auto-hide:** Mouse movement shows UI for 3s, then fades. Always visible when paused.

**Seek offset system:**
```
displayTime = seekOffset + video.currentTime
progress = displayTime / sourceDuration
```

- Initial stream: `seekOffset = 0`, `currentTime` starts at 0 → absolute = 0
- After seek to 1800s: `seekOffset = 1800`, `currentTime` starts at 0 → absolute = 1800
- After watching 30s: `seekOffset = 1800`, `currentTime = 30` → absolute = 1830

**Seek fast path:**
```javascript
const relativeTarget = targetTime - seekOffset;
if (relativeTarget is within video.buffered) {
    video.currentTime = relativeTarget;
    return; // No FFmpeg restart needed
}
```

This checks whether the absolute `targetTime` (from the seek bar click) falls within the current stream's buffered range (which is relative to `seekOffset`). If yes, native video seek — no FFmpeg restart, no loading spinner.

**Seek slow path (beyond buffered range):**
1. Capture frozen frame via canvas `drawImage`
2. Destroy current Hls.js instance
3. `POST /api/stream/:sessionId/seek` with `{time: targetTime, audioTrack}`
4. Poll `GET /hls/index.m3u8?audioTrack=&startTime=` until 200 + mpegurl content type
5. Create new Hls.js with seeked URL
6. Clear frozen frame, set `seekOffset = targetTime`

**Frozen frame overlay during seek:**
```
<div style={{
    backgroundImage: `url(${frozenFrame})`,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
}}>
    <Loader2 className="animate-spin" />
</div>
```

The frame is captured into a canvas data URL before Hls.js is destroyed, preventing the black flash that would otherwise occur while FFmpeg restarts.

**Event listeners & cleanup:**
```javascript
const onTimeUpdate = () => setPlayerCurrentTime(video.currentTime);
const onPlay = () => setPlayerPaused(false);
const onPause = () => setPlayerPaused(true);

video.addEventListener("timeupdate", onTimeUpdate);
// Stored in playerListenersCleanupRef for proper teardown
```

### 3.3 Component Library

**File:** `frontend/app/components/`

Custom animated components used throughout the UI:

| Component | File | Purpose |
|-----------|------|---------|
| `VariableProximity` | `VariableProximity.tsx` | Text that scales/glows based on mouse proximity |
| `ScrambledText` | `ScrambledText.tsx` | Text that scrambles characters on hover |
| `GlassSurface` | `GlassSurface.tsx` | Glassmorphic card with backdrop blur |
| `FadeContent` | `FadeContent.tsx` | Fade-in on scroll intersection |
| `Dither` | `Dither.tsx` | Subtle noise/dither overlay for dark sections |
| `ScrollRow` | `ScrollRow.tsx` | Horizontal scrollable movie row with pagination |
| `TrueFocus` | `TrueFocus.tsx` | Follows mouse with a spotlight effect |
| `GradualBlur` | `GradualBlur.tsx` | Edge blur for scroll containers |

---

## 4. Streaming Pipeline — Deep Dive

### 4.1 Torrent Session Lifecycle

```
User clicks movie card
        │
        ▼
playMovie(movie, startTime=0)
        │
        ├── setSeekOffset(0), show loader
        │
        ├── Fetch /api/movie/:id → get TMDB details + PirateBay torrents
        │
        ├── POST /api/stream/start { hash }
        │       │
        │       ▼
        │   Backend:
        │   ├── Check storage (purge if >20GB)
        │   ├── Stop previous session (fire-and-forget destroy)
        │   ├── WebTorrent client.add(magnet)
        │   ├── Wait for torrent 'ready' event
        │   ├── selectBestFile → prioritizeStartup (50MB beginning + 5MB end)
        │   ├── waitForBuffer (2% or 1MB, 30s timeout)
        │   ├── ensureHls(session) in background
        │   ├── probeSourceDuration(session) in background
        │   └── Return { sessionId, hlsUrl }
        │
        ├── pollHlsReady(url, sessionId, startTime)
        │       │
        │       ├── (if startTime > 0: seek to position, poll seeked playlist)
        │       │
        │       ├── Poll GET /hls/index.m3u8 every 1s for up to 90 iterations
        │       │       │
        │       │       ▼
        │       │   Backend GET handler:
        │       │   ├── Calls ensureHls(session, audioTrack, startTime)
        │       │   │       ├── Dedup check (starting Map)
        │       │   │       ├── Clean segment dir
        │       │   │       ├── ffprobe codecs
        │       │   │       ├── Spawn ffmpeg
        │       │   │       └── Return record
        │       │   └── Serve playlist if exists, 204 if not
        │       │
        │       └── When 200 + mpegurl: sleep(4s), then:
        │
        └── initializeVideoPlayer(url, adjustedStart)
                │
                ├── Cleanup old Hls.js + event listeners
                ├── Create new Hls.js
                ├── attachMedia + loadSource
                ├── On MANIFEST_PARSED: currentTime = adjustedStart, play()
                ├── Set up timeupdate/play/pause listeners
                └── Start reportProgress interval (5s)
```

### 4.2 HLS Transcoding Flow

```
WebTorrent file (MKV/MP4)
        │
        │ HTTP Range requests (from ffmpeg)
        ▼
Express HTTP Server (GET /api/stream/:sessionId)
        │
        │ Streaming response (206 Partial Content)
        ▼
FFmpeg process
        │
        ├── Input: HTTP stream (consumed as-it-arrives from torrent)
        ├── Video: stream copy (no decode)
        ├── Audio: copy (AAC/MP3) or transcode (DTS/AC3 → AAC)
        │
        └── Output: fMP4 segments
                │
                ├── init.mp4 (initialization segment — moov box)
                ├── segment_00000.m4s (5s)
                ├── segment_00001.m4s (5s)
                └── index.m3u8 (event playlist, appended by ffmpeg)
                        │
                        ▼
                Hls.js (in browser via MSE)
                        │
                        ├── Loads init.mp4 → SourceBuffer.appendBuffer
                        ├── Loads segment_*.m4s → appendBuffer
                        └── Decodes via browser codecs (H.264/HEVC + AAC)
```

**Why stream copy for video?**
- 4K HEVC transcoding requires ≈10-20× real-time CPU (1s of video = 10-20s of encode)
- Stream copy is essentially free (just remuxes the packets)
- Browser support: Chrome/Firefox/Edge all support HEVC hardware decoding; Safari supports it natively

**Audio transcode decision:**
```javascript
const aCodec = (codecs.audioCodec === "aac" || codecs.audioCodec === "mp3") ? "copy" : "aac";
```
Hls.js and MSE require AAC or MP3 audio. DTS, AC3, EAC3, TrueHD, FLAC, Vorbis, Opus — all must be transcoded to AAC. The `-b:a 192k -ac 2` settings give good quality at reasonable bitrate.

### 4.3 Seek Mechanics

```
User clicks seek bar at 45% of sourceDuration (e.g., 1800s into a 4000s movie)
        │
        ▼
seekTo(0.45)
        │
        ├── targetTime = 0.45 * seekDurRef.current = 1800
        │
        ├── Fast path: relativeTarget = 1800 - seekOffset
        │   ├── If within video.buffered → video.currentTime = relativeTarget → return
        │   └── If not → continue
        │
        ├── Show frozen frame (canvas capture)
        ├── Destroy Hls.js
        │
        ├── POST /api/stream/:sessionId/seek { time: 1800, audioTrack: 0 }
        │       │
        │       ▼
        │   Backend:
        │   ├── seekToPosition(session, 1800)
        │   │       ├── byteOffset = (1800/4000) * file.length
        │   │       ├── targetPiece = byteOffset / pieceLength
        │   │       ├── torrent.critical(targetPiece ± 5MB window)
        │   │       └── torrent.critical(last 5MB)
        │   │
        │   └── ensureHls(session, 0, 1800)
        │           ├── stopHls (SIGKILL old ffmpeg, delete segment dir)
        │           ├── Clean dir
        │           ├── ffprobe codecs
        │           └── Spawn ffmpeg with -ss 1800 -accurate_seek
        │
        ├── Poll GET /hls/index.m3u8?audioTrack=0&startTime=1800 up to 120×
        │       │
        │       ▼
        │   Backend GET handler:
        │   ├── Calls ensureHls(session, 0, 1800)
        │   │   └── Dedup check: already starting with (0, 1800) → await existing promise
        │   └── When playlist exists → serve it
        │
        └── On playlist ready:
            ├── setSeekOffset(1800)
            ├── Clear frozen frame
            ├── Create new Hls.js with ?audioTrack=0&startTime=1800 URL
            └── On MANIFEST_PARSED: currentTime = 0, play()
```

**Why `-ss 1800 -accurate_seek` before `-i`?**
- `-ss` before `-i` = input seeking: FFmpeg finds the nearest keyframe and starts reading from there
- `-accurate_seek`: decodes and discards frames between the keyframe and the exact position
- With `-c:v copy`, seeking is keyframe-accurate (not frame-accurate). This is acceptable for HLS since segments start at keyframes anyway

**The `startTime` query param is critical:**
```
GET /hls/index.m3u8?audioTrack=0&startTime=1800
```
Without `startTime=1800`, the backend's `ensureHls` would see `(session, 0, 0)`, find the existing record for `(0, 0)` — but that was killed during seek. It would restart FFmpeg from byte 0, defeating the seek entirely. With `startTime=1800`, the cache key `(0, 1800)` is new, so a fresh FFmpeg starts at the correct position.

### 4.4 Resume & Continue-Watching

**Saving progress (every 5s):**
```javascript
const timestamp = seekOffset + video.currentTime;  // Absolute position
const duration = sourceDuration || video.duration;  // True movie length

// POST /api/progress { imdbId, timestamp, duration, mediaType, sessionId }
```

**Loading resume:**
```javascript
// From continue-watching card click:
playMovie({ ...item.movieDetails, imdb_id: item.imdbId, media_type: mt }, item.timestamp)

// In playMovie:
pollHlsReady(url, sessionId, startTime)  // startTime = 1800

// In pollHlsReady:
if (startTime > 0) {
    // Instead of loading from byte 0, restart FFmpeg at resume position
    POST /api/stream/:sessionId/seek { time: startTime, audioTrack }
    Poll seeked URL until ready
    setSeekOffset(startTime)
    effectiveUrl = seekUrl  // URL with ?startTime=1800
    adjustedStart = 0       // Stream already starts at 1800, so player starts at 0
}

initializeVideoPlayer(effectiveUrl, adjustedStart)
// Hls.js loads stream from 1800, currentTime starts at 0
// Display: seekOffset(1800) + currentTime(0) = 1800 ✓
```

**Same-hash resume (no new stream):**
```javascript
if (hash === activeTorrentHash && activeSessionId) {
    if (startTime > 0 && videoRef.current) {
        const relativeSeek = startTime - seekOffset;
        videoRef.current.currentTime = relativeSeek >= 0 ? relativeSeek : startTime;
    }
    return;
}
```

This handles the case where the user clicks "continue watching" on the same movie already loaded. Instead of creating a new stream, it calculates the relative position within the current stream's timeline.

### 4.5 Subtitle System

Two subtitle sources:

**1. Torrent-internal subtitles (`.srt`/`.vtt` files inside the torrent):**
- Listed via `GET /api/stream/:sessionId/subs` with `downloaded` status
- Frontend polls every 2s to update status
- Download button: `fetch(URL) → response.blob() → URL.createObjectURL → programmatic <a> click`
- File is served via `GET /api/stream/:sessionId/subs/:fileIndex` with SRT→VTT conversion:
  ```javascript
  // If .srt:
  content = content.replace(/^\uFEFF/, '');  // Strip BOM
  content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');  // SRT→VTT timestamps
  content = "WEBVTT\n\n" + content;  // Prepend header
  ```

**2. Uploaded `.srt` files:**
- File input → `FileReader.readAsText` → SRT→VTT conversion → `URL.createObjectURL(blob)`
- Set as `<track>` element on the video:
  ```jsx
  {subtitleTrackUrl && (
      <track kind="subtitles" src={subtitleTrackUrl} srcLang="en" label={subtitleTrackLabel} default />
  )}
  ```

**Why no `<track>` for torrent subs directly?**
Cross-origin MSE restrictions make it unreliable to serve fetch responses from a different port/origin as `<track src>`. Instead, the user downloads the file (fetch+blob), which is a user-gesture-triggered action that bypasses CORS restrictions on MSE content.

---

## 5. Data Flow Diagrams

### Playback initialization

```
Browser                    Backend                       WebTorrent/FFmpeg
  │                          │                               │
  │──POST /stream/start─────▶│                               │
  │                          │──WebTorrent.add(magnet)──────▶│
  │                          │──waitForBuffer()─────────────▶│
  │                          │──ensureHls(session)──────────▶│──ffmpeg starts
  │                          │──probeSourceDuration()───────▶│──ffprobe
  │◀────{sessionId, hlsUrl}──│                               │
  │                          │                               │
  │──GET /hls/index.m3u8────▶│                               │
  │  (poll every 1s, up to   │──ensureHls(session)──────────▶│
  │   90 iterations)         │  (dedup, returns if in-progress)
  │                          │◀───────────playlist file──────│
  │◀────mpegurl content-type │                               │
  │                          │                               │
  │──sleep(4s)──┐            │                               │
  │             │            │                               │
  │──GET /hls/init.mp4──────▶│──read from disk──────────────▶│
  │◀────init segment─────────│                               │
  │                          │                               │
  │──GET /hls/segment_0.m4s─▶│──read from disk──────────────▶│
  │◀────fMP4 segment─────────│                               │
  │                          │                               │
  │ Hls.js playback starts   │                               │
```

### Seek operation

```
Browser                    Backend                       WebTorrent/FFmpeg
  │                          │                               │
  │──canvas.drawImage()──┐   │                               │
  │──hls.destroy()───────┘   │                               │
  │                          │                               │
  │──POST /stream/:id/seek──▶│                               │
  │  {time: 1800, audio: 0}  │──seekToPosition(1800)────────▶│
  │                          │  ├─byteOffset=byte calc       │──torrent.critical()
  │                          │  └─torrent.critical()         │
  │                          │──stopHls()───────────────────▶│──SIGKILL
  │                          │──ensureHls(session,0,1800)───▶│──ffmpeg -ss 1800
  │                          │                               │
  │──GET /hls/index.m3u8?    │                               │
  │  audioTrack=0&startTime= │──ensureHls() (dedup)─────────▶│──ffmpeg producing
  │  1800 (poll up to 120×)  │                               │
  │◀────mpegurl──────────────│                               │
  │                          │                               │
  │──New Hls.js──┐           │                               │
  │  seekUrl     │           │                               │
  │  currentTime=0│          │                               │
  │──play()──────┘           │                               │
```

### Continue Watching resume

```
Continue-Watching Card (timestamp: 1800, imdbId: tt0816692)
        │
        ▼
playMovie({...movieDetails, imdb_id: "tt0816692"}, 1800)
        │
        ├── setSeekOffset(0)  ← new stream starting
        ├── Fetch /api/movie/:id (or use hash directly)
        │
        ├── hash === activeTorrentHash?
        │   ├── YES: video.currentTime = 1800 - seekOffset → return (no new stream)
        │   └── NO: continue with new stream → setSeekOffset(0)
        │
        ├── POST /api/stream/start { hash }
        │
        └── pollHlsReady(url, sessionId, 1800)
                │
                ├── startTime > 0 → enter seek block
                │   ├── POST /stream/:sessionId/seek { time: 1800 }
                │   └── Poll seeked URL → setSeekOffset(1800)
                │
                └── initializeVideoPlayer(seekUrl, adjustedStart=0)
                    └── Hls.js from 1800, currentTime=0
```

---

## 6. Docker & Deployment

### Containers

**Backend** (`backend.Dockerfile`):
- Base: `node:20-slim`
- Adds FFmpeg via apt
- `npm start` runs `node src/server.js`

**Frontend** (`frontend.Dockerfile`):
- Multi-stage: builder + runner
- `node:20-slim` for both
- Build arg `NEXT_PUBLIC_API_URL` injected at build time
- `.next` output copied to slim runner

**Compose** (`docker-compose.yml`):
```yaml
services:
  backend:
    build: {dockerfile: backend.Dockerfile}
    ports: ["3000:3000"]
    volumes: ["./.cache:/app/.cache"]
    environment: [NODE_ENV=production]

  frontend:
    build: {dockerfile: frontend.Dockerfile, args: {NEXT_PUBLIC_API_URL}}
    ports: ["3001:3000"]
    depends_on: [backend]
```

### Environment

| Variable | Default | Required | Notes |
|----------|---------|----------|-------|
| `PORT` | `3000` | No | Backend port |
| `TMDB_API_KEY` | built-in | No | Override the default |
| `HLS_ENABLED` | `true` | No | Set to `false` to bypass HLS entirely |
| `HLS_TRANSCODE` | `false` | No | Force audio transcode (debug) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Yes (prod) | Frontend's API base URL |

### Storage

All under `.cache/`:
```
.cache/
├── tmdb/            # TMDB API response cache (JSON, SHA1 filenames)
├── downloads/       # Torrent data files (MKV, MP4, etc.)
│   └── <hash>.torrent  # Cached torrent metadata
├── hls/             # FFmpeg output
│   └── <sessionId>/
│       ├── init.mp4
│       ├── segment_00000.m4s
│       ├── segment_00001.m4s
│       └── index.m3u8
└── user-data.json   # Watchlist, progress, history, ratings
```

### Production considerations

- **Reverse proxy:** Not included. Use Caddy/Nginx to proxy `/api/*` → backend `:3000`, everything else → frontend `:3001`
- **Persistence:** Mount `.cache` as a Docker volume to survive container restarts
- **Resource limits:** FFmpeg will use all available CPU threads (`-threads 0`). Consider `--cpus` limit in Docker if running alongside other services
- **Network:** WebTorrent needs DHT/PEX connectivity. Ensure Docker host has UDP ports exposed or use host networking mode
