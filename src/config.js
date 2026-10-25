import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function parseExtraHeaders() {
  try {
    return JSON.parse(process.env.FANTACALCIO_EXTRA_HEADERS_JSON || '{}');
  } catch {
    throw new Error('FANTACALCIO_EXTRA_HEADERS_JSON non è un JSON valido.');
  }
}

export const config = {
  root,
  port: intEnv('PORT', 3000),
  sitePassword: process.env.SITE_PASSWORD || 'scaloni',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-me',
  refreshSeconds: intEnv('REFRESH_SECONDS', 20),
  leagueAlias: process.env.LEAGUE_ALIAS || 'scaloni-league',
  competitionId: intEnv('COMPETITION_ID', 546240),
  maxMatchday: intEnv('MAX_MATCHDAY', 38),
  fallbackLeagueMatchday: intEnv('CURRENT_LEAGUE_MATCHDAY', 6),
  fallbackSerieAMatchday: intEnv('CURRENT_SERIE_A_MATCHDAY', 8),
  appKey: process.env.FANTACALCIO_APP_KEY || '',
  leagueToken: process.env.FANTACALCIO_LEAGUE_TOKEN || '',
  appKeyHeader: process.env.FANTACALCIO_APP_KEY_HEADER || 'App-Key',
  tokenHeader: process.env.FANTACALCIO_TOKEN_HEADER || 'Authorization',
  tokenPrefix: process.env.FANTACALCIO_TOKEN_PREFIX ?? 'Bearer',
  cookie: process.env.FANTACALCIO_COOKIE || '',
  extraHeaders: parseExtraHeaders(),
  teams: readJson('config/teams.json'),
  fallbackFixtures: readJson('config/fixtures.fallback.json'),
  fallbackStandings: readJson('config/standings.fallback.json')
};
