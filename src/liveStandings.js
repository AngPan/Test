import { config } from './config.js';
import { getCalculationSettings, getCalendarRaw, getStandings, getTeamLineup } from './fantacalcio.js';
import { projectedSideTotal, scoreToGoals } from './scoring.js';

const teamById = new Map(config.teams.map(team => [Number(team.id), team]));
const CREST_BASE = 'https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2026/';

function normalizeMatch(match) {
  if (!match || typeof match !== 'object') return null;

  if (Array.isArray(match.teams) && match.teams.length >= 2) {
    const homeId = Number(match.teams[0]?.id ?? match.teams[0]?.teamId);
    const awayId = Number(match.teams[1]?.id ?? match.teams[1]?.teamId);
    if (homeId && awayId) return [homeId, awayId];
  }

  const home = Number(match.homeId ?? match.home_id ?? match.idHome ?? match.id_casa ?? match.teamHomeId ?? match.squadra_casa);
  const away = Number(match.awayId ?? match.away_id ?? match.idAway ?? match.id_trasferta ?? match.teamAwayId ?? match.squadra_trasferta);
  if (home && away) return [home, away];
  return null;
}

function collectMatchweeks(node, found = []) {
  if (!node || typeof node !== 'object') return found;

  if (Array.isArray(node)) {
    for (const item of node) collectMatchweeks(item, found);
    return found;
  }

  const leagueMatchday = Number(
    node.leagueMatchweek ?? node.leagueMatchday ?? node.giornataLega ?? node.giornata_lega ?? node.matchweek
  );
  const serieAMatchday = Number(
    node.realMatchweek ?? node.realMatchday ?? node.giornataSerieA ?? node.giornata_serie_a ?? node.cmday
  );
  const matchesArray = node.matches ?? node.incontri ?? node.fixtures;

  if (leagueMatchday && Array.isArray(matchesArray)) {
    const matches = matchesArray.map(normalizeMatch).filter(Boolean);
    if (matches.length) found.push({ leagueMatchday, serieAMatchday, matches });
  }

  for (const value of Object.values(node)) collectMatchweeks(value, found);
  return found;
}

async function resolveFixtures(leagueMatchday) {
  try {
    const raw = await getCalendarRaw();
    const weeks = collectMatchweeks(raw);
    const week = weeks.find(item => item.leagueMatchday === leagueMatchday && item.matches.length >= 1);
    if (week) {
      return {
        source: 'api',
        leagueMatchday,
        serieAMatchday: week.serieAMatchday || leagueMatchday + 2,
        matches: week.matches
      };
    }
  } catch {}

  const fallback = config.fallbackFixtures[String(leagueMatchday)];
  if (!fallback) throw new Error(`Nessun calendario disponibile per la giornata ${leagueMatchday}`);
  return {
    source: 'fallback',
    leagueMatchday,
    serieAMatchday: Number(fallback.serieAMatchday),
    matches: fallback.matches.map(pair => pair.map(Number))
  };
}

async function resolveBaseStandings() {
  try {
    const broad = await getStandings(config.maxMatchday);
    if (broad.length) {
      const completed = Math.max(...broad.map(row => Number(row.g) || 0));
      const current = Math.min(completed + 1, config.maxMatchday);
      const exact = completed > 0 ? await getStandings(completed) : broad;
      return { data: exact, completedMatchday: completed, currentMatchday: current, source: 'api' };
    }
  } catch {}

  const completed = Number(config.fallbackStandings.throughMatchday || (config.fallbackLeagueMatchday - 1));
  return {
    data: config.fallbackStandings.data,
    completedMatchday: completed,
    currentMatchday: completed + 1,
    source: 'fallback'
  };
}

function defaultCalculationSettings() {
  return { step: { stlmt: 66, stgoal: [6, 11, 15, 19, 23, 27, 31, 35, 39, 43] } };
}

function decorateBaseRows(rows) {
  return rows.map((row, index) => {
    const team = teamById.get(Number(row.id));
    return {
      id: Number(row.id),
      name: team?.name || `Team ${row.id}`,
      logo: team?.logo ? `${CREST_BASE}${team.logo}` : null,
      baseRank: index + 1,
      g: Number(row.g) || 0,
      points: Number(row.p) || 0,
      fantasyPoints: Number(row.s_p) || 0,
      wins: Number(row.v) || 0,
      draws: Number(row.n) || 0,
      losses: Number(row.pr) || 0,
      gf: Number(row.gf) || 0,
      gs: Number(row.gs) || 0,
      goalDiff: Number(row.d_r) || 0,
      livePoints: 0,
      projectedTotal: 0,
      unplayed: 0
    };
  });
}

function applyMatch(rowsMap, match) {
  const home = rowsMap.get(match.homeId);
  const away = rowsMap.get(match.awayId);
  if (!home || !away) return;

  home.g += 1;
  away.g += 1;
  home.fantasyPoints = Number((home.fantasyPoints + match.homeProjected).toFixed(2));
  away.fantasyPoints = Number((away.fantasyPoints + match.awayProjected).toFixed(2));
  home.projectedTotal = match.homeProjected;
  away.projectedTotal = match.awayProjected;
  home.unplayed = match.homeUnplayed;
  away.unplayed = match.awayUnplayed;

  home.gf += match.homeGoals;
  home.gs += match.awayGoals;
  away.gf += match.awayGoals;
  away.gs += match.homeGoals;
  home.goalDiff = home.gf - home.gs;
  away.goalDiff = away.gf - away.gs;

  if (match.homeGoals > match.awayGoals) {
    home.points += 3; home.livePoints = 3; home.wins += 1; away.losses += 1;
  } else if (match.homeGoals < match.awayGoals) {
    away.points += 3; away.livePoints = 3; away.wins += 1; home.losses += 1;
  } else {
    home.points += 1; away.points += 1; home.livePoints = 1; away.livePoints = 1; home.draws += 1; away.draws += 1;
  }
}

function sortStandings(rows) {
  return [...rows].sort((a,b) =>
    b.points - a.points ||
    b.fantasyPoints - a.fantasyPoints ||
    b.goalDiff - a.goalDiff ||
    b.gf - a.gf ||
    a.baseRank - b.baseRank
  );
}

export async function buildLiveStandings() {
  const base = await resolveBaseStandings();
  const fixtures = await resolveFixtures(base.currentMatchday);

  let settings = defaultCalculationSettings();
  let settingsSource = 'fallback';
  try {
    settings = await getCalculationSettings();
    settingsSource = 'api';
  } catch {}

  const liveMatches = await Promise.all(fixtures.matches.map(async ([homeId, awayId]) => {
    const lineup = await getTeamLineup({
      leagueMatchday: fixtures.leagueMatchday,
      serieAMatchday: fixtures.serieAMatchday,
      homeId,
      awayId
    });
    const homeProjection = projectedSideTotal(lineup.home);
    const awayProjection = projectedSideTotal(lineup.away);
    return {
      homeId, awayId,
      homeOfficial: homeProjection.officialTotal,
      awayOfficial: awayProjection.officialTotal,
      homeProjected: homeProjection.projectedTotal,
      awayProjected: awayProjection.projectedTotal,
      homeUnplayed: homeProjection.unplayed,
      awayUnplayed: awayProjection.unplayed,
      homeGoals: scoreToGoals(homeProjection.projectedTotal, settings),
      awayGoals: scoreToGoals(awayProjection.projectedTotal, settings)
    };
  }));

  const rows = decorateBaseRows(base.data);
  const rowsMap = new Map(rows.map(row => [row.id, row]));
  for (const match of liveMatches) applyMatch(rowsMap, match);

  const ordered = sortStandings([...rowsMap.values()]).map((row,index) => ({
    ...row, rank:index+1, movement:row.baseRank-(index+1)
  }));

  return {
    league:'Scaloni League',
    live:true,
    leagueMatchday:fixtures.leagueMatchday,
    serieAMatchday:fixtures.serieAMatchday,
    updatedAt:new Date().toISOString(),
    rule:'I titolari non ancora scesi in campo valgono 6 provvisorio.',
    sources:{standings:base.source,fixtures:fixtures.source,calculationSettings:settingsSource},
    standings:ordered,
    matches:liveMatches
  };
}
