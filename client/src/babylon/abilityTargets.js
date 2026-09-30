export function laneTargetEnabled(viewModel, laneIndex, side) {
  const targets = viewModel?.interactions?.legalLaneTargets;
  if (!targets) return (viewModel?.interactions?.legalLanes || []).includes(laneIndex);
  const owner = side === 'local' ? viewModel.perspective.bottomPlayer : viewModel.perspective.topPlayer;
  return targets.some(target => target.laneIndex === laneIndex && target.owner === owner);
}
export function laneTargetSelected(viewModel, laneIndex, side) {
  const mode = viewModel?.selection?.abilityMode;
  return !!mode && (mode.targetOwner || 'local') === side && mode.laneIndexes?.includes(laneIndex);
}
