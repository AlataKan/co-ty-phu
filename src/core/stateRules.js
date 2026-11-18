export function ownsFullGroupUnmortgaged(state, playerId, group) {
  if (!group || group === 'NONE') return false;
  const groupTiles = state.board.filter(t => t.group === group);
  return groupTiles.length > 0 && groupTiles.every(t => t.ownerId === playerId && !t.isMortgaged);
}

export function canBuildHouseState(state, playerId, tileIndex) {
  const tile = state.board[tileIndex];
  const player = state.players.find(p => p.id === playerId);
  if (!tile || !player || tile.type !== 'PROPERTY' || tile.ownerId !== playerId) return false;
  if (tile.level >= 5 || player.cash < tile.buildCost) return false;
  if (!ownsFullGroupUnmortgaged(state, playerId, tile.group)) return false;

  const groupTiles = state.board.filter(t => t.group === tile.group);
  return groupTiles.every(t => t.level >= tile.level);
}

export function canSellHouseState(state, playerId, tileIndex) {
  const tile = state.board[tileIndex];
  if (!tile || tile.type !== 'PROPERTY' || tile.ownerId !== playerId || tile.level <= 0) return false;

  const groupTiles = state.board.filter(t => t.group === tile.group);
  const maxLevel = Math.max(...groupTiles.map(t => t.level));
  return tile.level === maxLevel;
}

export function canMortgageTileState(state, playerId, tileIndex) {
  const tile = state.board[tileIndex];
  if (!tile || tile.ownerId !== playerId || tile.isMortgaged || !tile.mortgageValue) return false;
  if (tile.type === 'PROPERTY') {
    const groupTiles = state.board.filter(t => t.group === tile.group);
    if (groupTiles.some(t => t.level > 0)) return false;
  }
  return true;
}

export function canUnmortgageTileState(state, playerId, tileIndex) {
  const tile = state.board[tileIndex];
  const player = state.players.find(p => p.id === playerId);
  if (!tile || !player || tile.ownerId !== playerId || !tile.isMortgaged) return false;
  const cost = Math.ceil(tile.mortgageValue * 1.1);
  return player.cash >= cost;
}

export function isTileTradableState(state, ownerId, tileIndex) {
  const tile = state.board[tileIndex];
  if (!tile || tile.ownerId !== ownerId) return false;
  if (tile.type === 'PROPERTY') {
    const groupTiles = state.board.filter(t => t.group === tile.group);
    if (groupTiles.some(t => t.level > 0)) return false;
  }
  return true;
}

export function calculateNetWorthState(state, playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.isBankrupt) return 0;
  let total = player.cash;
  for (const tile of state.board) {
    if (tile.ownerId === playerId) {
      total += tile.isMortgaged ? Math.floor((tile.price || 0) * 0.5) : (tile.price || 0);
      if (tile.level > 0 && tile.buildCost) {
        total += tile.level * tile.buildCost;
      }
    }
  }
  return total;
}
