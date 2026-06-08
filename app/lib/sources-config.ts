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

const M = "ffffff";
const D = "ffffff";
const L = "ffffff";

export const SOURCES: SourceConfig[] = [
  {
    id: "videasy",
    name: "VIDEASY",
    origins: ["https://player.videasy.net", "https://player.videasy.to"],
    buildMovieUrl: (id, st) => {
      let u = `https://player.videasy.net/movie/${id}?color=${M}`;
      if (st && st > 0) u += `&progress=${Math.floor(st)}`;
      return u;
    },
    buildTvUrl: (id, s, e, st) => {
      let u = `https://player.videasy.net/tv/${id}/${s}/${e}?color=${M}`;
      if (st && st > 0) u += `&progress=${Math.floor(st)}`;
      return u;
    },
    supports: { autoPlay: true, serverSelection: false, subtitles: false, colorTheme: true, startTime: true, progress: true },
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
      if (st && st > 0) u += `&progress=${Math.floor(st)}`;
      return u;
    },
    supports: { autoPlay: false, serverSelection: true, subtitles: false, colorTheme: false, startTime: true, progress: true },
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
];

export const KNOWN_ORIGINS = SOURCES.flatMap((s) => s.origins);

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
