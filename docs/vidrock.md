# VidRock

## API Documentation

Comprehensive API reference for embedding movies and series using TMDB or IMDB IDs.

---

## Movie Embed URL

```
https://vidrock.ru/movie/{tmdb_id}
https://vidrock.ru/movie/{imdb_id}
```

**Example iframe:**

```html
<iframe src="https://vidrock.ru/movie/tt4154796" allowfullscreen></iframe>
```

---

## TV Shows Embed URL

```
https://vidrock.ru/tv/{tmdb_id}/{season_number}/{episode_number}
https://vidrock.ru/tv/{imdb_id}/{season_number}/{episode_number}
```

**Example iframe:**

```html
<iframe src="https://vidrock.ru/tv/tt0903747/1/1" allowfullscreen></iframe>
```

---

## List All Movies & Series

- `https://vidrock.ru/list/movie.json`
- `https://vidrock.ru/list/tv.json`

---

## Available URL Parameters

Customize the player behavior by adding these parameters to your URLs.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `autoplay` | boolean | `false` | Automatically start playing the video when loaded |
| `autonext` | boolean | `false` | Plays next TV episode automatically |
| `theme` | hex color | `ffffff` | Custom accent color (without `#`). Changes player theme colors |
| `download` | boolean | `true` | Show/hide the download button in player controls |
| `nextbutton` | boolean | `true` | Show/hide next episode notification for TV shows |
| `episodeselector` | boolean | `true` | Show/hide the season/episode selector button |
| `lang` | language code | browser lang | Auto-select subtitles by language (e.g. `'en'`, `'es'`, `'fr'`). Uses 2-letter ISO codes |

### Parameter Examples

- Enable autoplay: `?autoplay=true`
- Enable autonext: `?autonext=true`
- Custom red theme: `?theme=ff6b6b`
- Hide download button: `?download=false`

---

## Continue Watching Feature

Track your users' watch progress across movies and TV shows. This feature enables "Continue Watching" functionality on your website.

### 1. Add Event Listener

Add this script where your iframe is located. For React/Next.js applications, place it in a `useEffect` hook.

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://vidrock.ru') return;

  if (event.data?.type === 'MEDIA_DATA') {
    const mediaData = event.data.data;
    localStorage.setItem('vidRockProgress', JSON.stringify(mediaData));
  }
});
```

### 2. Stored Data Structure

The data is stored in localStorage and contains:

- Movie/Show details (title, poster, etc.)
- Watch progress (time watched, duration)
- Last watched episode for TV shows
- Episode-specific progress for shows

```json
[
  {
    "id": 12,
    "type": "movie",
    "title": "Finding Nemo",
    "poster_path": "/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",
    "backdrop_path": "/eCynaAOgYYiw5yN5lBwz3IxqvaW.jpg",
    "progress": {
      "watched": 64.713891,
      "duration": 6053.865999999997
    },
    "last_updated": 1732173179272
  },
  {
    "id": 52814,
    "type": "tv",
    "title": "Halo",
    "poster_path": "/4UmNhZCEu8Vt3byMvNxNEPyf8EY.jpg",
    "backdrop_path": "/zW0v2YT74C6tRafzqqBkfSqLAN0.jpg",
    "progress": {
      "watched": 0,
      "duration": 0
    },
    "last_updated": 1735651642940,
    "number_of_episodes": 17,
    "number_of_seasons": 2,
    "last_season_watched": "1",
    "last_episode_watched": "1",
    "show_progress": {
      "s1e1": {
        "season": "1",
        "episode": "1",
        "progress": {
          "watched": 3.793523,
          "duration": 3536.793000000001
        },
        "last_updated": 1735651642940
      }
    }
  }
]
```

---

## Player Event Tracking

Listen to player events to track user interactions and video playback states. Events are sent via `postMessage` to the parent window.

### Available Events

| Event | Description |
|---|---|
| `play` | Triggered when video starts playing |
| `pause` | Triggered when video is paused |
| `seeked` | Triggered when user seeks to a different timestamp |
| `ended` | Triggered when video playback ends |
| `timeupdate` | Triggered periodically during playback |

### Event Data Structure

```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "event": "play" | "pause" | "seeked" | "ended" | "timeupdate",
    "currentTime": number,
    "duration": number,
    "tmdbId": number,
    "mediaType": "movie" | "tv",
    "season"?: number,
    "episode"?: number
  }
}
```

### Implementation Example

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://vidrock.ru') return;

  if (event.data?.type === 'PLAYER_EVENT') {
    const { event: eventType, currentTime, duration } = event.data.data;
    console.log(`Player ${eventType} at ${currentTime}s of ${duration}s`);
  }
});
```
