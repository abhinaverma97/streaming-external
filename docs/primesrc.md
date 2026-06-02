# PrimeSrc

## API Documentation

---

## Embed Movies API

Embed a movie using an IMDb or TMDB ID.

**Endpoint:** `https://primesrc.me/embed/movie`

### Query Parameters

| Parameter | Required | Description |
|---|---|---|
| `imdb` | No | IMDb ID (e.g. `tt0848228`) |
| `tmdb` | No | TMDB ID (e.g. `100`) |
| `fallback` | No | `"true"` or `"false"`. Default is `"true"`. If `true`, tries third-party sources if no servers are available. |
| `serverOrder` | No | Comma-separated list of server names to prioritize (e.g. `PrimeVid,Voe,Dood`) |
| `whitelistServers` | No | Comma-separated list of server names — only these servers will be displayed |
| `blacklistServers` | No | Comma-separated list of server names — these servers will be excluded |
| `startAt` | No | Time to start the video at, in seconds |

### Examples

```
https://primesrc.me/embed/movie?imdb=tt0848228
https://primesrc.me/embed/movie?tmdb=123
https://primesrc.me/embed/movie?imdb=tt0848228&fallback=false&serverOrder=PrimeVid,Voe,Dood
```

---

## Embed TV Shows API

Embed an episode using an IMDb, TMDB, or TVMaze ID, plus season and episode numbers. If no episode or season number is given, it defaults to the first episode.

**Note:** Uses TVMaze episode numbering, which is not always the same as TMDB.

**Endpoint:** `https://primesrc.me/embed/tv`

### Query Parameters

| Parameter | Required | Description |
|---|---|---|
| `imdb` | No | IMDb ID (e.g. `tt0848228`) |
| `tmdb` | No | TMDB ID (e.g. `100`) |
| `tvmaze` | No | TVMaze ID (e.g. `100`) |
| `season` | **Yes** | Season number (e.g. `"1"` or `"2"`) |
| `episode` | **Yes** | Episode number (e.g. `"1"` or `"2"`) |
| `fallback` | No | `"true"` or `"false"`. Default is `"true"`. If `true`, tries third-party sources if no servers are available. |
| `serverOrder` | No | Comma-separated list of server names to prioritize (e.g. `PrimeVid,Voe,Dood`) |
| `whitelistServers` | No | Comma-separated list of server names — only these servers will be displayed |
| `blacklistServers` | No | Comma-separated list of server names — these servers will be excluded |
| `startAt` | No | Time to start the video at, in seconds |

### Examples

```
https://primesrc.me/embed/tv?tmdb=32726&season=1&episode=1
https://primesrc.me/embed/tv?tvmaze=48090
https://primesrc.me/embed/tv?tmdb=32726&season=1&episode=1&fallback=false&serverOrder=PrimeVid,Voe,Dood
```

---

## Info API

Returns information and a list of servers for a movie or episode. Can be called from the frontend to check if servers are available.

**Endpoint:** `GET https://primesrc.me/api/v1/list_servers`

### Query Parameters

| Parameter | Required | Description |
|---|---|---|
| `type` | **Yes** | Either `"tv"` or `"movie"` |
| `imdb` | No | IMDb ID (e.g. `tt0848228`) |
| `tmdb` | No | TMDB ID (e.g. `100`) |
| `tvmaze` | No | TVMaze ID (e.g. `100`) |
| `season` | No | Season number (e.g. `"1"` or `"2"`) |
| `episode` | No | Episode number (e.g. `"1"` or `"2"`) |

### Examples

```
https://primesrc.me/api/v1/list_servers?type=movie&imdb=tt0848228
https://primesrc.me/api/v1/list_servers?type=tv&tmdb=32726&season=1&episode=1
```

---

## Latest Episodes

Returns a list of episodes added in the last 24 hours.

**Endpoint:** `GET https://primesrc.me/api/v1/latest_episodes`

---

## Latest Movies

Returns a list of movies added in the last 24 hours.

**Endpoint:** `GET https://primesrc.me/api/v1/latest_movies`

---

## All Movies and Episodes

Returns a gzipped JSON file listing all movies or all episodes and their servers. Updated every 8 hours.

```
https://primesrc.me/dump/all_movies.json.gz
https://primesrc.me/dump/all_episodes.json.gz
```
