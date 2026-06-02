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
