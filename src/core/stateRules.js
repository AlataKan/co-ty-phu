import { STATION_RENTS_6P, MEGA_52_CONSTANTS, getAllianceForPlayer } from '../data/boardData52.js';

export function getTeammateId(state, playerId) {
  if (!state?.allianceMode || !playerId) return null;
  const team = getAllianceForPlayer(playerId);
  if (!team) return null;
  const partnerId = team.members.find(id => id !== playerId) || null;
  if (!partnerId) return null;
  const exists = state.players?.some(p => p.id === partnerId && !p.isBankrupt);
  return exists ? partnerId : null;
}

export function areTeammates(state, p1Id, p2Id) {
  if (!state?.allianceMode || !p1Id || !p2Id || p1Id === p2Id) return false;
  const t1 = getAllianceForPlayer(p1Id);
  return Boolean(t1 && t1.members.includes(p2Id));
}

function isOwnedByPlayerOrAlly(state, tileOwnerId, playerId) {
  if (!tileOwnerId || !playerId) return false;
  return tileOwnerId === playerId || areTeammates(state, tileOwnerId, playerId);
}

export function ownsFullGroupUnmortgaged(state, playerId, group) {
  if (!group || group === 'NONE') return false;
  const groupTiles = state.board.filter(t => t.group === group);
  return groupTiles.length > 0 && groupTiles.every(
    t => isOwnedByPlayerOrAlly(state, t.ownerId, playerId) && !t.isMortgaged
  );
}

// Liên doanh Đô thị (Bản 52 ô): Sở hữu 2/3 ô chưa thế chấp trong nhóm 3 ô -> Mở khóa xây tối đa 2 Nhà phố
export function hasJointVenture2Of3(state, playerId, group) {
  if (state?.boardPreset !== 'MEGA_52' || !group || group === 'NONE') return false;
  const groupTiles = state.board.filter(t => t.group === group && t.type === 'PROPERTY');
  if (groupTiles.length !== 3) return false;
  const ownedUnmortgaged = groupTiles.filter(
    t => isOwnedByPlayerOrAlly(state, t.ownerId, playerId) && !t.isMortgaged
  );
  return ownedUnmortgaged.length === 2;
}

export function getMaxAllowedBuildLevel(state, playerId, group) {
  if (ownsFullGroupUnmortgaged(state, playerId, group)) {
    return state?.boardPreset === 'MEGA_52' ? 6 : 5;
  }
  if (hasJointVenture2Of3(state, playerId, group)) {
    return 2;
  }
  return 0;
}

export function getStationRentByCount(count) {
  if (count <= 0) return 0;
  return STATION_RENTS_6P[Math.min(STATION_RENTS_6P.length - 1, count - 1)] || 25;
}

export function getUtilityMultiplierByCount(count) {
  if (count >= 3) return 20;
  if (count === 2) return 10;
  return 4;
}

export function getTileRentInfo(state, tile, viewerPlayerId = null) {
  if (!tile || !tile.ownerId) {
    return null;
  }

  if (tile.isMortgaged) {
    return {
      isMortgaged: true,
      amount: 0,
      pillText: '🔒 CẦM',
      inspectorText: '🔒 Thế chấp (0K)'
    };
  }

  if (viewerPlayerId && areTeammates(state, tile.ownerId, viewerPlayerId)) {
    return {
      isMortgaged: false,
      isAllyFree: true,
      amount: 0,
      pillText: '🤝 0K',
      inspectorText: '🤝 Đồng đội (Miễn thuê)'
    };
  }

  if (tile.type === 'PROPERTY') {
    const isMonopoly = ownsFullGroupUnmortgaged(state, tile.ownerId, tile.group);
    const isJointVenture = !isMonopoly && hasJointVenture2Of3(state, tile.ownerId, tile.group);
    let amount = tile.rent[tile.level] ?? tile.rent[tile.rent.length - 1];
    if (tile.level === 0 && isMonopoly) {
      amount = tile.rent[0] * 2;
    }
    return {
      isMortgaged: false,
      isMonopoly,
      isJointVenture,
      amount,
      pillText: `⚡${amount}K`,
      inspectorText: `⚡${amount}K`
    };
  }

  if (tile.type === 'STATION') {
    const count = state.board.filter(
      t => t.type === 'STATION' && isOwnedByPlayerOrAlly(state, t.ownerId, tile.ownerId) && !t.isMortgaged
    ).length;
    const amount = getStationRentByCount(count);
    return {
      isMortgaged: false,
      count,
      amount,
      pillText: `⚡${amount}K`,
      inspectorText: `⚡${amount}K (${count} trạm)`
    };
  }

  if (tile.type === 'UTILITY') {
    const count = state.board.filter(
      t => t.type === 'UTILITY' && isOwnedByPlayerOrAlly(state, t.ownerId, tile.ownerId) && !t.isMortgaged
    ).length;
    const multiplier = getUtilityMultiplierByCount(count);
    const speedNum = typeof state.speedDie === 'number' ? state.speedDie : 0;
    const diceSum = (state.dice?.[0] || 1) + (state.dice?.[1] || 1) + speedNum;
    return {
      isMortgaged: false,
      count,
      multiplier,
      amount: multiplier * diceSum,
      pillText: `⚡${multiplier}x🎲`,
      inspectorText: `⚡${multiplier}x xúc xắc`
    };
  }

  return null;
}

export function canBuildHouseState(state, playerId, tileIndex) {
  const tile = state.board[tileIndex];
  const player = state.players.find(p => p.id === playerId);
  if (!tile || !player || tile.type !== 'PROPERTY' || tile.ownerId !== playerId || tile.isMortgaged) return false;

  const maxLevel = getMaxAllowedBuildLevel(state, playerId, tile.group);
  if (maxLevel <= 0 || tile.level >= maxLevel || player.cash < tile.buildCost) return false;

  // Quy tắc xây đồng đều trên các ô chưa thế chấp thuộc sở hữu của người chơi trong nhóm đó
  const myGroupTiles = state.board.filter(
    t => t.group === tile.group && t.ownerId === playerId && !t.isMortgaged
  );
  return myGroupTiles.every(t => t.level >= tile.level);
}

export function canSellHouseState(state, playerId, tileIndex) {
  const tile = state.board[tileIndex];
  if (!tile || tile.type !== 'PROPERTY' || tile.ownerId !== playerId || tile.level <= 0) return false;

  const myGroupTiles = state.board.filter(t => t.group === tile.group && t.ownerId === playerId);
  const maxLevel = Math.max(...myGroupTiles.map(t => t.level));
  return tile.level === maxLevel;
}

export function canMortgageTileState(state, playerId, tileIndex) {
  const tile = state.board[tileIndex];
  if (!tile || tile.ownerId !== playerId || tile.isMortgaged || !tile.mortgageValue) return false;
  if (tile.type === 'PROPERTY') {
    const myGroupTiles = state.board.filter(t => t.group === tile.group && t.ownerId === playerId);
    if (myGroupTiles.some(t => t.level > 0)) return false;
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
    const myGroupTiles = state.board.filter(t => t.group === tile.group && t.ownerId === ownerId);
    if (myGroupTiles.some(t => t.level > 0)) return false;
  }
  return true;
}

// Kiểm tra Đặc quyền Dịch chuyển Nhanh (Transit Teleport) ở đầu lượt ROLL_DICE của bản 52 ô
export function getTransitTeleportInfo(state, playerId) {
  if (!state || state.boardPreset !== 'MEGA_52' || state.phase !== 'ROLL_DICE') return null;
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.inJail || player.isBankrupt) return null;

  const currentTile = state.board[player.position];
  if (!currentTile || currentTile.type !== 'STATION' || !currentTile.ownerId || currentTile.isMortgaged) {
    return null;
  }

  const isFree = currentTile.ownerId === playerId || areTeammates(state, currentTile.ownerId, playerId);
  const fee = isFree ? 0 : MEGA_52_CONSTANTS.TRANSIT_TICKET_FEE;
  if (player.cash < fee) return null;

  const destinations = state.board.filter(t => t.type === 'STATION' && t.index !== currentTile.index);
  if (destinations.length === 0) return null;

  return {
    fromIndex: currentTile.index,
    fee,
    ticketReceiverId: isFree ? null : currentTile.ownerId,
    destinations
  };
}

// Kiểm tra khả năng Cứu trợ Phá sản (Bailout 2v2v2)
export function getAllyBailoutInfo(state, debtorId) {
  if (!state?.allianceMode || state.phase !== 'BANKRUPTCY_CHECK') return null;
  const debtor = state.players.find(p => p.id === debtorId);
  if (!debtor || debtor.cash >= 0) return null;

  const allyId = getTeammateId(state, debtorId);
  const ally = allyId ? state.players.find(p => p.id === allyId) : null;
  if (!ally || ally.isBankrupt || ally.usedBailout) return null;

  const needed = Math.abs(debtor.cash);
  if (ally.cash < needed) return null;

  return {
    allyId: ally.id,
    allyName: ally.name,
    debtorId: debtor.id,
    amount: needed
  };
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
