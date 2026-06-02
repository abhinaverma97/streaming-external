# VidFast

## Documentation

Complete reference guide for embedding and customizing VidFast players on your website.

---

## Movie Embed

**Endpoint:** `https://vidfast.pro/movie/{id}?autoPlay=true`

### Required Parameters

| Parameter | Description |
|---|---|
| `{id}` | Movie identifier from IMDB or TMDB |

### Optional Parameters

| Parameter | Type | Description |
|---|---|---|
| `title` | boolean | Controls whether the media title is displayed |
| `poster` | boolean | Determines if the poster image is shown |
| `autoPlay` | boolean | Controls whether the media starts playing automatically |
| `startAt` | number | Starts the video at the specified time in seconds |
| `theme` | string | Changes the player's color (hex code format) |
| `server` | string | Changes the default server for the player (set to server name) |
| `hideServer` | boolean | Controls whether the server selector button is shown or hidden |
| `fullscreenButton` | boolean | Controls whether the fullscreen button is shown or hidden |
| `chromecast` | boolean | Controls whether the Chromecast button is shown or hidden |
| `sub` | string | Sets the default subtitle (e.g. `en`, `es`, `fr`) |

### Examples

- `https://vidfast.pro/movie/tt6263850`
- `https://vidfast.pro/movie/533535?theme=16A085`

---

## TV Show Embed

**Endpoint:** `https://vidfast.pro/tv/{id}/{season}/{episode}?autoPlay=true`

### Required Parameters

| Parameter | Description |
|---|---|
| `{id}` | TV show identifier from IMDB or TMDB |
| `{season}` | The season number |
| `{episode}` | The episode number |

### Optional Parameters

| Parameter | Type | Description |
|---|---|---|
| `title` | boolean | Controls whether the media title is displayed |
| `poster` | boolean | Determines if the poster image is shown |
| `autoPlay` | boolean | Controls whether the media starts playing automatically |
| `startAt` | number | Starts the video at the specified time in seconds |
| `theme` | string | Changes the player's color (hex code format) |
| `nextButton` | boolean | Displays the "Next Episode" button when 90% of the current episode has been watched |
| `autoNext` | boolean | Automatically plays the next episode when the current one ends (requires `nextButton`) |
| `server` | string | Changes the default server for the player (set to server name) |
| `hideServer` | boolean | Controls whether the server selector button is shown or hidden |
| `fullscreenButton` | boolean | Controls whether the fullscreen button is shown or hidden |
| `chromecast` | boolean | Controls whether the Chromecast button is shown or hidden |
| `sub` | string | Sets the default subtitle (e.g. `en`, `es`, `fr`) |

### Examples

- `https://vidfast.pro/tv/tt4052886/1/5`
- `https://vidfast.pro/tv/63174/1/5?nextButton=true&autoNext=true`

---

## Basic Implementation

```html
<iframe
  src="https://vidfast.pro/movie/533535"
  width="100%"
  height="100%"
  frameborder="0"
  allowfullscreen
  allow="encrypted-media"
></iframe>
```

---

## Responsive Implementation

Wrap the iframe in this container to maintain the correct 16:9 aspect ratio:

```html
<!-- 16:9 Aspect Ratio Container -->
<div style="position: relative; padding-bottom: 56.25%; height: 0;">
  <iframe
    src="https://vidfast.pro/movie/533535"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    frameborder="0"
    allowfullscreen
    allow="encrypted-media"
  ></iframe>
</div>
```

### Responsive with Tailwind CSS

```jsx
<div className="relative w-full pt-[56.25%]">
  <iframe
    src="https://vidfast.pro/movie/533535"
    className="absolute top-0 left-0 w-full h-full"
    frameBorder="0"
    allowFullScreen
    allow="encrypted-media"
  ></iframe>
</div>
```

---

## Color Themes

Customize the player's color by adding the `theme` parameter:

### Green Theme

```html
<iframe src="https://vidfast.pro/movie/533535?theme=16A085"></iframe>
```

`#16A085`

### Blue Theme

```html
<iframe src="https://vidfast.pro/movie/533535?theme=2980B9"></iframe>
```

`#2980B9`

### Purple Theme

```html
<iframe src="https://vidfast.pro/movie/533535?theme=9B59B6"></iframe>
```

`#9B59B6`

---

## Advanced Features

### Complete Feature Example

```html
<iframe
  src="https://vidfast.pro/tv/tt4052886/1/5?autoPlay=true&title=true&poster=true&theme=16A085&nextButton=true&autoNext=true"
  width="100%"
  height="100%"
  frameborder="0"
  allowfullscreen
  allow="encrypted-media"
></iframe>
```

### Feature Compatibility Matrix

| Feature | Movies | TV Shows |
|---|---|---|
| Color Themes | ✓ | ✓ |
| AutoPlay | ✓ | ✓ |
| Start Time | ✓ | ✓ |
| Poster Display | ✓ | ✓ |
| Next Episode | ✗ | ✓ |
| Auto Next | ✗ | ✓ |

---

## Events & Progress Tracking

The player can send watch progress events to the parent window. You can save this progress to localStorage or your own backend.

### Available Events

| Event | Description |
|---|---|
| `play` | Triggered when video starts playing |
| `pause` | Triggered when video is paused |
| `seeked` | Triggered when user seeks to a different timestamp |
| `ended` | Triggered when video playback ends |
| `timeupdate` | Triggered periodically during playback |
| `playerstatus` | Triggered when `getStatus` is called |

### Event Data Structure

```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "event": "play" | "pause" | "seeked" | "ended" | "timeupdate" | "playerstatus",
    "currentTime": number,
    "duration": number,
    "tmdbId": number,
    "mediaType": "movie" | "tv",
    "season"?: number,
    "episode"?: number,
    "playing": bool,
    "muted": bool,
    "volume": number
  }
}
```

### Event Listener Implementation

Add this script where your iframe is located. For React/Next.js, place it in a `useEffect` hook.

```js
const vidfastOrigins = [
  'https://vidfast.pro',
  'https://vidfast.in',
  'https://vidfast.io',
  'https://vidfast.me',
  'https://vidfast.net',
  'https://vidfast.pm',
  'https://vidfast.xyz'
];

window.addEventListener('message', ({ origin, data }) => {
  if (!vidfastOrigins.includes(origin) || !data) {
    return;
  }

  if (data.type === 'PLAYER_EVENT') {
    const { event, currentTime, duration } = data.data;

    console.log(`Player ${event} at ${currentTime}s of ${duration}s`);

    // Add custom event handling logic here
  }
});
```

### Direct Media Data Event Listener

This simpler event listener directly captures and stores the complete media data structure:

```js
const vidfastOrigins = [
  'https://vidfast.pro',
  'https://vidfast.in',
  'https://vidfast.io',
  'https://vidfast.me',
  'https://vidfast.net',
  'https://vidfast.pm',
  'https://vidfast.xyz'
];

window.addEventListener('message', ({ origin, data }) => {
  if (!vidfastOrigins.includes(origin) || !data) {
    return;
  }

  if (data.type === 'MEDIA_DATA') {
    localStorage.setItem('vidFastProgress', JSON.stringify(data.data));
  }
});
```

### Stored Data Structure Example

The data is stored in localStorage and contains movie/show details, watch progress, and episode-specific progress for TV shows.

```json
{
  "t63174": {
    "id": 63174,
    "type": "tv",
    "title": "Lucifer",
    "poster_path": "/ekZobS8isE6mA53RAiGDG93hBxL.jpg",
    "backdrop_path": "/wbiPjTWpZMIB8ffBq7HvzAph4Ft.jpg",
    "progress": {
      "watched": 793.207692,
      "duration": 2695.3689
    },
    "last_season_watched": 1,
    "last_episode_watched": 1,
    "show_progress": {
      "s1e1": {
        "season": 1,
        "episode": 1,
        "progress": {
          "watched": 793.207692,
          "duration": 2695.3689
        },
        "last_updated": 1742578021768
      }
    },
    "last_updated": 1742578021768
  },
  "m533535": {
    "id": 533535,
    "type": "movie",
    "title": "Deadpool & Wolverine",
    "poster_path": "/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
    "backdrop_path": "/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg",
    "progress": {
      "watched": 353.530349,
      "duration": 7667.227
    },
    "last_updated": 1742577064433
  }
}
```
