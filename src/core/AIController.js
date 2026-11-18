import { GAME_CONSTANTS } from '../data/boardData.js';
import { canBuildHouseState, canSellHouseState, canMortgageTileState } from './stateRules.js';

export class AIController {
  constructor(dispatchAction) {
    this.dispatch = dispatchAction; // (playerId, action, payload) => void
    this.timer = null;
  }

  evaluate(state) {
    clearTimeout(this.timer);
    if (!state || state.phase === 'LOBBY' || state.phase === 'GAME_OVER') return;

    this.timer = setTimeout(() => {
      // 1. Phản hồi giao dịch nếu đối tác là AI
      if (state.pendingTrade) {
        const target = state.players.find(p => p.id === state.pendingTrade.toPlayerId);
        if (target?.isAI) {
          const offerVal = state.pendingTrade.offerCash +
            state.pendingTrade.offerProperties.reduce((s, idx) => s + (state.board[idx]?.price || 0), 0);
          const reqVal = state.pendingTrade.requestCash +
            state.pendingTrade.requestProperties.reduce((s, idx) => s + (state.board[idx]?.price || 0), 0);
          this.dispatch(target.id, 'RESPOND_TRADE', { accept: offerVal >= reqVal });
          return;
        }
      }

      // 2. Tham gia đấu giá nếu có AI chưa bỏ cuộc
      if (state.phase === 'AUCTION_PHASE' && state.auction) {
        const auction = state.auction;
        const tile = state.board[auction.tileIndex];
        const aiBidder = state.players.find(
          p => p.isAI && !p.isBankrupt && !auction.foldedIds.includes(p.id) && p.id !== auction.highestBidderId
        );
        if (aiBidder) {
          const nextBid = auction.highestBid === 0 ? GAME_CONSTANTS.MIN_AUCTION_START : auction.highestBid + 10;
          const maxWilling = Math.floor((tile.price || 100) * 0.85);
          if (nextBid <= maxWilling && aiBidder.cash >= nextBid + 120) {
            this.dispatch(aiBidder.id, 'PLACE_BID', { amount: nextBid });
          } else {
            this.dispatch(aiBidder.id, 'FOLD_AUCTION', {});
          }
        }
        return;
      }

      // 3. Xử lý lượt chính của AI đang giữ lượt
      const active = state.players[state.activePlayerIndex];
      if (!active || !active.isAI || active.isBankrupt) return;

      switch (state.phase) {
        case 'JAIL_DECISION':
          if (active.jailFreeCards > 0) this.dispatch(active.id, 'JAIL_USE_CARD', {});
          else if (active.cash >= 250) this.dispatch(active.id, 'JAIL_PAY_FINE', {});
          else this.dispatch(active.id, 'ROLL_DICE', {});
          break;

        case 'ROLL_DICE':
          this.dispatch(active.id, 'ROLL_DICE', {});
          break;

        case 'TILE_RESOLUTION': {
          const tile = state.board[active.position];
          if (tile && active.cash >= (tile.price || 0) + 120) {
            this.dispatch(active.id, 'BUY_PROPERTY', {});
          } else {
            this.dispatch(active.id, 'SKIP_PROPERTY', {});
          }
          break;
        }

        case 'BANKRUPTCY_CHECK': {
          const sellable = state.board.find(t => canSellHouseState(state, active.id, t.index));
          if (sellable) {
            this.dispatch(active.id, 'SELL_HOUSE', { tileIndex: sellable.index });
            return;
          }
          const mortgageable = state.board.find(t => canMortgageTileState(state, active.id, t.index));
          if (mortgageable) {
            this.dispatch(active.id, 'MORTGAGE_TILE', { tileIndex: mortgageable.index });
            return;
          }
          this.dispatch(active.id, 'DECLARE_BANKRUPTCY', {});
          break;
        }

        case 'MANAGEMENT_PHASE': {
          const buildable = state.board.find(
            t => canBuildHouseState(state, active.id, t.index) && active.cash >= (t.buildCost || 0) + 250
          );
          if (buildable) {
            this.dispatch(active.id, 'BUILD_HOUSE', { tileIndex: buildable.index });
          } else {
            this.dispatch(active.id, 'END_TURN', {});
          }
          break;
        }
      }
    }, 650);
  }
}
