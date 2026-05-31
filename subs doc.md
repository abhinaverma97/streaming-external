Subtitles Search API Documentation (beta)
Overview

The Subtitles Search API allows users to search for movie or TV show subtitles based on various criteria such as film name, file name, specific IDs (IMDB, TMDB, SubDL), season and episode numbers, type (movie or TV), release year, and languages.

Endpoint:
https://api.subdl.com/api/v1/subtitles
Method: GET
Request Parameters

Send these one of these variables as GET URL

    api_key (Required): the api key from subdl account
    film_name (optional): Text search by film name.
    file_name (optional): Search by file name.
    sd_id (optional): Search by SubDL ID.
    imdb_id (optional): Search by IMDb ID.
    tmdb_id (optional): Search by TMDB ID.
    season_number (optional): Specific season number for TV shows.
    episode_number (optional): Specific episode number for TV shows.
    type (optional): Type of the content, either movie or tv.
    year (optional): Release year of the movie or TV show.
    languages (optional): Comma-separated language codes for subtitle languages.
    subs_per_page (optional): limit of subtitles will see in the results default is 10, (max can be 30)
    comment (optional): send comment=1 to get author comment on subtitle
    releases (optional): send releases=1 to get releases list on subtitle
    hi (optional): send hi=1 to get is Hearing Impaired on subtitle
    full_season (optional): send full_season=1 to get all full season subtitles
    unpack (optional): send unpack=1 to include saved episode files for packed/full-season subtitles

Successful Response

A successful response will return a JSON object with the following fields:

    status: A boolean indicating the success status (true).
    results: An array of movies or TV shows matching the search criteria.
    subtitles: An array of subtitles matching the search criteria for the first movie/TV show in the results.
    subtitles[].unpack_files: Returned only when unpack=1. Each item is one saved subtitle file from the pack and includes
    file_n_id
    ,
    name
    ,
    release_name
    ,
    season
    ,
    episode
    ,
    language
    ,
    hi
    ,
    format
    ,
    size
    ,
    md5
    , and
    url
    .

Error Response

An error response is returned as a JSON object with the following fields:

    status: A boolean indicating the success status (false).
    error: Error message indicating the reason for failure.

Download link example

Add subtitle link to dl.subdl.com endpoint like this example:

https://dl.subdl.com/subtitle/3197651-3213944.zip

When unpack=1 is used, single raw subtitle files can be downloaded from the returned file URL:

https://dl.subdl.com/subtitle/{n_id}/{file_n_id}

Usage Example
Request

{
  "query": {
    "api_key": "abcdefghisubdl",
    "film_name": "Inception",
    "type": "movie",
    "languages": "EN,FR",
    "unpack": "1"
  }
}

Response Body

{
  "status": true,
  "results": [
    {
      "imdb_id": "tt1375666",
      "tmdb_id": 27205,
      "type": "movie",
      "name": "Inception",
      "sd_id": 123456,
      "first_air_date": null,
      "year": 2010
    }
  ],
  "subtitles": [
    {
      "release_name": "Season Pack",
      "name": "Season.Pack.zip",
      "url": "/subtitle/3197651-3213944.zip",
      "season": 1,
      "episode": 1,
      "episode_from": 1,
      "episode_end": 10,
      "full_season": true,
      "unpack_files": [
        {
          "file_n_id": "file123",
          "name": "Episode.One.srt",
          "release_name": "Episode One",
          "season": 1,
          "episode": 1,
          "language": "EN",
          "hi": false,
          "format": "srt",
          "size": 12345,
          "md5": "example-md5",
          "url": "/subtitle/parent_n_id/file123"
        }
      ]
    }
  ]
}

Notes

    API rate limiting is applied; ensure to manage the number of requests as per your API key's allowance.
    The search is optimized to first look for exact matches in the database and then proceed with broader criteria if necessary.
    The language codes should follow the specific format provided in the API documentation to ensure accurate filtering of subtitles.

This API provides a powerful tool for developers to integrate subtitle search functionality into their applications, offering extensive filtering options to cater to a wide range of user preferences.
CURL Example Request

curl -X GET "https://api.subdl.com/api/v1/subtitles?api_key=example-api-key&film_name=Inception&type=movie&languages=EN&unpack=1"

JavaScript code Example Request

fetch(
  "https://api.subdl.com/api/v1/subtitles?api_key=example-api-key&film_name=Inception&type=movie&languages=ar&unpack=1",
  {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  }
)
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((error) => console.error("Error:", error))