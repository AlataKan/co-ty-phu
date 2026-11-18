import { GAME_CONSTANTS } from '../data/boardData.js';
import {
  canBuildHouseState,
  canSellHouseState,
  canMortgageTileState,
  getAllyBailoutInfo
} from './stateRules.js';

export class AIController {
  constructor(dispatchAction) {
    this.dispatch = dispatchAction;
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

      // 2. Xử lý đất thế chấp chuyển nhượng cho AI
      if (state.pendingMortgageTransfers?.length > 0) {
        const pending = state.pendingMortgageTransfers[0];
        const aiReceiver = state.players.find(p => p.id === pending.playerId && p.isAI);
        if (aiReceiver) {
          const tile = state.board[pending.tileIndex];
          const shouldUnmort = aiReceiver.cash >= (tile?.mortgageValue || 0) + 250;
          this.dispatch(aiReceiver.id, 'RESOLVE_TRANSFERRED_MORTGAGE', {
            tileIndex: pending.tileIndex,
            unmortgageNow: shouldUnmort
          });
          return;
        }
      }

      // 3. Tham gia đấu giá nếu có AI chưa bỏ cuộc
      if (state.phase === 'AUCTION_PHASE' && state.auction) {
        const auction = state.auction;
        const tile = state.board[auction.tileIndex];
        const aiBidder = state.players.find(
          p => p.isAI && !p.isBankrupt && !auction.foldedIds.includes(p.id) && p.id !== auction.highestBidderId
        );
        if (aiBidder) {
          const nextBid = auction.highestBid === 0 ? GAME_CONSTANTS.MIN_AUCTION_START : auction.highestBid + 10;
          const maxWilling = Math.floor((tile.price || 100) * 0.88);
          if (nextBid <= maxWilling && aiBidder.cash >= nextBid + 120) {
            this.dispatch(aiBidder.id, 'PLACE_BID', { amount: nextBid });
          } else {
            this.dispatch(aiBidder.id, 'FOLD_AUCTION', {});
          }
        }
        return;
      }

      // 4. Nếu đồng đội đang âm tiền (BANKRUPTCY_CHECK) và người đồng đội là AI đủ tiền cứu trợ
      const active = state.players[state.activePlayerIndex];
      if (!active || active.isBankrupt) return;

      if (state.phase === 'BANKRUPTCY_CHECK') {
        const bailout = getAllyBailoutInfo(state, active.id);
        if (bailout) {
          const ally = state.players.find(p => p.id === bailout.allyId);
          if (ally?.isAI && ally.cash >= bailout.amount + 150) {
            this.dispatch(ally.id, 'ALLY_BAILOUT', {});
            return;
          }
        }
      }

      // 5. Xử lý lượt chính của AI đang giữ lượt
      if (!active.isAI) return;

      switch (state.phase) {
        case 'JAIL_DECISION':
          if (active.jailFreeCards > 0) this.dispatch(active.id, 'JAIL_USE_CARD', {});
          else if (active.cash >= 250) this.dispatch(active.id, 'JAIL_PAY_FINE', {});
          else this.dispatch(active.id, 'ROLL_DICE', {});
          break;

        case 'ROLL_DICE':
          this.dispatch(active.id, 'ROLL_DICE', {});
          break;

        case 'BUS_DECISION': {
          const stIdx = state.busTargets?.stationIndex;
          const stTile = stIdx !== null && stIdx !== undefined ? state.board[stIdx] : null;
          if (stTile && !stTile.ownerId && active.cash >= (stTile.price || 200) + 100) {
            this.dispatch(active.id, 'USE_SPEED_BUS', { targetIndex: stIdx });
          } else if (state.busTargets?.cardIndex !== null && state.busTargets?.cardIndex !== undefined && active.cash >= 300) {
            this.dispatch(active.id, 'USE_SPEED_BUS', { targetIndex: state.busTargets.cardIndex });
          } else {
            this.dispatch(active.id, 'SKIP_SPEED_BUS', {});
          }
          break;
        }

        case 'TILE_RESOLUTION': {
          const tile = state.board[active.position];
          if (tile && active.cash >= (tile.price || 0) + 100) {
            this.dispatch(active.id, 'BUY_PROPERTY', {});
          } else {
            this.dispatch(active.id, 'SKIP_PROPERTY', {});
          }
          break;
        }

        case 'BANKRUPTCY_CHECK': {
          const bailout = getAllyBailoutInfo(state, active.id);
          if (bailout) {
            const ally = state.players.find(p => p.id === bailout.allyId);
            if (ally?.isAI) {
              this.dispatch(active.id, 'ALLY_BAILOUT', {});
              return;
            }
          }
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
            t => canBuildHouseState(state, active.id, t.index) && active.cash >= (t.buildCost || 0) + 220
          );
          if (buildable) {
            this.dispatch(active.id, 'BUILD_HOUSE', { tileIndex: buildable.index });
          } else {
            this.dispatch(active.id, 'END_TURN', {});
          }
          break;
        }
      }
    }, 580);
  }
}
