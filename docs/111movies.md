# 111Movies

## API Documentation

Detailed representation of the API endpoints for 111movies — including available methods, request formats, required and optional parameters.

### Movie Embed URL

**Endpoint:** `https://111movies.net/movie/{id}`

**Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `id` | Yes | TMDB ID (numeric) or IMDb ID (with `tt` prefix) |

**Examples:**

- `https://111movies.net/movie/tt6263850`
- `https://111movies.net/movie/533535`

---

### TV Shows Episode Embed URL

**Endpoint:** `https://111movies.net/tv/{id}/{season}/{episode}`

**Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `id` | Yes | TMDB ID (numeric) or IMDb ID (with `tt` prefix) |
| `season` | Yes | Season number |
| `episode` | Yes | Episode number |

**Examples:**

- `https://111movies.net/tv/tt30217403/1/5`
- `https://111movies.net/tv/240411/1/5`
