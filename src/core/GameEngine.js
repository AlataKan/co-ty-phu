import { createFreshBoard, PLAYER_PRESETS, GAME_CONSTANTS } from '../data/boardData.js';
import { MEGA_52_CONSTANTS, ALLIANCE_TEAMS, getAllianceForPlayer } from '../data/boardData52.js';
import { CHANCE_CARDS, COMMUNITY_CARDS, shuffleDeck } from '../data/cardDecks.js';
import {
  areTeammates,
  ownsFullGroupUnmortgaged,
  canBuildHouseState,
  canSellHouseState,
  canMortgageTileState,
  isTileTradableState,
  getStationRentByCount,
  getUtilityMultiplierByCount,
  getTransitTeleportInfo,
  getAllyBailoutInfo,
  calculateNetWorthState
} from './stateRules.js';

const SPEED_DIE_FACES = [1, 2, 3, 'BUS', 'BUS', 'MR_MONOPOLY'];

export class GameEngine {
  constructor(roomId = 'LOCAL', mode = 'CLASSIC', options = {}) {
    this.chanceDeck = shuffleDeck(CHANCE_CARDS);
    this.communityDeck = shuffleDeck(COMMUNITY_CARDS);
    this.auctionTimer = null;
    this.onBroadcast = null;

    const boardPreset = options.boardPreset === 'MEGA_52' ? 'MEGA_52' : 'STANDARD_40';
    const allianceMode = boardPreset === 'MEGA_52' ? Boolean(options.allianceMode) : false;

    this.state = {
      roomId,
      mode, // 'CLASSIC' | 'SPEED'
      boardPreset, // 'STANDARD_40' | 'MEGA_52'
      allianceMode, // true = Liên Minh 2v2v2
      startedAt: null,
      roundCount: 1,
      phase: 'LOBBY', // LOBBY | JAIL_DECISION | ROLL_DICE | TILE_RESOLUTION | BUS_DECISION | AUCTION_PHASE | MANAGEMENT_PHASE | BANKRUPTCY_CHECK | GAME_OVER
      players: [],
      activePlayerIndex: 0,
      board: createFreshBoard(boardPreset),
      dice: [1, 1],
      speedDie: null, // null | 1 | 2 | 3 | 'BUS' | 'MR_MONOPOLY'
      pendingSpeedAction: null,
      busTargets: null, // { cardIndex, stationIndex }
      doubleCount: 0,
      escapedJailByDouble: false,
      festivalFund: 0,
      pendingDebtCreditor: null,
      auctionQueue: [],
      auction: null,
      pendingTrade: null,
      pendingMortgageTransfers: [],
      winnerId: null,
      winningAlliance: null,
      logs: ['Phòng chờ đã sẵn sàng.']
    };
  }

  getBoardSize() {
    return this.state.board.length;
  }

  getJailIndex() {
    return this.state.boardPreset === 'MEGA_52' ? MEGA_52_CONSTANTS.JAIL_INDEX : 10;
  }

  getInitialBalance() {
    return this.state.boardPreset === 'MEGA_52'
      ? MEGA_52_CONSTANTS.INITIAL_BALANCE
      : GAME_CONSTANTS.INITIAL_BALANCE;
  }

  // Cấu hình bàn cờ 40 ô / 52 ô & chế độ Liên minh 2v2v2 ngay tại Phòng chờ
  setLobbyConfig({ boardPreset, allianceMode, mode } = {}) {
    if (this.state.phase !== 'LOBBY') return;

    if (mode === 'CLASSIC' || mode === 'SPEED') {
      this.state.mode = mode;
    }

    if (boardPreset && (boardPreset === 'STANDARD_40' || boardPreset === 'MEGA_52')) {
      if (boardPreset === 'STANDARD_40' && this.state.players.length > 4) {
        // Chỉ cắt bớt nếu ghế 5-6 là AI Bot; nếu là người thật thì giữ nguyên bản 52 ô
        const extraPlayers = this.state.players.slice(4);
        if (extraPlayers.every(p => p.isAI)) {
          this.state.players = this.state.players.slice(0, 4);
        } else {
          this.log('⚠️ Đang có trên 4 người chơi thật nên giữ nguyên bàn cờ Mở Rộng 52 Ô.');
          boardPreset = 'MEGA_52';
        }
      }

      if (this.state.boardPreset !== boardPreset) {
        this.state.boardPreset = boardPreset;
        this.state.board = createFreshBoard(boardPreset);
        const startCash = this.getInitialBalance();
        this.state.players.forEach(p => {
          p.cash = startCash;
          p.position = 0;
        });
        this.log(
          boardPreset === 'MEGA_52'
            ? '🔥 Đã chuyển sang Bàn cờ Đại Chiến Lục Hùng 52 Ô (Tối đa 6 người • Vốn 2500K)!'
            : '🗺️ Đã chuyển về Bàn cờ Tiêu Chuẩn 40 Ô (Tối đa 4 người • Vốn 2000K).'
        );
      }
    }

    if (allianceMode !== undefined) {
      this.state.allianceMode = this.state.boardPreset === 'MEGA_52' ? Boolean(allianceMode) : false;
    }
  }

  // Thêm người chơi vào phòng chờ (tối đa 6 người)
  addPlayer(id, name, isAI = false) {
    if (this.state.phase !== 'LOBBY' || this.state.players.length >= 6) return false;
    const existing = this.state.players.find(p => p.id === id);
    if (existing) {
      existing.name = name || existing.name;
      return true;
    }

    // Tự động nâng cấp lên bàn cờ 52 ô nếu thêm người chơi thứ 5 hoặc thứ 6
    if (this.state.players.length >= 4 && this.state.boardPreset !== 'MEGA_52') {
      this.setLobbyConfig({ boardPreset: 'MEGA_52' });
    }

    const preset = PLAYER_PRESETS[this.state.players.length];
    this.state.players.push({
      id: id || preset.id,
      short: preset.short || id || preset.id,
      name: name || preset.defaultName,
      color: preset.color,
      icon: preset.icon || '⭐',
      avatar: preset.avatar,
      cash: this.getInitialBalance(),
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      usedBailout: false,
      isBankrupt: false,
      isAI
    });
    this.log(`👋 ${name || preset.defaultName} (${preset.icon}) đã tham gia phòng.`);
    return true;
  }

  startGame(mode = this.state.mode, extraConfig = {}) {
    if (extraConfig.boardPreset !== undefined || extraConfig.allianceMode !== undefined) {
      this.setLobbyConfig(extraConfig);
    }
    if (this.state.players.length < 2) return { events: [], state: this.getSnapshot() };

    // Liên minh 2v2v2 tối ưu khi có từ 4-6 người; nếu chỉ có 2 người thì tắt để tránh 2 người cùng đội hoặc lệch
    if (this.state.allianceMode && this.state.players.length < 4) {
      this.state.allianceMode = false;
    }

    this.state.mode = mode || this.state.mode;
    this.state.startedAt = Date.now();
    this.state.roundCount = 1;
    this.state.activePlayerIndex = 0;
    this.state.doubleCount = 0;
    this.state.speedDie = null;
    this.state.pendingSpeedAction = null;
    this.state.busTargets = null;

    const mapLabel = this.state.boardPreset === 'MEGA_52' ? 'Đại Chiến 52 Ô' : 'Tiêu Chuẩn 40 Ô';
    const teamLabel = this.state.allianceMode ? ' • Liên Minh 2v2v2' : '';
    this.log(`🎲 Ván đấu bắt đầu! [${mapLabel}${teamLabel} • ${this.state.mode === 'SPEED' ? '45 Phút' : 'Đến người cuối'}].`);
    this.enterTurnStart();
    return { events: [], state: this.getSnapshot() };
  }

  // Điểm vào duy nhất cho mọi thao tác từ Host & Client
  handleAction(playerId, action, payload = {}) {
    const events = [];

    if (action === 'JOIN_GAME') {
      this.addPlayer(playerId, payload.name, payload.isAI);
      return this.emit(events);
    }

    if (action === 'REMOVE_PLAYER' && playerId === 'P1' && this.state.phase === 'LOBBY') {
      this.removeLobbyPlayer(payload.targetId);
      return this.emit(events);
    }

    if (action === 'LEAVE_ROOM') {
      this.handleLeaveRoom(playerId, events);
      return this.emit(events);
    }

    if (action === 'SET_LOBBY_CONFIG' && playerId === 'P1') {
      this.setLobbyConfig(payload);
      return this.emit(events);
    }

    if (action === 'START_GAME' && playerId === 'P1') {
      this.startGame(payload.mode || this.state.mode, payload);
      return this.emit(events);
    }

    if (this.state.phase === 'GAME_OVER') return this.emit(events);

    // Các hành động toàn cục (Đấu giá, Phản hồi Giao dịch, Giải chấp chuyển nhượng, Cứu trợ Liên minh)
    if (this.state.phase === 'AUCTION_PHASE') {
      if (action === 'PLACE_BID') this.handlePlaceBid(playerId, payload.amount, events);
      if (action === 'FOLD_AUCTION') this.handleFoldAuction(playerId, events);
      return this.emit(events);
    }

    if (action === 'RESPOND_TRADE' && this.state.pendingTrade?.toPlayerId === playerId) {
      this.handleRespondTrade(playerId, payload.accept, events);
      return this.emit(events);
    }

    if (action === 'RESOLVE_TRANSFERRED_MORTGAGE') {
      this.handleResolveTransferredMortgage(playerId, payload.tileIndex, payload.unmortgageNow, events);
      return this.emit(events);
    }

    if (action === 'ALLY_BAILOUT' && this.state.phase === 'BANKRUPTCY_CHECK') {
      this.handleAllyBailout(playerId, events);
      return this.emit(events);
    }

    // Kiểm tra quyền của người đang tới lượt
    const activePlayer = this.getActivePlayer();
    if (!activePlayer || activePlayer.id !== playerId) return this.emit(events);

    switch (action) {
      case 'JAIL_PAY_FINE':
        this.handleJailPayFine(activePlayer, events);
        break;
      case 'JAIL_USE_CARD':
        this.handleJailUseCard(activePlayer, events);
        break;
      case 'ROLL_DICE':
        this.handleRollDice(activePlayer, events, payload);
        break;
      case 'TRANSIT_TELEPORT':
        this.handleTransitTeleport(activePlayer, payload.targetIndex, events);
        break;
      case 'USE_SPEED_BUS':
        this.handleUseSpeedBus(activePlayer, payload.targetIndex, events);
        break;
      case 'SKIP_SPEED_BUS':
        this.handleSkipSpeedBus(activePlayer, events);
        break;
      case 'BUY_PROPERTY':
        this.handleBuyProperty(activePlayer, events);
        break;
      case 'SKIP_PROPERTY':
        this.handleSkipProperty(activePlayer, events);
        break;
      case 'BUILD_HOUSE':
        this.handleBuildHouse(activePlayer, payload.tileIndex, events);
        break;
      case 'SELL_HOUSE':
        this.handleSellHouse(activePlayer, payload.tileIndex, events);
        break;
      case 'MORTGAGE_TILE':
        this.handleMortgage(activePlayer, payload.tileIndex, events);
        break;
      case 'UNMORTGAGE_TILE':
        this.handleUnmortgage(activePlayer, payload.tileIndex, events);
        break;
      case 'CREATE_TRADE':
        this.handleCreateTrade(activePlayer, payload, events);
        break;
      case 'DECLARE_BANKRUPTCY':
        this.declareBankruptcy(activePlayer, this.state.pendingDebtCreditor || 'BANK', events);
        break;
      case 'END_TURN':
        this.handleEndTurn(activePlayer, events);
        break;
    }

    return this.emit(events);
  }

  // ==================== VÒNG LẶP LƯỢT CHƠI ====================

  enterTurnStart() {
    if (this.state.mode === 'SPEED' && this.state.startedAt && Date.now() - this.state.startedAt >= 45 * 60 * 1000) {
      this.finishGameByNetWorth('Hết 45 phút thi đấu!');
      return;
    }

    const player = this.getActivePlayer();
    this.state.escapedJailByDouble = false;
    this.state.pendingSpeedAction = null;
    this.state.busTargets = null;

    if (player.inJail) {
      this.state.phase = 'JAIL_DECISION';
      this.log(`🔒 Lượt của ${player.name} (Nhà Tù Côn Đảo - Lượt ${player.jailTurns + 1}/3).`);
    } else {
      this.state.phase = 'ROLL_DICE';
      this.log(`🎯 Đến lượt của ${player.name} (Vòng ${this.state.roundCount}).`);
    }
  }

  handleJailPayFine(player, events) {
    if (this.state.phase !== 'JAIL_DECISION' || player.cash < GAME_CONSTANTS.JAIL_FINE) return;
    this.adjustCash(player, -GAME_CONSTANTS.JAIL_FINE, 'BANK', events);
    player.inJail = false;
    player.jailTurns = 0;
    this.state.phase = 'ROLL_DICE';
    this.log(`💸 ${player.name} nộp phạt 50K để ra tù.`);
  }

  handleJailUseCard(player, events) {
    if (this.state.phase !== 'JAIL_DECISION' || player.jailFreeCards <= 0) return;
    player.jailFreeCards -= 1;
    player.inJail = false;
    player.jailTurns = 0;
    this.state.phase = 'ROLL_DICE';
    this.log(`🎫 ${player.name} sử dụng Thẻ Ân Xá để ra tù miễn phí.`);
  }

  handleRollDice(player, events, options = {}) {
    if (this.state.phase !== 'ROLL_DICE' && this.state.phase !== 'JAIL_DECISION') return;

    const d1 = options.forceDice?.[0] ?? (Math.floor(Math.random() * 6) + 1);
    const d2 = options.forceDice?.[1] ?? (Math.floor(Math.random() * 6) + 1);
    const baseSum = d1 + d2;
    const isDouble = d1 === d2;

    this.state.dice = [d1, d2];

    // Xử lý đổ xúc xắc khi đang trong Tù (chỉ dùng 2 viên tiêu chuẩn)
    if (this.state.phase === 'JAIL_DECISION' && player.inJail) {
      this.state.speedDie = null;
      this.state.pendingSpeedAction = null;
      events.push({ type: 'DICE_ROLLED', playerId: player.id, dice: [d1, d2], speedDie: null });
      this.log(`🎲 ${player.name} đổ xúc xắc trong tù: ${d1} - ${d2} (${baseSum})${isDouble ? ' [ĐÔI!]' : ''}.`);

      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        this.state.escapedJailByDouble = true;
        this.log(`🔓 ${player.name} đổ ra đôi và thoát tù thành công!`);
        this.movePlayerSteps(player, baseSum, events);
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= GAME_CONSTANTS.MAX_JAIL_TURNS) {
          this.log(`⏳ Đã hết 3 lượt ở tù! ${player.name} nộp phạt 50K và đi ${baseSum} bước.`);
          player.inJail = false;
          player.jailTurns = 0;
          this.adjustCash(player, -GAME_CONSTANTS.JAIL_FINE, 'BANK', events);
          this.movePlayerSteps(player, baseSum, events);
        } else {
          this.log(`⛓️ Chưa đổ ra đôi (${player.jailTurns}/3). ${player.name} tiếp tục ở lại tù.`);
          this.enterPostResolutionPhase(player, events);
        }
      }
      return;
    }

    // Xúc xắc Tốc độ thứ 3 (Kích hoạt từ Vòng 2 trở đi trên bàn cờ Mở Rộng 52 Ô)
    let speedFace = null;
    let extraSteps = 0;
    this.state.pendingSpeedAction = null;

    if (this.state.boardPreset === 'MEGA_52' && this.state.roundCount >= 2) {
      speedFace = options.forceSpeedDie !== undefined
        ? options.forceSpeedDie
        : SPEED_DIE_FACES[Math.floor(Math.random() * SPEED_DIE_FACES.length)];
      this.state.speedDie = speedFace;
      if (typeof speedFace === 'number') {
        extraSteps = speedFace;
      } else if (speedFace === 'BUS' || speedFace === 'MR_MONOPOLY') {
        this.state.pendingSpeedAction = speedFace;
      }
    } else {
      this.state.speedDie = null;
    }

    const totalSteps = baseSum + extraSteps;
    events.push({ type: 'DICE_ROLLED', playerId: player.id, dice: [d1, d2], speedDie: speedFace });

    const speedLabel = speedFace === null
      ? ''
      : typeof speedFace === 'number'
        ? ` + ⚡${speedFace}`
        : speedFace === 'BUS'
          ? ' + [🚌 Xe Buýt]'
          : ' + [🎩 Tỷ Phú]';
    this.log(`🎲 ${player.name} đổ: ${d1} + ${d2}${speedLabel} = ${totalSteps} bước${isDouble ? ' [ĐÔI!]' : ''}.`);

    if (isDouble) {
      this.state.doubleCount += 1;
      if (this.state.doubleCount >= 3) {
        this.state.pendingSpeedAction = null;
        this.log(`🚓 ${player.name} đổ đôi 3 lần liên tiếp -> Vào Nhà Tù Côn Đảo ngay lập tức!`);
        this.sendToJail(player, events);
        return;
      }
    } else {
      this.state.doubleCount = 0;
    }

    this.movePlayerSteps(player, totalSteps, events);
  }

  // Đặc quyền Dịch chuyển Nhanh giữa các Trạm Giao Thông trên bàn cờ 52 Ô
  handleTransitTeleport(player, targetIndex, events) {
    const transit = getTransitTeleportInfo(this.state, player.id);
    if (!transit) return;

    const dest = transit.destinations.find(d => d.index === Number(targetIndex));
    if (!dest) return;

    if (transit.fee > 0 && transit.ticketReceiverId) {
      const stationOwner = this.getPlayerById(transit.ticketReceiverId);
      this.adjustCash(player, -transit.fee, transit.ticketReceiverId, events);
      if (stationOwner) {
        this.adjustCash(stationOwner, transit.fee, null, events);
      }
      this.log(`🎫 ${player.name} mua vé chuyển tuyến -${transit.fee}K cho ${stationOwner?.name || 'chủ trạm'}.`);
    }

    this.state.doubleCount = 0;
    this.state.speedDie = null;
    this.state.pendingSpeedAction = null;

    const from = player.position;
    player.position = dest.index;
    events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to: dest.index, passedStart: false });
    this.log(`🚇 ${player.name} chuyển tuyến tốc hành thẳng tới ${dest.name} (#${dest.index})!`);
    this.resolveTile(player, dest, events);
  }

  // Lựa chọn của Xúc xắc Tốc độ mặt Xe Buýt Nhanh (BUS_DECISION)
  findNextTileOfTypes(fromIndex, types) {
    const B = this.getBoardSize();
    for (let step = 1; step < B; step++) {
      const idx = (fromIndex + step) % B;
      if (types.includes(this.state.board[idx].type)) return idx;
    }
    return null;
  }

  handleUseSpeedBus(player, targetIndex, events) {
    if (this.state.phase !== 'BUS_DECISION' || !this.state.busTargets) return;
    const validTargets = [this.state.busTargets.cardIndex, this.state.busTargets.stationIndex].filter(v => v !== null);
    const chosen = Number(targetIndex);
    if (!validTargets.includes(chosen)) return;

    this.state.busTargets = null;
    const tile = this.state.board[chosen];
    this.log(`🚌 ${player.name} bắt Xe Buýt Nhanh tiến thẳng tới ${tile.name} (#${chosen})!`);
    this.movePlayerToIndex(player, chosen, true, events);
  }

  handleSkipSpeedBus(player, events) {
    if (this.state.phase !== 'BUS_DECISION') return;
    this.state.busTargets = null;
    this.log(`🚏 ${player.name} chọn xuống xe đứng yên tại chỗ.`);
    this.enterPostResolutionPhase(player, events);
  }

  awardStartBonus(player, landedExactOnStart, events) {
    if (this.state.boardPreset === 'MEGA_52') {
      const bonus = landedExactOnStart ? MEGA_52_CONSTANTS.SALARY_EXACT : MEGA_52_CONSTANTS.SALARY_PASS;
      this.log(
        landedExactOnStart
          ? `🏁 ${player.name} dừng chính xác trên ô Khởi Hành, nhận thưởng lớn +${bonus}K!`
          : `🏁 ${player.name} đi qua ô Khởi Hành, nhận lương +${bonus}K.`
      );
      this.adjustCash(player, bonus, null, events);
    } else {
      this.log(`🏁 ${player.name} đi qua ô Khởi Hành, nhận lương +${GAME_CONSTANTS.SALARY}K.`);
      this.adjustCash(player, GAME_CONSTANTS.SALARY, null, events);
    }
  }

  movePlayerSteps(player, steps, events) {
    const B = this.getBoardSize();
    const from = player.position;
    let rawPos = from + steps;
    let passedStart = false;

    if (steps > 0 && rawPos >= B) {
      passedStart = true;
      rawPos = rawPos % B;
    } else if (rawPos < 0) {
      rawPos = (rawPos + B) % B;
    }

    player.position = rawPos;
    events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to: rawPos, passedStart });

    if (passedStart) {
      this.awardStartBonus(player, rawPos === 0, events);
    }

    this.resolveTile(player, this.state.board[rawPos], events);
  }

  movePlayerToIndex(player, targetIndex, collectSalary, events) {
    const from = player.position;
    const passedStart = collectSalary && (targetIndex < from || targetIndex === 0);
    player.position = targetIndex;
    events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to: targetIndex, passedStart });

    if (passedStart) {
      this.awardStartBonus(player, targetIndex === 0, events);
    }

    this.resolveTile(player, this.state.board[targetIndex], events);
  }

  sendToJail(player, events) {
    const jailIdx = this.getJailIndex();
    const from = player.position;
    player.position = jailIdx;
    player.inJail = true;
    player.jailTurns = 0;
    this.state.doubleCount = 0;
    this.state.pendingSpeedAction = null;
    this.state.busTargets = null;
    events.push({ type: 'PLAYER_JAILED', playerId: player.id, from, to: jailIdx });

    if (player.cash < 0) {
      this.state.phase = 'BANKRUPTCY_CHECK';
    } else {
      this.advanceToNextPlayer();
    }
  }

  // ==================== XỬ LÝ Ô BÀN CỜ (TILE RESOLUTION) ====================

  resolveTile(player, tile, events, specialContext = {}) {
    switch (tile.type) {
      case 'START':
      case 'JAIL':
        this.enterPostResolutionPhase(player, events);
        break;

      case 'FREE_PARKING':
        if (this.state.boardPreset === 'MEGA_52' && this.state.festivalFund > 0) {
          const reward = this.state.festivalFund;
          this.state.festivalFund = 0;
          this.log(`⛲ ${player.name} dừng tại Phố Đi Bộ và trúng Quỹ Lễ Hội +${reward}K!`);
          this.adjustCash(player, reward, null, events);
        }
        this.enterPostResolutionPhase(player, events);
        break;

      case 'NATIONAL_AUCTION': {
        const unowned = this.state.board.filter(
          t => !t.ownerId && (t.type === 'PROPERTY' || t.type === 'STATION' || t.type === 'UTILITY')
        );
        if (unowned.length > 0) {
          const picked = unowned[Math.floor(Math.random() * unowned.length)];
          this.log(`🔨 Sàn Đấu Giá Quốc Gia rút lô đất ${picked.name} (#${picked.index}) ra đấu giá công khai!`);
          this.startAuction(picked.index);
        } else {
          this.log(`🔨 Sàn Đấu Giá Quốc Gia: Mọi lô đất trên bàn cờ đều đã có chủ!`);
          this.enterPostResolutionPhase(player, events);
        }
        break;
      }

      case 'GO_TO_JAIL':
        this.log(`🚨 ${player.name} dừng tại ô VÀO TÙ!`);
        this.sendToJail(player, events);
        break;

      case 'TAX':
        this.log(`🏛️ ${player.name} nộp ${tile.name}: -${tile.taxAmount}K.`);
        if (this.state.boardPreset === 'MEGA_52') {
          this.state.festivalFund += tile.taxAmount;
        }
        this.adjustCash(player, -tile.taxAmount, 'BANK', events);
        this.enterPostResolutionPhase(player, events);
        break;

      case 'CHANCE':
        this.drawCard(player, 'CHANCE', events);
        break;

      case 'COMMUNITY_CHEST':
        this.drawCard(player, 'COMMUNITY_CHEST', events);
        break;

      case 'PROPERTY':
      case 'STATION':
      case 'UTILITY':
        if (!tile.ownerId) {
          this.state.phase = 'TILE_RESOLUTION';
          this.log(`🏡 ${player.name} dừng tại đất trống: ${tile.name} (Giá ${tile.price}K).`);
        } else if (tile.ownerId === player.id) {
          this.enterPostResolutionPhase(player, events);
        } else {
          this.collectRent(player, tile, events, specialContext);
          this.enterPostResolutionPhase(player, events);
        }
        break;
    }
  }

  collectRent(player, tile, events, specialContext = {}) {
    if (tile.isMortgaged) {
      this.log(`🏦 ${tile.name} đang thế chấp ngân hàng, ${player.name} được miễn tiền thuê.`);
      return;
    }

    const owner = this.getPlayerById(tile.ownerId);
    if (!owner || owner.isBankrupt) return;

    // Quyền lợi Liên minh 2v2v2: Miễn 100% tiền thuê khi đi vào đất của đồng đội
    if (areTeammates(this.state, owner.id, player.id)) {
      this.log(`🤝 ${tile.name} thuộc đồng đội Liên minh (${owner.name}) -> ${player.name} được miễn 100% tiền thuê!`);
      return;
    }

    let rentAmount = 0;

    if (tile.type === 'PROPERTY') {
      if (tile.level === 0) {
        rentAmount = tile.rent[0];
        if (ownsFullGroupUnmortgaged(this.state, owner.id, tile.group)) {
          rentAmount *= 2;
        }
      } else {
        rentAmount = tile.rent[tile.level] ?? tile.rent[tile.rent.length - 1];
      }
    } else if (tile.type === 'STATION') {
      const ownedStations = this.state.board.filter(
        t => t.type === 'STATION' &&
          (t.ownerId === owner.id || areTeammates(this.state, t.ownerId, owner.id)) &&
          !t.isMortgaged
      ).length;
      rentAmount = getStationRentByCount(ownedStations);
    } else if (tile.type === 'UTILITY') {
      if (specialContext.utilityMultiplier) {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        this.state.dice = [d1, d2];
        events.push({ type: 'DICE_ROLLED', playerId: player.id, dice: [d1, d2], speedDie: null });
        rentAmount = (d1 + d2) * specialContext.utilityMultiplier;
      } else {
        const ownedUtils = this.state.board.filter(
          t => t.type === 'UTILITY' &&
            (t.ownerId === owner.id || areTeammates(this.state, t.ownerId, owner.id)) &&
            !t.isMortgaged
        ).length;
        const mult = getUtilityMultiplierByCount(ownedUtils);
        const speedNum = typeof this.state.speedDie === 'number' ? this.state.speedDie : 0;
        const diceSum = this.state.dice[0] + this.state.dice[1] + speedNum;
        rentAmount = diceSum * mult;
      }
    }

    this.log(`💰 ${player.name} trả ${rentAmount}K tiền thuê tại ${tile.name} cho ${owner.name}.`);
    this.adjustCash(player, -rentAmount, owner.id, events);
    this.adjustCash(owner, rentAmount, null, events);
  }

  // ==================== MUA ĐẤT & ĐẤU GIÁ THỜI GIAN THỰC ====================

  handleBuyProperty(player, events) {
    if (this.state.phase !== 'TILE_RESOLUTION') return;
    const tile = this.state.board[player.position];
    if (!tile || tile.ownerId || player.cash < tile.price) return;

    this.adjustCash(player, -tile.price, 'BANK', events);
    tile.ownerId = player.id;
    this.log(`📜 ${player.name} đã mua ${tile.name} với giá ${tile.price}K.`);
    this.enterPostResolutionPhase(player, events);
  }

  handleSkipProperty(player, events) {
    if (this.state.phase !== 'TILE_RESOLUTION') return;
    const tile = this.state.board[player.position];
    if (!tile || tile.ownerId) return;

    this.log(`🔨 ${player.name} từ chối mua ${tile.name}. Mở phiên Đấu Giá công khai!`);
    this.startAuction(tile.index);
  }

  startAuction(tileIndex) {
    this.clearAuctionTimer();
    this.state.phase = 'AUCTION_PHASE';
    this.state.auction = {
      tileIndex,
      highestBid: 0,
      highestBidderId: null,
      foldedIds: [],
      expiresAt: Date.now() + GAME_CONSTANTS.AUCTION_TIMER_SECONDS * 1000
    };
    this.scheduleAuctionExpiry();
  }

  scheduleAuctionExpiry() {
    this.clearAuctionTimer();
    this.auctionTimer = setTimeout(() => {
      if (this.state.phase === 'AUCTION_PHASE') {
        const events = [];
        this.finalizeAuction(events);
        this.emit(events);
      }
    }, GAME_CONSTANTS.AUCTION_TIMER_SECONDS * 1000);
  }

  clearAuctionTimer() {
    if (this.auctionTimer) {
      clearTimeout(this.auctionTimer);
      this.auctionTimer = null;
    }
  }

  handlePlaceBid(playerId, amount, events) {
    const auction = this.state.auction;
    const bidder = this.getPlayerById(playerId);
    if (!auction || !bidder || bidder.isBankrupt || auction.foldedIds.includes(playerId)) return;

    const minRequired = auction.highestBid === 0
      ? GAME_CONSTANTS.MIN_AUCTION_START
      : auction.highestBid + GAME_CONSTANTS.MIN_BID_STEP;

    if (amount < minRequired || bidder.cash < amount) return;

    auction.highestBid = amount;
    auction.highestBidderId = playerId;
    auction.expiresAt = Date.now() + GAME_CONSTANTS.AUCTION_TIMER_SECONDS * 1000;
    this.log(`🙋 ${bidder.name} trả giá ${amount}K!`);

    const activeBidders = this.getAlivePlayers().filter(p => !auction.foldedIds.includes(p.id));
    if (activeBidders.length <= 1 && auction.highestBidderId) {
      this.finalizeAuction(events);
    } else {
      this.scheduleAuctionExpiry();
    }
  }

  handleFoldAuction(playerId, events) {
    const auction = this.state.auction;
    const player = this.getPlayerById(playerId);
    if (!auction || !player || auction.foldedIds.includes(playerId)) return;

    auction.foldedIds.push(playerId);
    this.log(`🏳️ ${player.name} bỏ cuộc đấu giá.`);

    const remaining = this.getAlivePlayers().filter(p => !auction.foldedIds.includes(p.id));
    if (remaining.length === 0 || (remaining.length === 1 && auction.highestBidderId === remaining[0].id)) {
      this.finalizeAuction(events);
    }
  }

  finalizeAuction(events) {
    this.clearAuctionTimer();
    const auction = this.state.auction;
    if (!auction) return;

    const tile = this.state.board[auction.tileIndex];
    if (auction.highestBidderId && auction.highestBid > 0) {
      const winner = this.getPlayerById(auction.highestBidderId);
      this.adjustCash(winner, -auction.highestBid, 'BANK', events);
      tile.ownerId = winner.id;
      this.log(`🎉 ${winner.name} thắng đấu giá ${tile.name} với mức ${auction.highestBid}K!`);
    } else {
      this.log(`📭 Không ai đặt giá cho ${tile.name}. Lô đất tiếp tục vô chủ.`);
    }

    this.state.auction = null;

    if (this.state.auctionQueue.length > 0) {
      const nextTileIndex = this.state.auctionQueue.shift();
      this.startAuction(nextTileIndex);
      return;
    }

    const activePlayer = this.getActivePlayer();
    if (!activePlayer || activePlayer.isBankrupt) {
      this.advanceToNextPlayer();
    } else {
      this.enterPostResolutionPhase(activePlayer, events);
    }
  }

  // ==================== THẺ CƠ HỘI & KHÍ VẬN ====================

  resolveCardTargetIndex(card) {
    if (this.state.boardPreset !== 'MEGA_52') {
      return card.payload.targetIndex;
    }
    // Ánh xạ chính xác địa danh tương ứng trên bàn cờ 52 Ô
    const map40To52 = {
      0: 0,   // Khởi Hành
      15: 21, // Ga Đà Nẵng
      29: 47, // Đảo Phú Quốc
      39: 51  // Phố Đi Bộ Nguyễn Huệ
    };
    return map40To52[card.payload.targetIndex] ?? card.payload.targetIndex;
  }

  drawCard(player, deckType, events) {
    const deck = deckType === 'CHANCE' ? this.chanceDeck : this.communityDeck;
    if (deck.length === 0) {
      const base = deckType === 'CHANCE' ? CHANCE_CARDS : COMMUNITY_CARDS;
      const heldJailCards = this.state.players.reduce((sum, p) => sum + p.jailFreeCards, 0);
      const refilled = shuffleDeck(base.filter(c => c.action !== 'JAIL_FREE_CARD' || heldJailCards === 0));
      deck.push(...refilled);
    }

    const card = deck.shift();
    events.push({ type: 'CARD_DRAWN', playerId: player.id, deck: deckType, card });
    this.log(`🃏 ${player.name} rút thẻ ${deckType === 'CHANCE' ? 'Cơ Hội' : 'Khí Vận'}: "${card.text}"`);

    if (card.action !== 'JAIL_FREE_CARD') {
      deck.push(card);
    }

    switch (card.action) {
      case 'ADD_CASH':
        this.adjustCash(player, card.payload.amount, null, events);
        this.enterPostResolutionPhase(player, events);
        break;

      case 'DEDUCT_CASH':
        if (this.state.boardPreset === 'MEGA_52') {
          this.state.festivalFund += card.payload.amount;
        }
        this.adjustCash(player, -card.payload.amount, 'BANK', events);
        this.enterPostResolutionPhase(player, events);
        break;

      case 'MOVE_TO': {
        const destIdx = this.resolveCardTargetIndex(card);
        this.movePlayerToIndex(player, destIdx, card.payload.collectSalary, events);
        break;
      }

      case 'MOVE_STEPS':
        this.movePlayerSteps(player, card.payload.steps, events);
        break;

      case 'NEAREST_UTILITY': {
        const target = this.findNextTileOfTypes(player.position, ['UTILITY']) ?? 12;
        const passedStart = target < player.position;
        const from = player.position;
        player.position = target;
        events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to: target, passedStart });
        if (passedStart) {
          this.awardStartBonus(player, target === 0, events);
        }
        const utilTile = this.state.board[target];
        if (utilTile.ownerId && utilTile.ownerId !== player.id && !areTeammates(this.state, utilTile.ownerId, player.id)) {
          this.collectRent(player, utilTile, events, { utilityMultiplier: card.payload.multiplier });
          this.enterPostResolutionPhase(player, events);
        } else {
          this.resolveTile(player, utilTile, events);
        }
        break;
      }

      case 'GO_TO_JAIL':
        this.sendToJail(player, events);
        break;

      case 'STREET_REPAIRS': {
        let totalCost = 0;
        for (const t of this.state.board) {
          if (t.ownerId === player.id && t.level > 0) {
            totalCost += t.level >= 5 ? card.payload.hotelCost : t.level * card.payload.houseCost;
          }
        }
        this.log(`🛠️ Chi phí sửa chữa công trình của ${player.name}: -${totalCost}K.`);
        if (totalCost > 0) {
          if (this.state.boardPreset === 'MEGA_52') this.state.festivalFund += totalCost;
          this.adjustCash(player, -totalCost, 'BANK', events);
        }
        this.enterPostResolutionPhase(player, events);
        break;
      }

      case 'PAY_EACH_PLAYER': {
        const others = this.getAlivePlayers().filter(p => p.id !== player.id);
        const total = others.length * card.payload.amount;
        this.adjustCash(player, -total, 'BANK', events);
        for (const other of others) {
          this.adjustCash(other, card.payload.amount, null, events);
        }
        this.enterPostResolutionPhase(player, events);
        break;
      }

      case 'COLLECT_FROM_ALL': {
        const others = this.getAlivePlayers().filter(p => p.id !== player.id);
        for (const other of others) {
          this.adjustCash(other, -card.payload.amount, player.id, events);
          this.adjustCash(player, card.payload.amount, null, events);
        }
        this.enterPostResolutionPhase(player, events);
        break;
      }

      case 'JAIL_FREE_CARD':
        player.jailFreeCards += 1;
        this.enterPostResolutionPhase(player, events);
        break;
    }
  }

  // ==================== XÂY DỰNG LINH HOẠT, LANDMARK CẤP 6, THẾ CHẤP & GIAO DỊCH ====================

  ownsFullGroupUnmortgaged(playerId, group) {
    return ownsFullGroupUnmortgaged(this.state, playerId, group);
  }

  canBuildHouse(playerId, tileIndex) {
    return canBuildHouseState(this.state, playerId, tileIndex);
  }

  handleBuildHouse(player, tileIndex, events) {
    if (this.state.phase !== 'MANAGEMENT_PHASE') return;
    if (!this.canBuildHouse(player.id, tileIndex)) return;

    const tile = this.state.board[tileIndex];
    this.adjustCash(player, -tile.buildCost, 'BANK', events);
    tile.level += 1;
    const label = tile.level === 6
      ? 'Siêu Quần Thể Landmark 🏙️'
      : tile.level === 5
        ? 'Khách Sạn 5 Sao 🏨'
        : `Nhà phố cấp ${tile.level} 🏠`;
    this.log(`🏗️ ${player.name} dựng ${label} tại ${tile.name} (-${tile.buildCost}K).`);
  }

  canSellHouse(playerId, tileIndex) {
    return canSellHouseState(this.state, playerId, tileIndex);
  }

  handleSellHouse(player, tileIndex, events) {
    if (this.state.phase !== 'MANAGEMENT_PHASE' && this.state.phase !== 'BANKRUPTCY_CHECK') return;
    if (!this.canSellHouse(player.id, tileIndex)) return;

    const tile = this.state.board[tileIndex];
    const refund = Math.floor(tile.buildCost * 0.5);
    tile.level -= 1;
    this.adjustCash(player, refund, null, events);
    this.log(`🏚️ ${player.name} bán 1 cấp công trình tại ${tile.name}, thu về +${refund}K.`);
    this.recheckDebtRecovery(player);
  }

  canMortgageTile(playerId, tileIndex) {
    return canMortgageTileState(this.state, playerId, tileIndex);
  }

  handleMortgage(player, tileIndex, events) {
    if (this.state.phase !== 'MANAGEMENT_PHASE' && this.state.phase !== 'BANKRUPTCY_CHECK') return;
    if (!this.canMortgageTile(player.id, tileIndex)) return;

    const tile = this.state.board[tileIndex];
    tile.isMortgaged = true;
    this.adjustCash(player, tile.mortgageValue, null, events);
    this.log(`🏦 ${player.name} thế chấp ${tile.name}, nhận +${tile.mortgageValue}K.`);
    this.recheckDebtRecovery(player);
  }

  handleUnmortgage(player, tileIndex, events) {
    if (this.state.phase !== 'MANAGEMENT_PHASE') return;
    const tile = this.state.board[tileIndex];
    if (!tile || tile.ownerId !== player.id || !tile.isMortgaged) return;

    const cost = Math.ceil(tile.mortgageValue * 1.1);
    if (player.cash < cost) return;

    this.adjustCash(player, -cost, 'BANK', events);
    tile.isMortgaged = false;
    this.log(`🔓 ${player.name} chuộc lại ${tile.name} với giá ${cost}K.`);
  }

  isTileTradable(ownerId, tileIndex) {
    return isTileTradableState(this.state, ownerId, tileIndex);
  }

  handleCreateTrade(fromPlayer, payload, events) {
    if (this.state.phase !== 'MANAGEMENT_PHASE') return;
    const toPlayer = this.getPlayerById(payload.toPlayerId);
    if (!toPlayer || toPlayer.isBankrupt || toPlayer.id === fromPlayer.id) return;

    const offerCash = Math.max(0, Number(payload.offerCash || 0));
    const requestCash = Math.max(0, Number(payload.requestCash || 0));
    const offerProperties = payload.offerProperties || [];
    const requestProperties = payload.requestProperties || [];
    const offerJailCards = Math.max(0, Number(payload.offerJailCards || 0));
    const requestJailCards = Math.max(0, Number(payload.requestJailCards || 0));

    if (fromPlayer.cash < offerCash || toPlayer.cash < requestCash) return;
    if (fromPlayer.jailFreeCards < offerJailCards || toPlayer.jailFreeCards < requestJailCards) return;
    if (!offerProperties.every(idx => this.isTileTradable(fromPlayer.id, idx))) return;
    if (!requestProperties.every(idx => this.isTileTradable(toPlayer.id, idx))) return;

    this.state.pendingTrade = {
      fromPlayerId: fromPlayer.id,
      toPlayerId: toPlayer.id,
      offerCash,
      requestCash,
      offerProperties,
      requestProperties,
      offerJailCards,
      requestJailCards
    };
    this.log(`🤝 ${fromPlayer.name} gửi đề nghị thương lượng tài sản tới ${toPlayer.name}.`);
  }

  handleRespondTrade(playerId, accept, events) {
    const trade = this.state.pendingTrade;
    if (!trade || trade.toPlayerId !== playerId) return;
    this.state.pendingTrade = null;

    const fromP = this.getPlayerById(trade.fromPlayerId);
    const toP = this.getPlayerById(trade.toPlayerId);

    if (!accept) {
      this.log(`❌ ${toP.name} đã từ chối lời đề nghị giao dịch của ${fromP.name}.`);
      return;
    }

    if (trade.offerCash > 0) {
      this.adjustCash(fromP, -trade.offerCash, toP.id, events);
      this.adjustCash(toP, trade.offerCash, null, events);
    }
    if (trade.requestCash > 0) {
      this.adjustCash(toP, -trade.requestCash, fromP.id, events);
      this.adjustCash(fromP, trade.requestCash, null, events);
    }
    fromP.jailFreeCards = fromP.jailFreeCards - trade.offerJailCards + trade.requestJailCards;
    toP.jailFreeCards = toP.jailFreeCards - trade.requestJailCards + trade.offerJailCards;

    const transferTile = (tileIdx, newOwner) => {
      const tile = this.state.board[tileIdx];
      tile.ownerId = newOwner.id;
      if (tile.isMortgaged) {
        const fee10Percent = Math.ceil((tile.price || tile.mortgageValue * 2) * 0.1);
        this.adjustCash(newOwner, -fee10Percent, 'BANK', events);
        this.state.pendingMortgageTransfers.push({ playerId: newOwner.id, tileIndex: tileIdx });
      }
    };

    trade.offerProperties.forEach(idx => transferTile(idx, toP));
    trade.requestProperties.forEach(idx => transferTile(idx, fromP));

    this.log(`✅ Giao dịch thành công giữa ${fromP.name} và ${toP.name}!`);
  }

  handleResolveTransferredMortgage(playerId, tileIndex, unmortgageNow, events) {
    const idx = this.state.pendingMortgageTransfers.findIndex(
      item => item.playerId === playerId && item.tileIndex === tileIndex
    );
    if (idx === -1) return;

    const player = this.getPlayerById(playerId);
    const tile = this.state.board[tileIndex];

    if (unmortgageNow && player.cash >= tile.mortgageValue) {
      this.adjustCash(player, -tile.mortgageValue, 'BANK', events);
      tile.isMortgaged = false;
      this.log(`🔓 ${player.name} trả thêm ${tile.mortgageValue}K gốc để giải chấp ngay ${tile.name}.`);
    }
    this.state.pendingMortgageTransfers.splice(idx, 1);
  }

  // ==================== CỨU TRỢ LIÊN MINH, NỢ & PHÁ SẢN ====================

  handleAllyBailout(callerId, events) {
    const active = this.getActivePlayer();
    if (!active) return;
    const bailout = getAllyBailoutInfo(this.state, active.id);
    if (!bailout) return;
    if (callerId !== bailout.debtorId && callerId !== bailout.allyId) return;

    const ally = this.getPlayerById(bailout.allyId);
    if (!ally) return;

    ally.usedBailout = true;
    this.adjustCash(ally, -bailout.amount, 'BANK', events);
    this.adjustCash(active, bailout.amount, null, events);
    this.log(`🤝 CỨU TRỢ LIÊN MINH! ${ally.name} chuyển khoản ${bailout.amount}K giải cứu đồng đội ${active.name}!`);
    this.recheckDebtRecovery(active);
  }

  calculateMaxRecoverableCash(player) {
    let recoverable = player.cash;
    for (const tile of this.state.board) {
      if (tile.ownerId === player.id) {
        if (tile.level > 0 && tile.buildCost) {
          recoverable += tile.level * Math.floor(tile.buildCost * 0.5);
        }
        if (!tile.isMortgaged && tile.mortgageValue) {
          recoverable += tile.mortgageValue;
        }
      }
    }
    // Nếu đồng đội Liên minh có thể cứu trợ thì vẫn còn cơ hội phục hồi
    const bailout = getAllyBailoutInfo({ ...this.state, phase: 'BANKRUPTCY_CHECK' }, player.id);
    if (bailout) {
      recoverable += bailout.amount;
    }
    return recoverable;
  }

  findMrMonopolyTarget(fromIndex, playerId) {
    const B = this.getBoardSize();
    const isPurchasable = (t) => t.type === 'PROPERTY' || t.type === 'STATION' || t.type === 'UTILITY';

    // 1. Ưu tiên ô đất trống chưa có chủ gần nhất phía trước
    for (let step = 1; step <= B; step++) {
      const idx = (fromIndex + step) % B;
      const t = this.state.board[idx];
      if (isPurchasable(t) && !t.ownerId) return t;
    }

    // 2. Nếu toàn bộ đất đã có chủ -> Bay tới ô đất có chủ thu thuê gần nhất phía trước
    for (let step = 1; step <= B; step++) {
      const idx = (fromIndex + step) % B;
      const t = this.state.board[idx];
      if (
        isPurchasable(t) &&
        t.ownerId &&
        t.ownerId !== playerId &&
        !areTeammates(this.state, t.ownerId, playerId) &&
        !t.isMortgaged
      ) {
        return t;
      }
    }
    return null;
  }

  enterPostResolutionPhase(player, events) {
    if (player.cash < 0) {
      this.state.pendingSpeedAction = null;
      this.state.busTargets = null;
      const maxRecoverable = this.calculateMaxRecoverableCash(player);
      if (maxRecoverable < 0) {
        this.declareBankruptcy(player, this.state.pendingDebtCreditor || 'BANK', events);
      } else {
        this.state.phase = 'BANKRUPTCY_CHECK';
        this.log(`⚠️ ${player.name} đang âm tiền (${player.cash}K)! Cần bán nhà, thế chấp hoặc nhận Cứu trợ Liên minh.`);
      }
      return;
    }

    this.state.pendingDebtCreditor = null;

    // Kích hoạt hiệu ứng đặc biệt của Xúc xắc Tốc độ (nếu có) sau khi xong ô đầu tiên
    if (!player.inJail && !player.isBankrupt && this.state.pendingSpeedAction) {
      const speedAct = this.state.pendingSpeedAction;
      this.state.pendingSpeedAction = null;

      if (speedAct === 'MR_MONOPOLY') {
        const targetTile = this.findMrMonopolyTarget(player.position, player.id);
        if (targetTile && targetTile.index !== player.position) {
          this.log(`🎩 Xúc xắc Tỷ Phú! ${player.name} tự động tiến thẳng tới ${targetTile.name} (#${targetTile.index})!`);
          this.movePlayerToIndex(player, targetTile.index, true, events);
          return;
        }
      } else if (speedAct === 'BUS') {
        const cardIndex = this.findNextTileOfTypes(player.position, ['CHANCE', 'COMMUNITY_CHEST']);
        const stationIndex = this.findNextTileOfTypes(player.position, ['STATION']);
        this.state.busTargets = { cardIndex, stationIndex };
        this.state.phase = 'BUS_DECISION';
        this.log(`🚌 Xe Buýt Nhanh! ${player.name} được quyền đi tiếp tới Ô Thẻ / Trạm Giao Thông hoặc đứng yên.`);
        return;
      }
    }

    this.state.phase = 'MANAGEMENT_PHASE';
  }

  recheckDebtRecovery(player) {
    if (this.state.phase === 'BANKRUPTCY_CHECK' && player.cash >= 0) {
      this.state.pendingDebtCreditor = null;
      this.state.phase = 'MANAGEMENT_PHASE';
      this.log(`✅ ${player.name} đã thanh toán xong khoản nợ!`);
    }
  }

  declareBankruptcy(player, creditorId, events) {
    this.log(`💥 ${player.name} CHÍNH THỨC PHÁ SẢN!`);
    player.isBankrupt = true;
    this.state.pendingSpeedAction = null;
    this.state.busTargets = null;

    for (const tile of this.state.board) {
      if (tile.ownerId === player.id && tile.level > 0) {
        const refund = tile.level * Math.floor(tile.buildCost * 0.5);
        tile.level = 0;
        if (player.cash < 0) player.cash += refund;
      }
    }

    const ownedTiles = this.state.board.filter(t => t.ownerId === player.id);

    if (creditorId && creditorId !== 'BANK') {
      const creditor = this.getPlayerById(creditorId);
      if (creditor && !creditor.isBankrupt) {
        if (player.cash > 0) this.adjustCash(creditor, player.cash, null, events);
        creditor.jailFreeCards += player.jailFreeCards;
        for (const tile of ownedTiles) {
          tile.ownerId = creditor.id;
          tile.isMortgaged = true;
        }
        this.log(`📦 Toàn bộ tài sản của ${player.name} được chuyển nhượng cho chủ nợ ${creditor.name}.`);
      }
    } else {
      for (const tile of ownedTiles) {
        tile.ownerId = null;
        tile.isMortgaged = false;
        tile.level = 0;
        this.state.auctionQueue.push(tile.index);
      }
    }

    player.cash = 0;
    player.jailFreeCards = 0;

    if (this.state.mode === 'SPEED') {
      this.clearAuctionTimer();
      this.state.auctionQueue = [];
      this.finishGameByNetWorth(`Chế độ Chơi nhanh kết thúc do ${player.name} phá sản!`);
      return;
    }

    const alive = this.getAlivePlayers();

    // Kiểm tra chiến thắng theo Liên Minh 2v2v2
    if (this.state.allianceMode) {
      const aliveTeams = [...new Set(alive.map(p => getAllianceForPlayer(p.id)?.id || p.id))];
      if (aliveTeams.length <= 1) {
        this.clearAuctionTimer();
        this.state.auctionQueue = [];
        this.state.phase = 'GAME_OVER';
        const winTeam = ALLIANCE_TEAMS[aliveTeams[0]];
        this.state.winningAlliance = winTeam?.id || null;
        this.state.winnerId = alive[0]?.id || null;
        this.log(`🏆 CHIẾN THẮNG LIÊN MINH! ${winTeam?.name || alive[0]?.name} thống trị toàn bộ bàn cờ!`);
        return;
      }
    } else if (alive.length <= 1) {
      this.clearAuctionTimer();
      this.state.auctionQueue = [];
      this.state.phase = 'GAME_OVER';
      this.state.winnerId = alive[0]?.id || null;
      this.log(`🏆 CHÚC MỪNG ${alive[0]?.name} TRỞ THÀNH TỶ PHÚ CHIẾN THẮNG CUỐI CÙNG!`);
      return;
    }

    const activePlayer = this.getActivePlayer();
    const wasActive = activePlayer?.id === player.id;

    if (this.state.auctionQueue.length > 0 && this.state.phase !== 'AUCTION_PHASE') {
      const firstTile = this.state.auctionQueue.shift();
      this.startAuction(firstTile);
      return;
    }

    if (wasActive && this.state.phase !== 'AUCTION_PHASE') {
      this.advanceToNextPlayer();
    }
  }

  removeLobbyPlayer(targetId) {
    if (this.state.phase !== 'LOBBY' || !targetId || targetId === 'P1') return;
    const idx = this.state.players.findIndex(p => p.id === targetId);
    if (idx === -1) return;
    const [removed] = this.state.players.splice(idx, 1);
    this.log(`👋 ${removed.name} đã rời khỏi phòng chờ.`);
  }

  handleLeaveRoom(playerId, events) {
    const player = this.getPlayerById(playerId);
    if (!player) return;

    if (this.state.phase === 'LOBBY') {
      this.removeLobbyPlayer(playerId);
      return;
    }

    if (this.state.phase === 'GAME_OVER' || player.isBankrupt) return;

    if (this.state.pendingTrade &&
      (this.state.pendingTrade.fromPlayerId === playerId || this.state.pendingTrade.toPlayerId === playerId)) {
      this.state.pendingTrade = null;
    }

    this.log(`🚪 ${player.name} đã rời khỏi phòng!`);

    if (this.state.phase === 'AUCTION_PHASE' && this.state.auction) {
      if (!this.state.auction.foldedIds.includes(playerId)) {
        this.state.auction.foldedIds.push(playerId);
      }
      if (this.state.auction.highestBidderId === playerId) {
        this.state.auction.highestBidderId = null;
        this.state.auction.highestBid = 0;
      }
    }

    this.declareBankruptcy(player, 'BANK', events);
  }

  handleEndTurn(player, events) {
    if (this.state.phase !== 'MANAGEMENT_PHASE' || player.cash < 0) return;

    const isDouble = this.state.dice[0] === this.state.dice[1];
    if (isDouble && !player.inJail && !this.state.escapedJailByDouble && this.state.doubleCount > 0) {
      this.log(`🎲 ${player.name} được thưởng thêm 1 lượt đổ xúc xắc nhờ đổ đôi!`);
      this.enterTurnStart();
    } else {
      this.advanceToNextPlayer();
    }
  }

  advanceToNextPlayer() {
    this.state.doubleCount = 0;
    this.state.escapedJailByDouble = false;
    this.state.pendingSpeedAction = null;
    this.state.busTargets = null;

    const total = this.state.players.length;
    const prevIdx = this.state.activePlayerIndex;
    for (let step = 1; step <= total; step++) {
      const nextIdx = (prevIdx + step) % total;
      if (!this.state.players[nextIdx].isBankrupt) {
        if (nextIdx <= prevIdx) {
          this.state.roundCount += 1;
        }
        this.state.activePlayerIndex = nextIdx;
        this.enterTurnStart();
        return;
      }
    }
  }

  // ==================== TÍNH NET WORTH & TIỆN ÍCH ====================

  calculateNetWorth(playerId) {
    const player = this.getPlayerById(playerId);
    if (!player || player.isBankrupt) return -1;
    return calculateNetWorthState(this.state, playerId);
  }

  finishGameByNetWorth(reason) {
    this.state.phase = 'GAME_OVER';

    if (this.state.allianceMode) {
      let bestTeam = null;
      let bestTeamScore = -Infinity;
      for (const team of Object.values(ALLIANCE_TEAMS)) {
        const aliveMembers = this.getAlivePlayers().filter(p => team.members.includes(p.id));
        if (aliveMembers.length === 0) continue;
        const score = aliveMembers.reduce((sum, p) => sum + this.calculateNetWorth(p.id), 0);
        if (score > bestTeamScore) {
          bestTeamScore = score;
          bestTeam = team;
        }
      }
      this.state.winningAlliance = bestTeam?.id || null;
      const topMember = this.getAlivePlayers().find(p => bestTeam?.members.includes(p.id));
      this.state.winnerId = topMember?.id || null;
      this.log(`⏱️ ${reason} ${bestTeam?.name || 'Liên minh dẫn đầu'} chiến thắng với Tổng tài sản ${bestTeamScore}K!`);
      return;
    }

    let bestPlayer = null;
    let bestScore = -Infinity;

    for (const p of this.getAlivePlayers()) {
      const nw = this.calculateNetWorth(p.id);
      if (nw > bestScore) {
        bestScore = nw;
        bestPlayer = p;
      }
    }
    this.state.winnerId = bestPlayer?.id || null;
    this.log(`⏱️ ${reason} Người chiến thắng là ${bestPlayer?.name} với Tổng tài sản ${bestScore}K!`);
  }

  adjustCash(player, delta, creditorIfNegative, events) {
    player.cash += delta;
    if (delta < 0 && player.cash < 0 && creditorIfNegative) {
      this.state.pendingDebtCreditor = creditorIfNegative;
    }
    events.push({
      type: 'CASH_CHANGED',
      playerId: player.id,
      tileIndex: player.position,
      amount: delta,
      newBalance: player.cash
    });
  }

  getActivePlayer() {
    return this.state.players[this.state.activePlayerIndex] || null;
  }

  getPlayerById(id) {
    return this.state.players.find(p => p.id === id) || null;
  }

  getAlivePlayers() {
    return this.state.players.filter(p => !p.isBankrupt);
  }

  log(message) {
    this.state.logs.unshift(message);
    if (this.state.logs.length > 75) this.state.logs.pop();
  }

  getSnapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  emit(events) {
    const snapshot = this.getSnapshot();
    if (this.onBroadcast) {
      this.onBroadcast(events, snapshot);
    }
    return { events, state: snapshot };
  }
}
