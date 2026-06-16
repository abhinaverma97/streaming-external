export interface Movie {
    id: number;
    title?: string;
    name?: string;
    overview: string;
    poster_path: string;
    backdrop_path: string;
    vote_average: number;
    release_date?: string;
    first_air_date?: string;
    media_type?: string;
    genres?: { id: number; name: string }[];
}

export interface CwPlayContext {
    movieId: number;
    timestamp: number;
    source?: string;
    season?: number;
    episode?: number;
    percent: number;
    isTv: boolean;
}
