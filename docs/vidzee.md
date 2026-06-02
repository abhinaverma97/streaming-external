# VidZee

## Movie Embed

```
GET https://player.vidzee.wtf/embed/movie/{tmdb_id}
```

## TV Show Embed (by season & episode)

```
GET https://player.vidzee.wtf/embed/tv/{tmdb_id}/{season}/{episode}
```

## V2 Endpoints (Alternative Player)

```
GET https://player.vidzee.wtf/v2/embed/movie/{tmdb_id}
GET https://player.vidzee.wtf/v2/embed/tv/{tmdb_id}/{season}/{episode}
```

## Example: Embed "Fight Club" (TMDB: 550)

```html
<iframe
  src="https://player.vidzee.wtf/embed/movie/550"
  width="100%"
  height="100%"
  frameBorder="0"
  allowFullScreen
/>
```

## Progress Events

### Listen for `MEDIA_DATA` from VidZee player

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://player.vidzee.wtf') return;

  if (event.data?.type === 'MEDIA_DATA') {
    const mediaData = event.data.data;
    localStorage.setItem('vidZeeProgress', JSON.stringify(mediaData));
  }
});
```

### `MEDIA_DATA` response structure

```json
{
  "60574": {
    "id": "60574",
    "type": "tv",
    "title": "Peaky Blinders",
    "poster_path": "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
    "backdrop_path": "//zZqpAXxVSBtxV9qPBcscfXBcL2w.jpg",
    "progress": {
      "watched": 2929.307998,
      "duration": 3317.28
    },
    "last_updated": 1763218167692,
    "number_of_episodes": 73,
    "number_of_seasons": 8,
    "last_season_watched": "1",
    "last_episode_watched": "2",
    "show_progress": {
      "s1e1": {
        "season": "1",
        "episode": "1",
        "progress": { "watched": 7.057403, "duration": 3697.08 },
        "last_updated": 1763218148618
      },
      "s1e2": {
        "season": "1",
        "episode": "2",
        "progress": { "watched": 2929.307998, "duration": 3317.28 },
        "last_updated": 1763218167692
      }
    }
  },
  "550": {
    "id": "550",
    "type": "movie",
    "title": "Fight Club",
    "poster_path": "/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg",
    "backdrop_path": "//qvyOfwTC3qdbzkqdXWSSEMHtjBZ.jpg",
    "progress": {
      "watched": 957.032489,
      "duration": 8304.725866951247
    },
    "last_updated": 1763218088456
  }
}
```

### `PLAYER_EVENT` structure

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

### Listen for `PLAYER_EVENT` from VidZee player

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://player.vidzee.wtf') return;

  if (event.data?.type === 'PLAYER_EVENT') {
    const { event: eventType, currentTime, duration } = event.data.data;
    console.log(`Player ${eventType} at ${currentTime}s of ${duration}s`);
  }
});
```
