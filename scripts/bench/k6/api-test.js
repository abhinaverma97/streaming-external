import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '10s', target: 3 },
    { duration: '15s', target: 5 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.10'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const UID = `${__VU}_${__ITER}`;
  group('reads (in-memory store)', function () {
    const eps = [
      '/api/watchlist',
      '/api/continue-watching',
      '/api/history',
      '/api/ratings',
      '/api/source-prefs',
      '/api/ai-settings',
    ];
    for (const ep of eps) {
      const r = http.get(`${BASE}${ep}`);
      check(r, { [`GET ${ep} 200`]: (res) => res.status === 200 });
      errorRate.add(r.status !== 200);
      sleep(0.05);
    }
  });

  group('tmdb proxy (cached)', function () {
    const eps = [
      '/api/movies/trending',
      '/api/tv/trending',
      '/api/movie/27205',
      '/api/tv/1396',
    ];
    for (const ep of eps) {
      const r = http.get(`${BASE}${ep}`);
      check(r, { [`GET ${ep} 200`]: (res) => res.status === 200 });
      errorRate.add(r.status !== 200);
      sleep(0.05);
    }
  });

  group('writes + cleanup', function () {
    const id = `k6_${UID}`;
    const headers = { 'Content-Type': 'application/json' };
    const details = { id: 99999, title: `K6 Test ${UID}` };

    let r = http.post(`${BASE}/api/watchlist`, JSON.stringify({ tmdbId: id, mediaType: 'movie', movieDetails: details }), { headers });
    check(r, { 'watchlist add 200': (res) => res.status === 200 });
    errorRate.add(r.status !== 200);
    sleep(0.1);

    r = http.post(`${BASE}/api/ratings/${id}`, JSON.stringify({ rating: (__ITER % 5) + 1, movieDetails: details, thoughts: 'bench' }), { headers });
    check(r, { 'rating save 200': (res) => res.status === 200 });
    errorRate.add(r.status !== 200);
    sleep(0.1);

    r = http.post(`${BASE}/api/progress`, JSON.stringify({ tmdbId: id, timestamp: 300, duration: 3600, movieDetails: details, mediaType: 'movie', source: 'videasy' }), { headers });
    check(r, { 'progress save 200': (res) => res.status === 200 });
    errorRate.add(r.status !== 200);
    sleep(0.1);

    r = http.get(`${BASE}/api/watchlist`);
    check(r, { 'watchlist verify 200': (res) => res.status === 200 });
    errorRate.add(r.status !== 200);
    sleep(0.05);

    http.del(`${BASE}/api/watchlist/${id}`, null, { headers });
    http.del(`${BASE}/api/ratings/${id}`, null, { headers });
  });

  group('recommend endpoint', function () {
    const r = http.get(`${BASE}/api/recommend`);
    check(r, { 'recommend 200': (res) => res.status === 200 });
    errorRate.add(r.status !== 200);
  });

  sleep(0.5);
}
