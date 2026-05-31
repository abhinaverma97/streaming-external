1. Core Movie Metadata

These fields cover the basic identification and classifications of the film.

    id (496243): The unique database identifier for this specific movie within TMDb's system.

    imdb_id ("tt6751668"): The unique identifier for this movie on IMDb, useful for cross-referencing between platforms.

    title ("Parasite"): The official commercial title used for English-speaking audiences.

    original_title ("기생충"): The title of the movie in its original language (Korean script).

    original_language ("ko"): The ISO 639-1 code for the language the movie was filmed in (Korean).

    status ("Released"): The current production status of the film (e.g., Rumored, Planned, In Production, Post Production, Released).

    tagline ("Act like you own the place."): The short, catchy marketing phrase used on posters and promotional material.

    overview: A short summary/synopsis of the movie's plot.

    genres: An array of categories the movie fits into. Each genre contains an id and a name (here: Comedy, Thriller, and Drama).

    adult (false): A boolean flag indicating whether the film is classified as adult/X-rated content.

    softcore (false): A boolean flag indicating if the film contains softcore adult content.

    video (false): A boolean indicating if this entry is a straight-to-video release or a special video feature rather than a theatrical film.

2. Release & Runtime Data

    release_date ("2019-05-30"): The primary theatrical release date of the film formatted as YYYY-MM-DD.

    runtime (133): The total length of the movie in minutes (133 minutes = 2 hours and 13 minutes).

3. Financials

    budget (11363000): The production budget of the movie in USD ($11,363,000).

    revenue (257591776): The total global box office earnings of the movie in USD ($257,591,776).

4. Media & Asset Paths

TMDb doesn't host raw images directly in this payload; instead, it gives you file paths to append to their base image URL (e.g., https://image.tmdb.org/t/p/w500/).

    poster_path ("/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg"): The file path for the official vertical movie poster.

    backdrop_path ("/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg"): The file path for the horizontal background image (often used as wallpapers or banners).

    homepage ("https://www.parasite-movie.com/"): The official promotional website for the film.

5. Popularity & Community Scores

    popularity (36.6607): A dynamic, internal TMDb metric score calculated daily based on user views, searches, and watchlist adds.

    vote_average (8.494): The average user rating out of 10.

    vote_count (20638): The total number of TMDb users who have rated the movie.

6. Regional & Cultural Data

    origin_country (["KR"]): An array of ISO 3166-1 country codes where the film originated (KR = South Korea).

    production_countries: A detailed list of countries involved in production (ISO code and full English name).

    spoken_languages: An array of languages spoken in the film. Interestingly, for Parasite, it lists English, German, and Korean, mapping their ISO codes, native names, and English names.

7. Business & Collections

    belongs_to_collection (null): If this movie were part of a franchise (like Star Wars or The Avengers), this object would contain details about the movie series. It is null here because Parasite is a standalone film.

    production_companies: An array of companies that financed/produced the film. Each contains its own TMDb id, a logo_path for their corporate icon, name, and their origin_country.

8. Credits (Cast & Crew)

This is a massive sub-object containing lists of the people involved.
cast (The Actors)

For every actor listed, TMDb provides:

    Personal Data: id, name, original_name, gender (e.g., 1 for female, 2 for male), profile_path (their headshot image), and their generic individual popularity score.

    known_for_department ("Acting"): The primary industry branch they are known for.

    character ("Kim Ki-taek"): The specific role they played in this movie.

    cast_id & credit_id: Internal database tracking IDs for that specific acting job.

    order (0, 1, 2...): The billing order. order: 0 is the main lead, order: 1 is second billed, and so on.

crew (The Behind-the-Scenes Team)

For production staff, TMDb provides similar personal data as the cast, but switches character roles for industry roles:

    department: The broad technical division (e.g., Art, Editing, Camera, Sound, Costume & Make-Up).

    job: The highly specific role they performed on this film (e.g., Set Decoration, Digital Intermediate Producer, Director of Photography, Original Music Composer).