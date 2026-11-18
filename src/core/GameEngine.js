import { createFreshBoard, PLAYER_PRESETS, GAME_CONSTANTS } from '../data/boardData.js';
import { CHANCE_CARDS, COMMUNITY_CARDS, shuffleDeck } from '../data/cardDecks.js';

export class GameEngine {
  constructor(roomId = 'LOCAL', mode = 'CLASSIC') {
    this.chanceDeck = shuffleDeck(CHANCE_CARDS);
    this.communityDeck = shuffleDeck(COMMUNITY_CARDS);
    this.auctionTimer = null;
    this.onBroadcast = null; // Callback (events, state) => void gắn với NetworkManager

    this.state = {
      roomId,
      mode, // 'CLASSIC' | 'SPEED'
      startedAt: null,
      phase: 'LOBBY', // LOBBY | TURN_START | JAIL_DECISION | ROLL_DICE | TILE_RESOLUTION | AUCTION_PHASE | MANAGEMENT_PHASE | BANKRUPTCY_CHECK | GAME_OVER
      players: [],
      activePlayerIndex: 0,
      board: createFreshBoard(),
      dice: [1, 1],
      doubleCount: 0,
      escapedJailByDouble: false,
      pendingDebtCreditor: null, // 'BANK' hoặc playerId
      auctionQueue: [],          // Hàng đợi các lô đất cần đấu giá (khi phá sản cho Ngân hàng)
      auction: null,             // { tileIndex, highestBid, highestBidderId, foldedIds, expiresAt }
      pendingTrade: null,        // Đề nghị giao dịch đang chờ phản hồi
      pendingMortgageTransfers: [], // Các lô đất thế chấp vừa nhận từ giao dịch cần chọn giải chấp/giữ nguyên
      winnerId: null,
      logs: ['Phòng chờ đã sẵn sàng.']
    };
  }

  // Thêm người chơi vào phòng chờ (tối đa 4 người)
  addPlayer(id, name, isAI = false) {
    if (this.state.phase !== 'LOBBY' || this.state.players.length >= 4) return false;
    const existing = this.state.players.find(p => p.id === id);
    if (existing) {
      existing.name = name || existing.name;
      return true;
    }
    const preset = PLAYER_PRESETS[this.state.players.length];
    this.state.players.push({
      id: id || preset.id,
      name: name || preset.defaultName,
      color: preset.color,
      avatar: preset.avatar,
      cash: GAME_CONSTANTS.INITIAL_BALANCE,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      isBankrupt: false,
      isAI
    });
    this.log(`👋 ${name || preset.defaultName} đã tham gia phòng.`);
    return true;
  }

  startGame(mode = 'CLASSIC') {
    if (this.state.players.length < 2) return { events: [], state: this.getSnapshot() };
    this.state.mode = mode;
    this.state.startedAt = Date.now();
    this.state.activePlayerIndex = 0;
    this.state.doubleCount = 0;
    this.log(`🎲 Ván đấu bắt đầu! Chế độ: ${mode === 'SPEED' ? 'Chơi nhanh 45 phút' : 'Tiêu chuẩn'}.`);
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

    if (action === 'START_GAME' && playerId === 'P1') {
      this.startGame(payload.mode || this.state.mode);
      return this.emit(events);
    }

    if (this.state.phase === 'GAME_OVER') return this.emit(events);

    // Các hành động toàn cục không giới hạn người giữ lượt (Đấu giá & Phản hồi Giao dịch)
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
        this.handleRollDice(activePlayer, events);
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
    // Kiểm tra hết giờ ở chế độ SPEED (45 phút)
    if (this.state.mode === 'SPEED' && this.state.startedAt && Date.now() - this.state.startedAt >= 45 * 60 * 1000) {
      this.finishGameByNetWorth('Hết 45 phút thi đấu!');
      return;
    }

    const player = this.getActivePlayer();
    this.state.escapedJailByDouble = false;

    if (player.inJail) {
      this.state.phase = 'JAIL_DECISION';
      this.log(`🔒 Lượt của ${player.name} (Đang ở Nhà Tù Côn Đảo - Lượt ${player.jailTurns + 1}/3).`);
    } else {
      this.state.phase = 'ROLL_DICE';
      this.log(`🎯 Đến lượt của ${player.name}.`);
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

  handleRollDice(player, events) {
    if (this.state.phase !== 'ROLL_DICE' && this.state.phase !== 'JAIL_DECISION') return;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;
    const isDouble = d1 === d2;

    this.state.dice = [d1, d2];
    events.push({ type: 'DICE_ROLLED', playerId: player.id, dice: [d1, d2] });
    this.log(`🎲 ${player.name} đổ xúc xắc: ${d1} - ${d2} (${sum} nút)${isDouble ? ' [ĐÔI!]' : ''}.`);

    // Xử lý đổ xúc xắc khi đang trong Tù
    if (this.state.phase === 'JAIL_DECISION' && player.inJail) {
      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        this.state.escapedJailByDouble = true; // Không được đổ thêm lượt tiếp theo
        this.log(`🔓 ${player.name} đổ ra đôi và thoát tù thành công!`);
        this.movePlayerSteps(player, sum, events);
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= GAME_CONSTANTS.MAX_JAIL_TURNS) {
          this.log(`⏳ Đã hết 3 lượt ở tù! ${player.name} bắt buộc nộp phạt 50K và đi ${sum} bước.`);
          player.inJail = false;
          player.jailTurns = 0;
          this.adjustCash(player, -GAME_CONSTANTS.JAIL_FINE, 'BANK', events);
          this.movePlayerSteps(player, sum, events);
        } else {
          this.log(`⛓️ Chưa đổ ra đôi (${player.jailTurns}/3). ${player.name} tiếp tục ở lại tù.`);
          this.enterPostResolutionPhase(player, events);
        }
      }
      return;
    }

    // Đổ xúc xắc bình thường ngoài Tù
    if (isDouble) {
      this.state.doubleCount += 1;
      if (this.state.doubleCount >= 3) {
        this.log(`🚓 ${player.name} đổ đôi 3 lần liên tiếp (Vượt tốc độ) -> Vào Tù ngay lập tức!`);
        this.sendToJail(player, events);
        return;
      }
    } else {
      this.state.doubleCount = 0;
    }

    this.movePlayerSteps(player, sum, events);
  }

  movePlayerSteps(player, steps, events) {
    const from = player.position;
    let rawPos = from + steps;
    let passedStart = false;

    if (steps > 0 && rawPos >= 40) {
      passedStart = true;
      rawPos = rawPos % 40;
    } else if (rawPos < 0) {
      rawPos = (rawPos + 40) % 40;
    }

    player.position = rawPos;
    events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to: rawPos, passedStart });

    if (passedStart) {
      this.log(`🏁 ${player.name} đi qua ô Khởi Hành, nhận lương +${GAME_CONSTANTS.SALARY}K.`);
      this.adjustCash(player, GAME_CONSTANTS.SALARY, null, events);
    }

    this.resolveTile(player, this.state.board[rawPos], events);
  }

  movePlayerToIndex(player, targetIndex, collectSalary, events) {
    const from = player.position;
    const passedStart = collectSalary && (targetIndex < from || targetIndex === 0);
    player.position = targetIndex;
    events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to: targetIndex, passedStart });

    if (passedStart) {
      this.log(`🏁 ${player.name} qua vạch Xuất Phát, nhận +${GAME_CONSTANTS.SALARY}K.`);
      this.adjustCash(player, GAME_CONSTANTS.SALARY, null, events);
    }

    this.resolveTile(player, this.state.board[targetIndex], events);
  }

  sendToJail(player, events) {
    const from = player.position;
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    this.state.doubleCount = 0;
    events.push({ type: 'PLAYER_JAILED', playerId: player.id, from, to: 10 });
    // Vào tù kết thúc lượt ngay lập tức (nếu đang không âm tiền)
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
      case 'FREE_PARKING':
        this.enterPostResolutionPhase(player, events);
        break;

      case 'GO_TO_JAIL':
        this.log(`🚨 ${player.name} dừng tại ô VÀO TÙ!`);
        this.sendToJail(player, events);
        break;

      case 'TAX':
        this.log(`🏛️ ${player.name} nộp ${tile.name}: -${tile.taxAmount}K.`);
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

    let rentAmount = 0;

    if (tile.type === 'PROPERTY') {
      if (tile.level === 0) {
        rentAmount = tile.rent[0];
        if (this.ownsFullGroupUnmortgaged(owner.id, tile.group)) {
          rentAmount *= 2; // Nhân đôi tiền thuê đất trống khi độc quyền nhóm màu
        }
      } else {
        rentAmount = tile.rent[tile.level];
      }
    } else if (tile.type === 'STATION') {
      const ownedStations = this.state.board.filter(
        t => t.type === 'STATION' && t.ownerId === owner.id && !t.isMortgaged
      ).length;
      rentAmount = 25 * Math.pow(2, Math.max(0, ownedStations - 1));
    } else if (tile.type === 'UTILITY') {
      if (specialContext.utilityMultiplier) {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        this.state.dice = [d1, d2];
        events.push({ type: 'DICE_ROLLED', playerId: player.id, dice: [d1, d2] });
        rentAmount = (d1 + d2) * specialContext.utilityMultiplier;
      } else {
        const ownedUtils = this.state.board.filter(
          t => t.type === 'UTILITY' && t.ownerId === owner.id && !t.isMortgaged
        ).length;
        const diceSum = this.state.dice[0] + this.state.dice[1];
        rentAmount = diceSum * (ownedUtils >= 2 ? 10 : 4);
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

    this.log(`🔨 ${player.name} từ chối mua ${tile.name}. Chuyển sang Đấu Giá công khai!`);
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

    // Kiểm tra nếu tất cả người khác đã bỏ cuộc thì chốt luôn
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

    // Nếu còn hàng đợi đấu giá (từ người chơi phá sản cho Ngân hàng)
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

    // Nếu không phải thẻ giữ lại thì xếp xuống đáy bộ bài
    if (card.action !== 'JAIL_FREE_CARD') {
      deck.push(card);
    }

    switch (card.action) {
      case 'ADD_CASH':
        this.adjustCash(player, card.payload.amount, null, events);
        this.enterPostResolutionPhase(player, events);
        break;

      case 'DEDUCT_CASH':
        this.adjustCash(player, -card.payload.amount, 'BANK', events);
        this.enterPostResolutionPhase(player, events);
        break;

      case 'MOVE_TO':
        this.movePlayerToIndex(player, card.payload.targetIndex, card.payload.collectSalary, events);
        break;

      case 'MOVE_STEPS':
        this.movePlayerSteps(player, card.payload.steps, events);
        break;

      case 'NEAREST_UTILITY': {
        const target = (player.position >= 12 && player.position < 28) ? 28 : 12;
        const passedStart = target < player.position;
        const from = player.position;
        player.position = target;
        events.push({ type: 'PLAYER_MOVED', playerId: player.id, from, to: target, passedStart });
        if (passedStart) {
          this.adjustCash(player, GAME_CONSTANTS.SALARY, null, events);
        }
        const utilTile = this.state.board[target];
        if (utilTile.ownerId && utilTile.ownerId !== player.id) {
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
            totalCost += t.level === 5 ? card.payload.hotelCost : t.level * card.payload.houseCost;
          }
        }
        this.log(`🛠️ Chi phí sửa chữa công trình của ${player.name}: -${totalCost}K.`);
        if (totalCost > 0) this.adjustCash(player, -totalCost, 'BANK', events);
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

  // ==================== XÂY DỰNG ĐỒNG ĐỀU, THẾ CHẤP & GIAO DỊCH ====================

  ownsFullGroupUnmortgaged(playerId, group) {
    const groupTiles = this.state.board.filter(t => t.group === group);
    return groupTiles.length > 0 && groupTiles.every(t => t.ownerId === playerId && !t.isMortgaged);
  }

  canBuildHouse(playerId, tileIndex) {
    const tile = this.state.board[tileIndex];
    const player = this.getPlayerById(playerId);
    if (!tile || !player || tile.type !== 'PROPERTY' || tile.ownerId !== playerId) return false;
    if (tile.level >= 5 || player.cash < tile.buildCost) return false;
    if (!this.ownsFullGroupUnmortgaged(playerId, tile.group)) return false;

    // Quy tắc xây đồng đều: mọi ô khác trong nhóm phải có level >= tile.level
    const groupTiles = this.state.board.filter(t => t.group === tile.group);
    return groupTiles.every(t => t.level >= tile.level);
  }

  handleBuildHouse(player, tileIndex, events) {
    if (this.state.phase !== 'MANAGEMENT_PHASE') return;
    if (!this.canBuildHouse(player.id, tileIndex)) return;

    const tile = this.state.board[tileIndex];
    this.adjustCash(player, -tile.buildCost, 'BANK', events);
    tile.level += 1;
    const label = tile.level === 5 ? 'Khách Sạn' : `Nhà cấp ${tile.level}`;
    this.log(`🏗️ ${player.name} nâng cấp ${label} tại ${tile.name} (-${tile.buildCost}K).`);
  }

  canSellHouse(playerId, tileIndex) {
    const tile = this.state.board[tileIndex];
    if (!tile || tile.type !== 'PROPERTY' || tile.ownerId !== playerId || tile.level <= 0) return false;

    // Quy tắc bán đồng đều: chỉ bán ở ô đang có số nhà cao nhất trong nhóm
    const groupTiles = this.state.board.filter(t => t.group === tile.group);
    const maxLevel = Math.max(...groupTiles.map(t => t.level));
    return tile.level === maxLevel;
  }

  handleSellHouse(player, tileIndex, events) {
    if (this.state.phase !== 'MANAGEMENT_PHASE' && this.state.phase !== 'BANKRUPTCY_CHECK') return;
    if (!this.canSellHouse(player.id, tileIndex)) return;

    const tile = this.state.board[tileIndex];
    const refund = Math.floor(tile.buildCost * 0.5);
    tile.level -= 1;
    this.adjustCash(player, refund, null, events);
    this.log(`🏚️ ${player.name} bán 1 cấp nhà tại ${tile.name}, thu về +${refund}K.`);
    this.recheckDebtRecovery(player);
  }

  canMortgageTile(playerId, tileIndex) {
    const tile = this.state.board[tileIndex];
    if (!tile || tile.ownerId !== playerId || tile.isMortgaged || !tile.mortgageValue) return false;
    if (tile.type === 'PROPERTY') {
      const groupTiles = this.state.board.filter(t => t.group === tile.group);
      if (groupTiles.some(t => t.level > 0)) return false; // Toàn bộ nhóm phải không còn nhà
    }
    return true;
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

  // Kiểm tra lô đất có được phép giao dịch không (cả nhóm màu phải không có nhà)
  isTileTradable(ownerId, tileIndex) {
    const tile = this.state.board[tileIndex];
    if (!tile || tile.ownerId !== ownerId) return false;
    if (tile.type === 'PROPERTY') {
      const groupTiles = this.state.board.filter(t => t.group === tile.group);
      if (groupTiles.some(t => t.level > 0)) return false;
    }
    return true;
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

    // Chuyển tiền & thẻ Ra Tù
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

    // Chuyển quyền sở hữu đất và thu ngay 10% phí chuyển nhượng nếu đất đang thế chấp
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

  // ==================== NỢ, THANH LÝ & PHÁ SẢN ====================

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
    return recoverable;
  }

  enterPostResolutionPhase(player, events) {
    if (player.cash < 0) {
      const maxRecoverable = this.calculateMaxRecoverableCash(player);
      if (maxRecoverable < 0) {
        this.declareBankruptcy(player, this.state.pendingDebtCreditor || 'BANK', events);
      } else {
        this.state.phase = 'BANKRUPTCY_CHECK';
        this.log(`⚠️ ${player.name} đang âm tiền (${player.cash}K)! Cần bán nhà hoặc thế chấp tài sản để trả nợ.`);
      }
    } else {
      this.state.pendingDebtCreditor = null;
      this.state.phase = 'MANAGEMENT_PHASE';
    }
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

    // 1. Tự động bán toàn bộ nhà/khách sạn về cho Ngân hàng
    for (const tile of this.state.board) {
      if (tile.ownerId === player.id && tile.level > 0) {
        const refund = tile.level * Math.floor(tile.buildCost * 0.5);
        tile.level = 0;
        if (player.cash < 0) player.cash += refund;
      }
    }

    const ownedTiles = this.state.board.filter(t => t.ownerId === player.id);

    // 2. Xử lý theo Chủ nợ
    if (creditorId && creditorId !== 'BANK') {
      const creditor = this.getPlayerById(creditorId);
      if (creditor && !creditor.isBankrupt) {
        if (player.cash > 0) this.adjustCash(creditor, player.cash, null, events);
        creditor.jailFreeCards += player.jailFreeCards;
        for (const tile of ownedTiles) {
          tile.ownerId = creditor.id;
          tile.isMortgaged = true; // Chuyển giao dưới dạng đang thế chấp theo đặc tả
        }
        this.log(`📦 Toàn bộ tài sản của ${player.name} được chuyển nhượng cho chủ nợ ${creditor.name}.`);
      }
    } else {
      // Nợ Ngân hàng: thu hồi đất và đưa lần lượt vào Đấu Giá
      for (const tile of ownedTiles) {
        tile.ownerId = null;
        tile.isMortgaged = false;
        tile.level = 0;
        this.state.auctionQueue.push(tile.index);
      }
    }

    player.cash = 0;
    player.jailFreeCards = 0;

    // 3. Kiểm tra điều kiện kết thúc ván đấu
    if (this.state.mode === 'SPEED') {
      this.clearAuctionTimer();
      this.state.auctionQueue = [];
      this.finishGameByNetWorth(`Chế độ Chơi nhanh kết thúc do ${player.name} phá sản!`);
      return;
    }

    const alive = this.getAlivePlayers();
    if (alive.length <= 1) {
      this.clearAuctionTimer();
      this.state.auctionQueue = [];
      this.state.phase = 'GAME_OVER';
      this.state.winnerId = alive[0]?.id || null;
      this.log(`🏆 CHÚC MỪNG ${alive[0]?.name} TRỞ THÀNH TỶ PHÚ CHIẾN THẮNG CUỐI CÙNG!`);
      return;
    }

    // Nếu có hàng đợi đấu giá đất thu hồi của Ngân hàng thì mở đấu giá ngay
    if (this.state.auctionQueue.length > 0) {
      const firstTile = this.state.auctionQueue.shift();
      this.startAuction(firstTile);
      return;
    }

    this.advanceToNextPlayer();
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
    const total = this.state.players.length;
    for (let step = 1; step <= total; step++) {
      const nextIdx = (this.state.activePlayerIndex + step) % total;
      if (!this.state.players[nextIdx].isBankrupt) {
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
    let netWorth = player.cash;
    for (const tile of this.state.board) {
      if (tile.ownerId === playerId) {
        if (tile.isMortgaged) {
          netWorth += Math.floor((tile.price || 0) * 0.5);
        } else {
          netWorth += (tile.price || 0);
        }
        if (tile.level > 0 && tile.buildCost) {
          netWorth += tile.level * tile.buildCost;
        }
      }
    }
    return netWorth;
  }

  finishGameByNetWorth(reason) {
    this.state.phase = 'GAME_OVER';
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
    if (this.state.logs.length > 60) this.state.logs.pop();
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
