# VidSrc.wtf

## API Documentation

Integrate our streaming API into your project.

**Note:** Only TMDB IDs / IMDB IDs are supported.

---

### API 1: Movie (Multi Server)

```
https://vidsrc.wtf/1/movie/{tmdb_id_or_imdb_id}?color={hex}
```

**Example:**

```html
<iframe src="https://vidsrc.wtf/1/movie/597?color=e50914" allowfullscreen></iframe>
```

### API 1: TV (Multi Server)

```
https://vidsrc.wtf/1/tv/{tmdb_id_or_imdb_id}/{season}/{episode}?color={hex}
```

**Example:**

```html
<iframe src="https://vidsrc.wtf/1/tv/1399/1/1?color=e50914" allowfullscreen></iframe>
```

---

## Watch Progress

Track user watch progress for "Continue Watching" functionality.

### 1. Add Event Listener

Add this script where your iframe is located. For React/Next.js or any other frontend framework, place in `useEffect`.

```js
window.addEventListener("message", (event) => {
  if (event.origin !== "https://www.vidsrc.wtf") return;

  if (event.data?.type === "MEDIA_DATA") {
    const mediaData = event.data.data;
    localStorage.setItem("vidsrcwtf-Progress", JSON.stringify(mediaData));
  }
});
```

### 2. Stored Data Structure

The data stored in localStorage contains:

- Movie/show details (title, poster, backdrop)
- Watch progress (time watched, duration)
- Last watched episode for TV shows
- Episode-specific progress for shows

```json
{
  "597": {
    "id": "597",
    "type": "movie",
    "title": "Titanic",
    "poster_path": "/sCzcYW9h55WcesOqA12cgEr9Exw.jpg",
    "backdrop_path": "/sCzcYW9h55WcesOqA12cgEr9Exw.jpg",
    "progress": {
      "watched": 3706.89533,
      "duration": 11689.66699999998
    },
    "last_updated": 1744442389334
  },
  "1399": {
    "id": "1399",
    "type": "tv",
    "title": "Game of Thrones",
    "poster_path": "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
    "backdrop_path": "/zZqpAXxVSBtxV9qPBcscfXBcL2w.jpg",
    "progress": {
      "watched": 948.146701,
      "duration": 3376.211996999974
    },
    "last_updated": 1744443112702,
    "number_of_episodes": 73,
    "number_of_seasons": 8,
    "last_season_watched": "1",
    "last_episode_watched": "9",
    "show_progress": {
      "s1e1": {
        "season": "1",
        "episode": "1",
        "progress": {
          "watched": 0.584535,
          "duration": 3696.145999999995
        },
        "last_updated": 1744442564248
      }
    }
  }
}
```
