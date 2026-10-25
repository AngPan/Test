export function isUnplayedPlayer(player) {
  return player?.ptype === 'U';
}

export function projectedSideTotal(side, placeholderVote = 6) {
  const official = Number(side?.tot) || 0;
  const unplayed = Array.isArray(side?.starts)
    ? side.starts.filter(isUnplayedPlayer).length
    : 0;
  return {
    officialTotal: official,
    unplayed,
    projectedTotal: Number((official + unplayed * placeholderVote).toFixed(2))
  };
}

export function scoreToGoals(score, settings) {
  const step = settings?.step || settings || {};
  const base = Number(step.stlmt ?? 66);
  const offsets = Array.isArray(step.stgoal)
    ? step.stgoal.map(Number)
    : [6, 11, 15, 19, 23, 27, 31, 35, 39, 43];

  if (score < base) return 0;
  let goals = 1;
  for (const offset of offsets) {
    if (score >= base + offset) goals += 1;
    else break;
  }
  return goals;
}
