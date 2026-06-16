# BestSimilar

## API Documentation

BestSimilar provides similar movie/TV show recommendations. Given a title, you can look up its internal ID and then fetch the page containing similar titles.

### Search by Title

Search for a movie or TV show by name using the autocomplete endpoint. The response includes the internal ID and page URL needed for the next step.

| Parameter | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/movies/autocomplete` |
| Query | `serial=0` for movies, `serial=1` for TV shows |
| Query | `term={title}` |
| Header | `X-Requested-With: XMLHttpRequest` |

```
GET https://bestsimilar.com/movies/autocomplete?serial=0&term=the+perks+of+being+a+wallflower
X-Requested-With: XMLHttpRequest
```

**Response:**

```json
{
  "value": [
    {
      "id": "40736",
      "label": "The Perks of Being a Wallflower (2012)",
      "url": "/movies/40736-the-perks-of-being-a-wallflower",
      "serial": "0"
    }
  ],
  "Count": 1
}
```

---

### Get Similar Movies

Using the `url` from the search response, fetch the movie page to get similar movie recommendations.

```
GET https://bestsimilar.com/movies/40736-the-perks-of-being-a-wallflower
```

The page HTML contains a list of similar movies with similarity percentages, genres, plot tags, and other metadata.

---

### Search TV Shows

Same endpoint with `serial=1`.

```
GET https://bestsimilar.com/movies/autocomplete?serial=1&term=breaking+bad
X-Requested-With: XMLHttpRequest
```

**Response:**

```json
{
  "value": [
    {
      "id": "26292",
      "label": "Breaking Bad (2008)",
      "url": "/movies/26292-breaking-bad",
      "serial": "1"
    }
  ],
  "Count": 1
}
```

### Get Similar TV Shows

```
GET https://bestsimilar.com/movies/26292-breaking-bad
```

Returns similar TV shows in the same HTML structure as movies.

---

### Code Example

**PowerShell:**

```powershell
# Step 1: Search for the movie
$search = irm -Uri "https://bestsimilar.com/movies/autocomplete?serial=0&term=perks" `
  -Headers @{"X-Requested-With"="XMLHttpRequest"} | ConvertFrom-Json

$url = "https://bestsimilar.com$($search.value[0].url)"
$id = $search.value[0].id

# Step 2: Fetch the similar movies page
$page = irm -Uri $url
```

---

### Notes

- The `X-Requested-With: XMLHttpRequest` header is required for the autocomplete endpoint. Without it, the server returns `400 Bad Request`.
- The `serial` field in the response indicates the content type: `0` = movie, `1` = TV show.
- The `id` field (e.g., `40736`) is the internal BestSimilar database ID.
