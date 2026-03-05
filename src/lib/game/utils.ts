export function getForwardDir(team: 'home' | 'away', sidesSwitched: boolean): number {
  const baseDir = team === 'home' ? 1 : -1;
  return sidesSwitched ? baseDir * -1 : baseDir;
}

export function getOpponentGoalX(team: 'home' | 'away', sidesSwitched: boolean): number {
  return getForwardDir(team, sidesSwitched) === 1 ? 1.0 : 0.0;
}

export function getMyGoalX(team: 'home' | 'away', sidesSwitched: boolean): number {
  return getForwardDir(team, sidesSwitched) === 1 ? 0.0 : 1.0;
}

