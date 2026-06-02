# VidLink

## API Documentation

### Embed Movies

TMDB ID is required from The Movie Database API.

```
https://vidlink.pro/movie/{tmdbId}
```

**Code Example:**

```html
<iframe src="https://vidlink.pro/movie/786892" frameborder="0" allowfullscreen></iframe>
```

---

### Embed TV Shows

TMDB ID is required from The Movie Database API. Season and episode number should not be empty.

```
https://vidlink.pro/tv/{tmdbId}/{season}/{episode}
```

**Code Example:**

```html
<iframe src="https://vidlink.pro/tv/94997/1/1" frameborder="0" allowfullscreen></iframe>
```

---

### Embed Anime (New)

MyAnimeList ID is required from MyAnimeList API. Number and type should not be empty.

```
https://vidlink.pro/anime/{MALid}/{number}/{subOrDub}
```

Add `?fallback=true` to force fallback to sub and vice versa if the type you set was not found.

```
https://vidlink.pro/anime/{MALid}/{number}/{subOrDub}?fallback=true
```

**Code Example:**

```html
<iframe src="https://vidlink.pro/anime/5/1/sub" frameborder="0" allowfullscreen></iframe>
```

---

## Customization Parameters

You can customize the embedded media player by appending parameters to the URL. Each parameter should start with `?` and multiple parameters should be separated with `&`. Use hex color codes and remove the `#` before applying.

| Parameter | Type | Description | Example |
|---|---|---|---|
| `primaryColor` | string | Sets the primary color of the player, including sliders and autoplay controls. | `primaryColor=B20710` |
| `secondaryColor` | string | Defines the color of the progress bar behind the sliders. | `secondaryColor=170000` |
| `icons` | string | Changes the design of the icons within the player. Can be `"vid"` or `"default"`. | `icons=vid` |
| `iconColor` | string | Changes the color of the icons within the player. | `iconColor=B20710` |
| `title` | boolean | Controls whether the media title is displayed. | `title=false` |
| `poster` | boolean | Determines if the poster image is shown. | `poster=true` |
| `autoplay` | boolean | Controls whether the media starts playing automatically. | `autoplay=false` |
| `nextbutton` | boolean | Shows next episode button when 90% of the TV show is watched. **OFF by default.** | `nextbutton=true` |
| `player` | string | Changes the player to JWPlayer or default player. | `player=jw` |
| `startAt` | number | Starts the video at the specified time in seconds. This parameter cannot replace saved progress but can be used for cross-device watch progress. Remove cookies and cache after each test for the same content. | `startAt=60` |
| `sub_file` | string | Adds external subtitles to the video. Must be a direct link to a VTT subtitle file. | `sub_file=https://example.com/subtitles.vtt` |
| `sub_label` | string | Sets the label for the external subtitle track. If not provided, defaults to `'External Subtitle'`. | `sub_label=English` |

---

## Watch Progress

Track your users' watch progress across movies and TV shows. This feature enables "Continue Watching" functionality on your website.

### 1. Add Event Listener

Add this script where your iframe is located. For React/Next.js applications, place it in a `useEffect` hook.

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://vidlink.pro') return;
  
  if (event.data?.type === 'MEDIA_DATA') {
    const mediaData = event.data.data;
    localStorage.setItem('vidLinkProgress', JSON.stringify(mediaData));
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
{
  "76479": {
    "id": 76479,
    "type": "tv",
    "title": "The Boys",
    "poster_path": "/2zmTngn1tYC1AvfnrFLhxeD82hz.jpg",
    "progress": {
      "watched": 31.435372,
      "duration": 3609.867
    },
    "last_season_watched": "1",
    "last_episode_watched": "1",
    "show_progress": {
      "s1e1": {
        "season": "1",
        "episode": "1",
        "progress": {
          "watched": 31.435372,
          "duration": 3609.867
        }
      }
    }
  },
  "786892": {
    "id": 786892,
    "type": "movie",
    "title": "Furiosa: A Mad Max Saga",
    "poster_path": "/iADOJ8Zymht2JPMoy3R7xceZprc.jpg",
    "backdrop_path": "/wNAhuOZ3Zf84jCIlrcI6JhgmY5q.jpg",
    "progress": {
      "watched": 8726.904767,
      "duration": 8891.763
    },
    "last_updated": 1725723972695
  }
}
```

---

## Player Events

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
    "mtmdbId": number,
    "mediaType": "movie" | "tv",
    "season"?: number,
    "episode"?: number
  }
}
```

### Implementation Example

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://vidlink.pro') return;
  
  if (event.data?.type === 'PLAYER_EVENT') {
    const { event: eventType, currentTime, duration } = event.data.data;
    console.log(`Player ${eventType} at ${currentTime}s of ${duration}s`);
  }
});
```
