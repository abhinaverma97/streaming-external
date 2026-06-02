# Cinezo

## Universal Access

One player for all your entertainment. Movies, TV shows, and anime in one embeddable solution.

---

## Movies

Embed any movie using its TMDB ID.

**Endpoint:** `https://player.cinezo.live/embed/movie/{tmdbId}`

Replace `{tmdbId}` with your TMDB movie ID.

---

## TV Shows

Embed episodes with season and episode params.

**Endpoint:** `https://player.cinezo.live/embed/tv/{tmdbId}/{season}/{episode}`

Season and episode numbers are required.

---

## Anime

Embed anime content via AniList ID with dub support.

**Endpoint:** `https://player.cinezo.live/embed/anime/{AnilistId}/{number}?dub=true`

Add `?dub=true` or `?dub=false` for audio preference.

---

## Configuration

Add these as query parameters to your embed URL to customize the player experience.

| Parameter | Type | Description |
|---|---|---|
| `primarycolor` | string | Main player color theme |
| `secondarycolor` | string | Secondary accent color |
| `iconcolor` | string | Color of player icons |
| `autoplay` | boolean | Auto-play on load |
| `poster` | boolean | Show movie poster |
| `chromecast` | boolean | Enable Chromecast support |
| `servericon` | boolean | Show server selection button |
| `setting` | boolean | Show player settings button |
| `pip` | boolean | Enable Picture-in-Picture mode |
| `font` | string | Subtitle font family |
| `fontcolor` | string | Subtitle text color |
| `fontsize` | number | Subtitle font size in pixels |
| `opacity` | number | Subtitle opacity (0–1) |
| `logourl` | string | Custom logo URL |
| `server` | string | Server name or number for playback |

### Complete Example

Combine multiple parameters in one URL:

```
https://player.cinezo.live/embed/movie/12345?primarycolor=e8b86d&secondarycolor=c49de8&fontcolor=e8b86d&autoplay=true&poster=true
```

---

## Watch Progress

Track users' watch progress to enable Continue Watching on your site.

### Overview

Progress Tracking is a lightweight event-driven system for monitoring playback progress. It stores watch data locally, providing persistent resume functionality across sessions.

- Smart resume and episode-specific tracking
- Real-time event monitoring (play, pause, seeked, etc.)
- Persistent local storage with no setup required
- Simple API for analytics or resume points

### Event Listener

Place inside your `useEffect` where the player iframe exists:

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://player.cinezo.live') return;

  if (event.data?.type === 'WATCH_PROGRESS') {
    const { mediaId, currentTime, duration } = event.data.data;
    localStorage.setItem(
      `progress_${mediaId}`,
      JSON.stringify({ currentTime, duration, lastWatched: Date.now() })
    );
  }
});
```

### Data Structure

Progress stored in localStorage with this format:

```json
{
  "movie_12345": {
    "currentTime": 1247.5,
    "duration": 7200,
    "lastWatched": 1703123456789,
    "mediaType": "movie",
    "title": "The Dark Knight",
    "watched_percentage": 17.3
  },
  "show_67890": {
    "season": 1,
    "episode": 5,
    "currentTime": 2341.2,
    "duration": 2640,
    "lastWatched": 1703123456789,
    "mediaType": "tv",
    "watched_percentage": 88.7
  }
}
```

### Available Events

| Event | Description |
|---|---|
| `play` | Triggered when video starts playing |
| `pause` | Triggered when video is paused |
| `seeked` | Triggered when user seeks to a different timestamp |
| `ended` | Triggered when video playback ends |
| `timeupdate` | Triggered periodically during playback |

### Full Implementation

Complete production-ready progress tracking:

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://player.cinezo.live') return;

  if (event.data?.type === 'WATCH_PROGRESS') {
    const { mediaId, eventType, currentTime, duration } = event.data.data;

    localStorage.setItem(
      `progress_${mediaId}`,
      JSON.stringify({ currentTime, duration, lastWatched: Date.now(), eventType })
    );

    if (eventType === 'play') console.log('Playing');
    if (eventType === 'pause') console.log('Paused');
  }
});
```
