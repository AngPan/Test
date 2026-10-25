import { config } from './config.js';

const API_BASE = 'https://apileague.fantacalcio.it';
const LEGACY_BASE = 'https://leghe.fantacalcio.it';

function authHeaders({ legacy = false } = {}) {
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'ScaloniLive/1.0',
    ...config.extraHeaders
  };

  if (config.appKey) headers[config.appKeyHeader] = config.appKey;
  if (config.leagueToken) {
    const rawToken = String(config.leagueToken).trim();
    const alreadyPrefixed = /^Bearer\s+/i.test(rawToken);
    const tokenValue = alreadyPrefixed
      ? rawToken
      : (config.tokenPrefix ? `${config.tokenPrefix} ${rawToken}`.trim() : rawToken);
    headers[config.tokenHeader] = tokenValue;
  }

  if (config.accessToken) headers['Access-Token'] = String(config.accessToken).trim();
  if (config.platform) headers['Platform'] = String(config.platform).trim();

  if (legacy) {
    headers.Referer = `https://leghe.fantacalcio.it/${config.leagueAlias}/view/competition/${config.competitionId}/dashboard`;
    headers['X-Requested-With'] = 'XMLHttpRequest';
    if (config.cookie) headers.Cookie = config.cookie;
  }

  return headers;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    method: 'GET',
    headers: authHeaders(options),
    signal: AbortSignal.timeout(12_000)
  });

  const text = await response.text();
  if (!response.ok) {
    const diag = {
      server: response.headers.get('server'),
      via: response.headers.get('via'),
      xCache: response.headers.get('x-cache'),
      contentType: response.headers.get('content-type'),
      cfRay: response.headers.get('cf-ray')
    };
    console.error('UPSTREAM_DIAG', JSON.stringify(diag));
    throw new Error(`${response.status} ${response.statusText} da ${url}: ${text.slice(0, 250)}`);
  }
  return text;
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Risposta non JSON da ${url}: ${text.slice(0, 180)}`);
  }
}

export async function getRoundLineups({ leagueMatchday, serieAMatchday }) {
  const url = `${API_BASE}/gaming/v1/teamLineup/${config.competitionId}/${leagueMatchday}/${serieAMatchday}`;
  return fetchJson(url);
}

export async function getCalculationSettings() {
  return fetchJson(`${API_BASE}/onboarding/v1/league/settings/calculate`);
}

export async function getTeamLineup({ leagueMatchday, serieAMatchday, homeId, awayId }) {
  const base = `${API_BASE}/gaming/v1/teamLineup/${config.competitionId}/${leagueMatchday}/${serieAMatchday}/${homeId}/${awayId}`;
  const candidates = [base, `${base}/1`];

  let lastError;
  for (const url of candidates) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Team lineup non disponibile');
}

export async function getStandings(throughMatchday) {
  const params = new URLSearchParams({
    alias_lega: config.leagueAlias,
    id_competizione: String(config.competitionId),
    giornata_inizio: '1',
    giornata_fine: String(throughMatchday)
  });
  const url = `${LEGACY_BASE}/servizi/v1_legheCompetizione/classificagiornate?${params}`;
  const payload = await fetchJson(url, { legacy: true });
  if (!payload?.success || !Array.isArray(payload.data)) {
    throw new Error(payload?.error_msgs?.[0]?.descrizione || 'Classifica non disponibile');
  }
  return payload.data;
}

export async function getCalendarRaw() {
  const candidates = [
    `${LEGACY_BASE}/servizi/v1_legheCompetizione/calendario?id=${config.competitionId}`,
    `${LEGACY_BASE}/servizi/v1_legheCompetizione/calendario?id_competizione=${config.competitionId}`
  ];

  let lastError;
  for (const url of candidates) {
    try {
      return await fetchJson(url, { legacy: true });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Calendario non disponibile');
}
