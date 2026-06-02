export interface SourceConfig {
  id: string;
  name: string;
  origins: string[];
  buildMovieUrl: (tmdbId: number | string, startTime?: number) => string;
  buildTvUrl: (tmdbId: number | string, season: number, episode: number, startTime?: number) => string;
  supports: {
    autoPlay: boolean;
    serverSelection: boolean;
    subtitles: boolean;
    colorTheme: boolean;
    startTime: boolean;
    progress: boolean;
  };
}

const M = 808080;
const D = 404040;
const L = "a0a0a0";

export const SOURCES: SourceConfig[] = [
  {
    id: "111movies",
    name: "111Movies",
    origins: ["https://111movies.net"],
    buildMovieUrl: (id) => `https://111movies.net/movie/${id}`,
    buildTvUrl: (id, s, e) => `https://111movies.net/tv/${id}/${s}/${e}`,
    supports: { autoPlay: false, serverSelection: false, subtitles: false, colorTheme: false, startTime: false, progress: false },
  },
  {
    id: "vidking",
    name: "VidKing",
    origins: ["https://www.vidking.net"],
    buildMovieUrl: (id, st) => {
      let u = `https://www.vidking.net/embed/movie/${id}?color=${M}&autoPlay=true`;
      if (st && st > 0) u += `&progress=${Math.floor(st)}`;
      return u;
    },
    buildTvUrl: (id, s, e, st) => {
      let u = `https://www.vidking.net/embed/tv/${id}/${s}/${e}?color=${M}&autoPlay=true&episodeSelector=true`;
      if (st && st > 0) u += `&progress=${Math.floor(st)}`;
      return u;
    },
    supports: { autoPlay: true, serverSelection: false, subtitles: false, colorTheme: true, startTime: true, progress: true },
  },
  {
    id: "vidzee",
    name: "VidZee",
    origins: ["https://player.vidzee.wtf"],
    buildMovieUrl: (id) => `https://player.vidzee.wtf/embed/movie/${id}`,
    buildTvUrl: (id, s, e) => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}`,
    supports: { autoPlay: false, serverSelection: false, subtitles: false, colorTheme: false, startTime: false, progress: true },
  },
  {
    id: "vidlink",
    name: "VidLink",
    origins: ["https://vidlink.pro"],
    buildMovieUrl: (id, st) => {
      let u = `https://vidlink.pro/movie/${id}?primaryColor=${M}&secondaryColor=${D}&iconColor=${L}&autoplay=true&title=false&poster=false`;
      if (st && st > 0) u += `&startAt=${st}`;
      return u;
    },
    buildTvUrl: (id, s, e, st) => {
      let u = `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=${M}&secondaryColor=${D}&iconColor=${L}&autoplay=true&title=false&poster=false`;
      if (st && st > 0) u += `&startAt=${st}`;
      return u;
    },
    supports: { autoPlay: true, serverSelection: false, subtitles: true, colorTheme: true, startTime: true, progress: true },
  },
  {
    id: "vidfast",
    name: "VidFast",
    origins: ["https://vidfast.pro", "https://vidfast.in", "https://vidfast.io", "https://vidfast.me", "https://vidfast.net", "https://vidfast.pm", "https://vidfast.xyz"],
    buildMovieUrl: (id, st) => {
      let u = `https://vidfast.pro/movie/${id}?theme=${M}&autoPlay=true&title=false&poster=false&hideServer=false`;
      if (st && st > 0) u += `&startAt=${Math.floor(st)}`;
      return u;
    },
    buildTvUrl: (id, s, e, st) => {
      let u = `https://vidfast.pro/tv/${id}/${s}/${e}?theme=${M}&autoPlay=true&title=false&poster=false&hideServer=false`;
      if (st && st > 0) u += `&startAt=${Math.floor(st)}`;
      return u;
    },
    supports: { autoPlay: true, serverSelection: true, subtitles: true, colorTheme: true, startTime: true, progress: true },
  },
  {
    id: "cinezo",
    name: "Cinezo",
    origins: ["https://player.cinezo.live"],
    buildMovieUrl: (id) =>
      `https://player.cinezo.live/embed/movie/${id}?primarycolor=${M}&secondarycolor=${D}&iconcolor=${L}&autoplay=true&poster=false&servericon=true&setting=true`,
    buildTvUrl: (id, s, e) =>
      `https://player.cinezo.live/embed/tv/${id}/${s}/${e}?primarycolor=${M}&secondarycolor=${D}&iconcolor=${L}&autoplay=true&poster=false&servericon=true&setting=true`,
    supports: { autoPlay: true, serverSelection: true, subtitles: false, colorTheme: true, startTime: false, progress: true },
  },
  {
    id: "vidrock",
    name: "VidRock",
    origins: ["https://vidrock.ru"],
    buildMovieUrl: (id) =>
      `https://vidrock.ru/movie/${id}?autoplay=true&theme=${M}&download=false&nextbutton=false&episodeselector=false`,
    buildTvUrl: (id, s, e) =>
      `https://vidrock.ru/tv/${id}/${s}/${e}?autoplay=true&theme=${M}&download=false&nextbutton=false&episodeselector=false`,
    supports: { autoPlay: true, serverSelection: false, subtitles: true, colorTheme: true, startTime: false, progress: true },
  },
  {
    id: "vidnest",
    name: "VidNest",
    origins: ["https://vidnest.fun"],
    buildMovieUrl: (id, st) => {
      let u = `https://vidnest.fun/movie/${id}?servericon=false`;
      if (st && st > 0) u += `&startAt=${Math.floor(st)}`;
      return u;
    },
    buildTvUrl: (id, s, e, st) => {
      let u = `https://vidnest.fun/tv/${id}/${s}/${e}?servericon=false`;
      if (st && st > 0) u += `&startAt=${Math.floor(st)}`;
      return u;
    },
    supports: { autoPlay: false, serverSelection: true, subtitles: false, colorTheme: false, startTime: true, progress: true },
  },
  {
    id: "vidsrcwtf",
    name: "VidSrc.wtf",
    origins: ["https://vidsrc.wtf", "https://www.vidsrc.wtf"],
    buildMovieUrl: (id) => `https://vidsrc.wtf/1/movie/${id}?color=${M}`,
    buildTvUrl: (id, s, e) => `https://vidsrc.wtf/1/tv/${id}/${s}/${e}?color=${M}`,
    supports: { autoPlay: false, serverSelection: false, subtitles: false, colorTheme: true, startTime: false, progress: true },
  },
  {
    id: "primesrc",
    name: "PrimeSrc",
    origins: ["https://primesrc.me"],
    buildMovieUrl: (id, st) => {
      let u = `https://primesrc.me/embed/movie?tmdb=${id}`;
      if (st && st > 0) u += `&startAt=${st}`;
      return u;
    },
    buildTvUrl: (id, s, e, st) => {
      let u = `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`;
      if (st && st > 0) u += `&startAt=${st}`;
      return u;
    },
    supports: { autoPlay: false, serverSelection: false, subtitles: false, colorTheme: false, startTime: true, progress: false },
  },
];

export function getSource(id: string): SourceConfig {
  return SOURCES.find((x) => x.id === id) || SOURCES[0];
}

export function buildEmbedUrl(
  sourceId: string,
  tmdbId: number | string,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number,
  startTime?: number
): string {
  const source = getSource(sourceId);
  if (mediaType === "tv" && season !== undefined && episode !== undefined) {
    return source.buildTvUrl(tmdbId, season, episode, startTime);
  }
  return source.buildMovieUrl(tmdbId, startTime);
}
