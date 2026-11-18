import { GROUP_COLORS, GAME_CONSTANTS } from '../data/boardData.js';
import {
  canBuildHouseState,
  canSellHouseState,
  canMortgageTileState,
  canUnmortgageTileState,
  isTileTradableState,
  calculateNetWorthState
} from '../core/stateRules.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class UIManager {
  constructor(rootElement, handlers) {
    this.root = rootElement;
    this.handlers = handlers; // { onAction, onSetupGame, onToggleSound, isFirebaseAvailable }
    this.state = null;
    this.networkInfo = { mode: 'NONE', roomId: null, myPlayerId: null, isHost: false };
    this.interactiveLocked = false;
    this.inspectedTileIndex = null;
    this.showPortfolioModal = false;
    this.showTradeModal = false;
    this.showRulesModal = false;
    this.tradePartnerId = null;
    this.localAuctionBidderId = null;
    this.displayedCash = new Map();
    this.auctionTrackKey = null;
    this.auctionResetTimestamp = 0;
    this.auctionInterval = null;

    this.buildStaticShell();
    this.startTimers();
  }

  setNetworkContext(info) {
    this.networkInfo = { ...this.networkInfo, ...info };
    if (this.state) this.renderHUD(this.state);
  }

  setInteractiveLock(locked) {
    this.interactiveLocked = locked;
    const centerCtrl = this.root.querySelector('#center-turn-controls');
    if (centerCtrl) {
      centerCtrl.style.opacity = locked ? '0.5' : '1';
      centerCtrl.style.pointerEvents = locked ? 'none' : 'auto';
    }
  }

  // Xác định ID người chơi đang thao tác trên trình duyệt này (hỗ trợ cả Local Pass-and-Play)
  getEffectivePlayerId(state = this.state) {
    if (!state) return null;
    if (this.networkInfo.mode === 'LOCAL') {
      const active = state.players[state.activePlayerIndex];
      return active && !active.isAI ? active.id : null;
    }
    return this.networkInfo.myPlayerId;
  }

  buildStaticShell() {
    this.root.innerHTML = `
      <!-- Thanh Top Bar -->
      <header id="top-bar" class="ui-interactive hidden w-full h-12 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 flex items-center justify-between text-xs font-semibold">
        <div class="flex items-center gap-3">
          <button id="btn-copy-room" class="px-3 py-1 rounded bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-mono hover:bg-emerald-600/30 transition">
            Mã Phòng: <span id="lbl-room-id">LOCAL</span>
          </button>
          <span id="lbl-game-mode" class="px-2.5 py-1 rounded bg-slate-800 text-slate-300">Chế độ: Tiêu chuẩn</span>
          <span id="lbl-speed-timer" class="hidden px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono">45:00</span>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-sound-toggle" class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition">🔊 Âm thanh</button>
          <button id="btn-rules" class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition">📖 Luật Chơi</button>
        </div>
      </header>

      <!-- Bố cục 3 cột chính -->
      <div id="hud-grid" class="hidden w-full h-[calc(100vh-3rem)] flex justify-between p-3 gap-3">
        <!-- Cột Trái: HUD P1, P3 & Cụm nút Quản lý -->
        <aside class="w-64 xl:w-72 flex flex-col justify-between gap-3">
          <div class="flex flex-col gap-3">
            <div id="hud-slot-0" class="ui-interactive"></div>
            <div id="hud-slot-2" class="ui-interactive"></div>
          </div>
          <div id="left-action-panel" class="ui-interactive bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
            <button id="btn-open-trade" class="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none font-bold text-xs transition">🤝 Giao Dịch Tài Sản</button>
            <button id="btn-open-portfolio" class="w-full py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:pointer-events-none font-bold text-xs transition">🏘️ Quản Lý Đất & Nhà</button>
            <button id="btn-declare-bankrupt" class="w-full py-2 px-3 rounded-lg bg-rose-700/80 hover:bg-rose-600 disabled:opacity-40 disabled:pointer-events-none font-bold text-xs transition">🏳️ Báo Phá Sản</button>
          </div>
        </aside>

        <!-- Cột Giữa: Nút điều khiển trung tâm nằm trên sân bàn cờ -->
        <main class="flex-1 relative flex items-center justify-center">
          <div id="center-turn-controls" class="ui-interactive absolute top-[64%] flex flex-col items-center gap-2"></div>
        </main>

        <!-- Cột Phải: HUD P2, P4 & Nhật ký sự kiện -->
        <aside class="w-64 xl:w-72 flex flex-col justify-between gap-3">
          <div class="flex flex-col gap-3">
            <div id="hud-slot-1" class="ui-interactive"></div>
            <div id="hud-slot-3" class="ui-interactive"></div>
          </div>
          <div class="ui-interactive bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-3 h-56 flex flex-col">
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">📜 Nhật Ký Sự Kiện</div>
            <div id="event-log-list" class="flex-1 overflow-y-auto space-y-1.5 text-xs text-slate-200 pr-1 font-medium"></div>
          </div>
        </aside>
      </div>

      <!-- Vùng chứa Phòng chờ & Các Modal động -->
      <div id="lobby-layer" class="ui-interactive"></div>
      <div id="modal-layer" class="ui-interactive"></div>
      <div id="card-modal-layer" class="ui-interactive"></div>
    `;

    this.bindStaticEvents();
    this.renderInitialMenu();
  }

  bindStaticEvents() {
    this.root.querySelector('#btn-copy-room').addEventListener('click', () => {
      if (this.networkInfo.roomId) {
        navigator.clipboard?.writeText(this.networkInfo.roomId);
      }
    });

    this.root.querySelector('#btn-sound-toggle').addEventListener('click', (e) => {
      const enabled = this.handlers.onToggleSound();
      e.currentTarget.textContent = enabled ? '🔊 Âm thanh' : '🔇 Tắt tiếng';
    });

    this.root.querySelector('#btn-rules').addEventListener('click', () => {
      this.showRulesModal = true;
      if (this.state) this.renderModals(this.state);
    });

    this.root.querySelector('#btn-open-portfolio').addEventListener('click', () => {
      this.showPortfolioModal = true;
      if (this.state) this.renderModals(this.state);
    });

    this.root.querySelector('#btn-open-trade').addEventListener('click', () => {
      this.showTradeModal = true;
      if (this.state) this.renderModals(this.state);
    });

    this.root.querySelector('#btn-declare-bankrupt').addEventListener('click', () => {
      const myId = this.getEffectivePlayerId();
      if (!myId) return;
      if (confirm('Bạn chắc chắn muốn tuyên bố Phá Sản và dừng cuộc chơi?')) {
        this.handlers.onAction('DECLARE_BANKRUPTCY', {}, myId);
      }
    });
  }

  // ==================== 1. MÀN HÌNH KHỞI TẠO & PHÒNG CHỜ (LOBBY) ====================

  renderInitialMenu() {
    const fbReady = this.handlers.isFirebaseAvailable();
    const lobby = this.root.querySelector('#lobby-layer');
    lobby.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-30">
        <div class="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5">
          <div class="text-center space-y-1">
            <div class="text-2xl font-extrabold text-emerald-400 tracking-tight">CỜ TỶ PHÚ VIỆT NAM</div>
            <p class="text-xs text-slate-400">2D Hybrid Phaser 3 &bull; Multiplayer Serverless</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Tên của bạn</label>
              <input id="inp-player-name" type="text" maxlength="18" value="Tỷ Phú Việt"
                class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Phương thức kết nối</label>
              <select id="sel-net-type" class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white">
                <option value="LOCAL">🎮 Chơi trên 1 máy / Đấu với AI Bot (Local)</option>
                <option value="PEERJS">⚡ Tạo / Vào Phòng Online P2P (PeerJS - 0 cấu hình)</option>
                <option value="FIREBASE" ${fbReady ? '' : 'disabled'}>☁️ Phòng Online Cloud (Firebase ${fbReady ? 'Sẵn sàng' : '- Chưa cấu hình .env'})</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button id="btn-create-room" class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white shadow-lg transition">
              🏠 Tạo Phòng Mới
            </button>
            <div class="flex gap-2">
              <input id="inp-room-code" type="text" placeholder="Mã VN-1234"
                class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-mono uppercase text-white" />
              <button id="btn-join-room" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white whitespace-nowrap transition">
                Vào
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    lobby.querySelector('#btn-create-room').addEventListener('click', () => {
      const name = lobby.querySelector('#inp-player-name').value.trim() || 'Người chơi 1';
      const netType = lobby.querySelector('#sel-net-type').value;
      this.handlers.onSetupGame({ action: 'CREATE', netType, playerName: name });
    });

    lobby.querySelector('#btn-join-room').addEventListener('click', () => {
      const name = lobby.querySelector('#inp-player-name').value.trim() || 'Khách';
      const netType = lobby.querySelector('#sel-net-type').value;
      const roomCode = lobby.querySelector('#inp-room-code').value.trim().toUpperCase();
      if (netType === 'LOCAL') {
        alert('Chế độ Local không cần nhập mã phòng. Hãy bấm "Tạo Phòng Mới"!');
        return;
      }
      if (!roomCode) {
        alert('Vui lòng nhập Mã Phòng (VD: VN-8392)!');
        return;
      }
      this.handlers.onSetupGame({ action: 'JOIN', netType, roomCode, playerName: name });
    });
  }

  renderWaitingLobby(state) {
    const lobby = this.root.querySelector('#lobby-layer');
    const isHost = this.networkInfo.isHost || this.networkInfo.mode === 'LOCAL';
    const canAddMore = state.players.length < 4;
    const canStart = state.players.length >= 2;

    lobby.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-30">
        <div class="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div class="text-lg font-extrabold text-white">PHÒNG CHỜ TỶ PHÚ</div>
              <div class="text-xs text-slate-400">Chế độ mạng: ${escapeHtml(this.networkInfo.mode)}</div>
            </div>
            <div class="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 font-mono font-bold text-emerald-300 text-sm">
              ${escapeHtml(this.networkInfo.roomId || state.roomId)}
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-bold text-slate-400 uppercase">Người chơi (${state.players.length}/4)</div>
            ${state.players.map(p => `
              <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700">
                <div class="flex items-center gap-2.5">
                  <span class="w-3.5 h-3.5 rounded-full inline-block" style="background:${p.color}"></span>
                  <span class="font-bold text-sm text-white">${escapeHtml(p.name)}</span>
                  <span class="text-xs text-slate-400">(${escapeHtml(p.avatar)})</span>
                </div>
                <span class="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">${p.isAI ? '🤖 AI Bot' : p.id}</span>
              </div>
            `).join('')}
          </div>

          ${isHost ? `
            <div class="space-y-3 pt-2 border-t border-slate-800">
              <div class="flex gap-2">
                ${this.networkInfo.mode === 'LOCAL' && canAddMore ? `
                  <button id="btn-add-human" class="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 transition">
                    ➕ Thêm Người Chơi
                  </button>
                ` : ''}
                ${canAddMore ? `
                  <button id="btn-add-bot" class="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-amber-300 transition">
                    🤖 Thêm Máy (AI)
                  </button>
                ` : ''}
              </div>

              <div class="flex items-center justify-between gap-3">
                <select id="sel-game-mode" class="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-white">
                  <option value="CLASSIC" ${state.mode === 'CLASSIC' ? 'selected' : ''}>🏆 Tiêu chuẩn (Đến người cuối cùng)</option>
                  <option value="SPEED" ${state.mode === 'SPEED' ? 'selected' : ''}>⚡ Chơi nhanh (45 Phút / Đua Tài Sản)</option>
                </select>
                <button id="btn-start-match" ${canStart ? '' : 'disabled'}
                  class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-extrabold text-sm text-white transition">
                  BẮT ĐẦU VÁN ĐẤU
                </button>
              </div>
            </div>
          ` : `
            <div class="text-center text-xs text-amber-300 py-2 animate-pulse">
              Đang chờ Chủ phòng (P1) bắt đầu ván đấu...
            </div>
          `}
        </div>
      </div>
    `;

    lobby.querySelector('#btn-add-human')?.addEventListener('click', () => {
      const nextIdx = state.players.length + 1;
      const name = prompt('Nhập tên người chơi mới:', `Người chơi ${nextIdx}`);
      if (name) {
        this.handlers.onAction('JOIN_GAME', { name: name.trim(), isAI: false }, `P${nextIdx}`);
      }
    });

    lobby.querySelector('#btn-add-bot')?.addEventListener('click', () => {
      const nextIdx = state.players.length + 1;
      this.handlers.onAction('JOIN_GAME', { name: `Bot Đại Gia ${nextIdx}`, isAI: true }, `P${nextIdx}`);
    });

    lobby.querySelector('#btn-start-match')?.addEventListener('click', () => {
      const mode = lobby.querySelector('#sel-game-mode').value;
      this.handlers.onAction('START_GAME', { mode }, 'P1');
    });
  }

  // ==================== 2. ĐỒNG BỘ HUD 4 GÓC & ĐIỀU KHIỂN TRUNG TÂM ====================

  renderHUD(state) {
    this.state = state;
    const lobbyLayer = this.root.querySelector('#lobby-layer');
    const topBar = this.root.querySelector('#top-bar');
    const hudGrid = this.root.querySelector('#hud-grid');

    if (state.phase === 'LOBBY') {
      topBar.classList.add('hidden');
      hudGrid.classList.add('hidden');
      this.renderWaitingLobby(state);
      return;
    }

    lobbyLayer.innerHTML = '';
    topBar.classList.remove('hidden');
    hudGrid.classList.remove('hidden');

    // Cập nhật Top Bar
    this.root.querySelector('#lbl-room-id').textContent = this.networkInfo.roomId || state.roomId;
    this.root.querySelector('#lbl-game-mode').textContent =
      state.mode === 'SPEED' ? 'Chế độ: Chơi Nhanh 45p' : 'Chế độ: Tiêu Chuẩn';

    // Cập nhật 4 thẻ Người chơi
    for (let i = 0; i < 4; i++) {
      const slot = this.root.querySelector(`#hud-slot-${i}`);
      const player = state.players[i];
      if (!player) {
        slot.innerHTML = '';
        continue;
      }
      slot.innerHTML = this.buildPlayerCardHTML(state, player, i === state.activePlayerIndex);
      this.animateCashDisplay(player.id, player.cash);
    }

    // Cập nhật Nhật ký sự kiện
    const logContainer = this.root.querySelector('#event-log-list');
    logContainer.innerHTML = state.logs
      .map(item => `<div class="border-b border-slate-800/70 pb-1">&gt; ${escapeHtml(item)}</div>`)
      .join('');

    // Cập nhật trạng thái các nút bên trái & trung tâm
    this.renderTurnControls(state);
    this.renderModals(state);
  }

  buildPlayerCardHTML(state, player, isActive) {
    const ownedTiles = state.board.filter(t => t.ownerId === player.id);
    const groups = [...new Set(ownedTiles.map(t => t.group))];
    const prevCash = this.displayedCash.has(player.id) ? this.displayedCash.get(player.id) : player.cash;
    const isMe = player.id === this.networkInfo.myPlayerId;

    return `
      <div class="rounded-xl p-3 bg-slate-900/95 backdrop-blur border-2 transition ${
        isActive ? 'border-emerald-400 shadow-lg shadow-emerald-500/15' : 'border-slate-800'
      } ${player.isBankrupt ? 'opacity-45 grayscale' : ''}">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-3.5 h-3.5 rounded-full shrink-0" style="background:${player.color}"></span>
            <span class="font-extrabold text-sm truncate text-white">${escapeHtml(player.name)}</span>
            ${isMe ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">BẠN</span>' : ''}
          </div>
          <span class="text-[11px] font-mono text-slate-400">${player.id}</span>
        </div>

        <div class="mt-2 flex items-baseline justify-between">
          <span id="cash-val-${player.id}" class="font-mono text-lg font-extrabold ${
            player.cash < 0 ? 'text-rose-400' : 'text-amber-300'
          }">${prevCash}K</span>
          <span class="text-[11px] text-slate-400">
            ${player.isBankrupt ? '💥 Phá Sản' : player.inJail ? `⛓️ Trong Tù (${player.jailTurns}/3)` : `Ô #${player.position}`}
          </span>
        </div>

        <div class="mt-2 flex flex-wrap gap-1 min-h-[18px]">
          ${groups.map(g => {
            const c = GROUP_COLORS[g] || GROUP_COLORS.NONE;
            const count = ownedTiles.filter(t => t.group === g).length;
            return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:${c.primary};color:${c.text}">${escapeHtml(c.label.split(' ')[0])} (${count})</span>`;
          }).join('')}
          ${player.jailFreeCards > 0 ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950">🎫 Ân Xá x${player.jailFreeCards}</span>` : ''}
        </div>
      </div>
    `;
  }

  // Hiệu ứng nhảy số tiền liên tục (Count-up / Count-down)
  animateCashDisplay(playerId, targetCash) {
    const startCash = this.displayedCash.has(playerId) ? this.displayedCash.get(playerId) : targetCash;
    this.displayedCash.set(playerId, targetCash);
    const el = this.root.querySelector(`#cash-val-${playerId}`);
    if (!el || startCash === targetCash) {
      if (el) el.textContent = `${targetCash.toLocaleString('vi-VN')}K`;
      return;
    }

    const duration = 380;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const current = Math.round(startCash + (targetCash - startCash) * progress);
      const node = this.root.querySelector(`#cash-val-${playerId}`);
      if (node) node.textContent = `${current.toLocaleString('vi-VN')}K`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  renderTurnControls(state) {
    const activePlayer = state.players[state.activePlayerIndex];
    const myId = this.getEffectivePlayerId(state);
    const isMyTurn = Boolean(activePlayer && myId === activePlayer.id && !activePlayer.isAI);

    // Khóa/mở cụm nút quản lý cột trái
    const canManage = isMyTurn && (state.phase === 'MANAGEMENT_PHASE' || state.phase === 'BANKRUPTCY_CHECK');
    this.root.querySelector('#btn-open-trade').disabled = !(isMyTurn && state.phase === 'MANAGEMENT_PHASE');
    this.root.querySelector('#btn-open-portfolio').disabled = !canManage;
    this.root.querySelector('#btn-declare-bankrupt').disabled = !isMyTurn;

    const center = this.root.querySelector('#center-turn-controls');
    if (!activePlayer || state.phase === 'GAME_OVER') {
      center.innerHTML = '';
      return;
    }

    if (!isMyTurn) {
      center.innerHTML = `
        <div class="px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-bold text-slate-200 shadow-lg">
          ⏳ Đang chờ lượt của <span style="color:${activePlayer.color}">${escapeHtml(activePlayer.name)}</span>...
        </div>
      `;
      return;
    }

    if (state.phase === 'ROLL_DICE') {
      center.innerHTML = `
        <button id="btn-roll-dice" class="px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-base shadow-xl shadow-emerald-900/50 transition transform active:scale-95">
          🎲 ĐỔ XÚC XẮC
        </button>
      `;
      center.querySelector('#btn-roll-dice').onclick = () => this.handlers.onAction('ROLL_DICE', {}, myId);
    } else if (state.phase === 'JAIL_DECISION') {
      center.innerHTML = `
        <div class="bg-slate-900/95 border border-slate-700 rounded-2xl p-3 flex flex-wrap justify-center gap-2 shadow-2xl">
          <button id="btn-jail-roll" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white">🎲 Đổ Đôi Thử Vận</button>
          <button id="btn-jail-pay" ${activePlayer.cash < GAME_CONSTANTS.JAIL_FINE ? 'disabled' : ''} class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-xs font-extrabold text-white">💸 Nộp Phạt 50K</button>
          ${activePlayer.jailFreeCards > 0 ? `<button id="btn-jail-card" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-extrabold text-white">🎫 Dùng Thẻ Ân Xá</button>` : ''}
        </div>
      `;
      center.querySelector('#btn-jail-roll').onclick = () => this.handlers.onAction('ROLL_DICE', {}, myId);
      center.querySelector('#btn-jail-pay').onclick = () => this.handlers.onAction('JAIL_PAY_FINE', {}, myId);
      center.querySelector('#btn-jail-card')?.addEventListener('click', () => this.handlers.onAction('JAIL_USE_CARD', {}, myId));
    } else if (state.phase === 'MANAGEMENT_PHASE') {
      const isDoubleBonus = state.dice[0] === state.dice[1] && !activePlayer.inJail && !state.escapedJailByDouble && state.doubleCount > 0;
      center.innerHTML = `
        <button id="btn-end-turn" class="px-6 py-2.5 rounded-2xl ${
          isDoubleBonus ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-blue-600 hover:bg-blue-500 text-white'
        } font-extrabold text-sm shadow-xl transition">
          ${isDoubleBonus ? '🎲 ĐỔ TIẾP LƯỢT ĐÔI' : '✅ KẾT THÚC LƯỢT'}
        </button>
      `;
      center.querySelector('#btn-end-turn').onclick = () => this.handlers.onAction('END_TURN', {}, myId);
    } else if (state.phase === 'BANKRUPTCY_CHECK') {
      center.innerHTML = `
        <div class="px-4 py-2 rounded-xl bg-rose-900/95 border border-rose-500 text-xs font-bold text-rose-100 shadow-xl">
          ⚠️ Đang âm tiền (${activePlayer.cash}K)! Hãy mở "Quản Lý Đất & Nhà" để bán nhà/thế chấp.
        </div>
      `;
    } else {
      center.innerHTML = '';
    }
  }

  // ==================== 3. MODAL SỔ ĐỎ, ĐẤU GIÁ, GIAO DỊCH & KẾT THÚC ====================

  openTileInspect(tileIndex) {
    if (!this.state || this.state.phase === 'LOBBY') return;
    this.inspectedTileIndex = tileIndex;
    this.renderModals(this.state);
  }

  renderModals(state) {
    const layer = this.root.querySelector('#modal-layer');

    // 1. Kết thúc ván đấu
    if (state.phase === 'GAME_OVER') {
      const winner = state.players.find(p => p.id === state.winnerId);
      layer.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div class="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div class="text-4xl">🏆</div>
            <div class="text-xl font-extrabold text-amber-300">TÂN TỶ PHÚ VIỆT NAM</div>
            <div class="text-lg font-bold text-white">${escapeHtml(winner?.name || 'Kết thúc ván đấu')}</div>
            <div class="space-y-1.5 text-left bg-slate-800/80 p-3 rounded-xl text-xs">
              ${state.players.map(p => `
                <div class="flex justify-between">
                  <span>${escapeHtml(p.name)}</span>
                  <span class="font-mono font-bold">${p.isBankrupt ? 'Phá sản' : `${calculateNetWorthState(state, p.id)}K`}</span>
                </div>
              `).join('')}
            </div>
            <button onclick="window.location.reload()" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white">
              Chơi Ván Mới
            </button>
          </div>
        </div>
      `;
      return;
    }

    // 2. Sàn Đấu Giá Thời Gian Thực (Bật cho cả 4 người chơi)
    if (state.phase === 'AUCTION_PHASE' && state.auction) {
      layer.innerHTML = this.buildAuctionModalHTML(state);
      this.bindAuctionEvents(state, layer);
      return;
    }

    // 3. Popup chọn Giải chấp ngay hay Giữ thế chấp sau khi nhận đất từ Giao dịch
    const myIdForTransfer = this.networkInfo.mode === 'LOCAL'
      ? state.pendingMortgageTransfers[0]?.playerId
      : this.networkInfo.myPlayerId;
    const pendingTransfer = state.pendingMortgageTransfers.find(t => t.playerId === myIdForTransfer);
    if (pendingTransfer) {
      const tile = state.board[pendingTransfer.tileIndex];
      const player = state.players.find(p => p.id === pendingTransfer.playerId);
      layer.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-40">
          <div class="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
            <div class="text-sm font-extrabold text-amber-300">🏦 Xử Lý Đất Đang Thế Chấp (${escapeHtml(player.name)})</div>
            <p class="text-xs text-slate-300">Bạn vừa nhận <b>${escapeHtml(tile.name)}</b> (đã trừ 10% phí chuyển nhượng). Bạn muốn trả thêm <b>${tile.mortgageValue}K</b> gốc để giải chấp ngay không?</p>
            <div class="flex gap-2">
              <button id="btn-unmort-now" ${player.cash < tile.mortgageValue ? 'disabled' : ''} class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white">Giải Chấp Ngay (-${tile.mortgageValue}K)</button>
              <button id="btn-keep-mort" class="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white">Giữ Thế Chấp</button>
            </div>
          </div>
        </div>
      `;
      layer.querySelector('#btn-unmort-now').onclick = () =>
        this.handlers.onAction('RESOLVE_TRANSFERRED_MORTGAGE', { tileIndex: tile.index, unmortgageNow: true }, player.id);
      layer.querySelector('#btn-keep-mort').onclick = () =>
        this.handlers.onAction('RESOLVE_TRANSFERRED_MORTGAGE', { tileIndex: tile.index, unmortgageNow: false }, player.id);
      return;
    }

    // 4. Popup Phản hồi Đề nghị Giao dịch cho người nhận
    if (state.pendingTrade) {
      const toPlayer = state.players.find(p => p.id === state.pendingTrade.toPlayerId);
      const isRecipient = this.networkInfo.mode === 'LOCAL'
        ? !toPlayer?.isAI
        : this.networkInfo.myPlayerId === state.pendingTrade.toPlayerId;

      if (isRecipient) {
        layer.innerHTML = this.buildIncomingTradeHTML(state, state.pendingTrade);
        layer.querySelector('#btn-accept-trade').onclick = () =>
          this.handlers.onAction('RESPOND_TRADE', { accept: true }, toPlayer.id);
        layer.querySelector('#btn-reject-trade').onclick = () =>
          this.handlers.onAction('RESPOND_TRADE', { accept: false }, toPlayer.id);
        return;
      }
    }

    // 5. Modal Quyết định Mua Đất (TILE_RESOLUTION) hoặc Xem Sổ Đỏ khi click vào ô
    const activePlayer = state.players[state.activePlayerIndex];
    const effectiveId = this.getEffectivePlayerId(state);
    const isBuyingTurn = state.phase === 'TILE_RESOLUTION' && activePlayer && activePlayer.id === effectiveId && !activePlayer.isAI;

    if (isBuyingTurn || this.inspectedTileIndex !== null) {
      const targetIndex = isBuyingTurn ? activePlayer.position : this.inspectedTileIndex;
      const tile = state.board[targetIndex];
      if (tile) {
        layer.innerHTML = this.buildPropertyModalHTML(state, tile, isBuyingTurn);
        this.bindPropertyModalEvents(state, tile, isBuyingTurn, layer);
        return;
      }
    }

    // 6. Modal Quản Lý Danh Mục Đất & Nhà
    if (this.showPortfolioModal) {
      layer.innerHTML = this.buildPortfolioModalHTML(state);
      this.bindPortfolioModalEvents(state, layer);
      return;
    }

    // 7. Modal Tạo Đề Nghị Thương Lượng
    if (this.showTradeModal) {
      layer.innerHTML = this.buildCreateTradeModalHTML(state);
      this.bindCreateTradeEvents(state, layer);
      return;
    }

    // 8. Modal Luật Chơi
    if (this.showRulesModal) {
      layer.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-40">
          <div class="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-3 text-xs text-slate-300">
            <div class="text-base font-extrabold text-white">📖 TÓM TẮT LUẬT CỜ TỶ PHÚ VIỆT NAM</div>
            <ul class="list-disc pl-4 space-y-1.5">
              <li>Vốn khởi điểm: <b>2.000K</b>. Qua ô Khởi Hành nhận lương <b>+200K</b>.</li>
              <li>Từ chối mua đất trống sẽ lập tức mở phiên <b>Đấu Giá công khai 10 giây</b> cho cả 4 người chơi.</li>
              <li>Sở hữu trọn bộ màu không thế chấp được <b>nhân đôi tiền thuê đất trống</b> và mở khóa xây Nhà/Khách sạn theo quy tắc <b>Xây & Bán đồng đều</b>.</li>
              <li>Đổ đôi được đi thêm lượt, nhưng <b>đổ đôi 3 lần liên tiếp</b> sẽ vào thẳng Nhà Tù Côn Đảo.</li>
            </ul>
            <button id="btn-close-rules" class="w-full py-2 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-white">Đóng</button>
          </div>
        </div>
      `;
      layer.querySelector('#btn-close-rules').onclick = () => {
        this.showRulesModal = false;
        this.renderModals(state);
      };
      return;
    }

    layer.innerHTML = '';
  }

  buildPropertyModalHTML(state, tile, isBuyingDecision) {
    const palette = GROUP_COLORS[tile.group] || GROUP_COLORS.NONE;
    const owner = state.players.find(p => p.id === tile.ownerId);
    const myId = this.getEffectivePlayerId(state);
    const myPlayer = state.players.find(p => p.id === myId);
    const canManageNow = myId && tile.ownerId === myId && (state.phase === 'MANAGEMENT_PHASE' || state.phase === 'BANKRUPTCY_CHECK');

    let bodyDetails = '';
    if (tile.type === 'PROPERTY') {
      bodyDetails = `
        <div class="flex justify-between text-xs border-b border-slate-800 pb-2">
          <span class="text-slate-400">Giá mua niêm yết</span>
          <span class="font-mono font-extrabold text-base text-amber-300">${tile.price}K</span>
        </div>
        <div class="space-y-1 text-xs py-1">
          <div class="flex justify-between"><span>Thuê đất trống</span><span class="font-mono font-bold">${tile.rent[0]}K</span></div>
          <div class="flex justify-between text-emerald-300"><span>Độc quyền nhóm màu (x2)</span><span class="font-mono font-bold">${tile.rent[0] * 2}K</span></div>
          <div class="flex justify-between"><span>1 Nhà</span><span class="font-mono">${tile.rent[1]}K</span></div>
          <div class="flex justify-between"><span>2 Nhà</span><span class="font-mono">${tile.rent[2]}K</span></div>
          <div class="flex justify-between"><span>3 Nhà</span><span class="font-mono">${tile.rent[3]}K</span></div>
          <div class="flex justify-between"><span>4 Nhà</span><span class="font-mono">${tile.rent[4]}K</span></div>
          <div class="flex justify-between text-rose-300 font-bold"><span>Khách Sạn</span><span class="font-mono">${tile.rent[5]}K</span></div>
        </div>
        <div class="pt-2 border-t border-slate-800 flex justify-between text-[11px] text-slate-400">
          <span>Xây dựng: <b class="text-white">${tile.buildCost}K/căn</b></span>
          <span>Thế chấp: <b class="text-white">${tile.mortgageValue}K</b></span>
        </div>
      `;
    } else if (tile.type === 'STATION') {
      bodyDetails = `
        <div class="flex justify-between text-xs border-b border-slate-800 pb-2">
          <span>Giá mua niêm yết</span><span class="font-mono font-extrabold text-amber-300">${tile.price}K</span>
        </div>
        <div class="space-y-1 text-xs py-1">
          <div class="flex justify-between"><span>Sở hữu 1 Bến</span><span class="font-mono">25K</span></div>
          <div class="flex justify-between"><span>Sở hữu 2 Bến</span><span class="font-mono">50K</span></div>
          <div class="flex justify-between"><span>Sở hữu 3 Bến</span><span class="font-mono">100K</span></div>
          <div class="flex justify-between font-bold text-emerald-300"><span>Sở hữu 4 Bến</span><span class="font-mono">200K</span></div>
        </div>
        <div class="text-[11px] text-slate-400 pt-2 border-t border-slate-800">Giá trị thế chấp: <b class="text-white">${tile.mortgageValue}K</b></div>
      `;
    } else if (tile.type === 'UTILITY') {
      bodyDetails = `
        <div class="flex justify-between text-xs border-b border-slate-800 pb-2">
          <span>Giá mua niêm yết</span><span class="font-mono font-extrabold text-amber-300">${tile.price}K</span>
        </div>
        <div class="space-y-1.5 text-xs py-1 text-slate-300">
          <p>&bull; Sở hữu 1 Công ty: Tiền thuê = <b>4K &times; Tổng điểm xúc xắc</b>.</p>
          <p>&bull; Sở hữu cả 2 Công ty (EVN & SAWACO): Tiền thuê = <b>10K &times; Tổng điểm xúc xắc</b>.</p>
        </div>
        <div class="text-[11px] text-slate-400 pt-2 border-t border-slate-800">Giá trị thế chấp: <b class="text-white">${tile.mortgageValue}K</b></div>
      `;
    } else {
      bodyDetails = `<p class="text-xs text-slate-300 py-2">Ô sự kiện đặc biệt trên hành trình xuyên Việt.</p>`;
    }

    const unmortgageCost = tile.mortgageValue ? Math.ceil(tile.mortgageValue * 1.1) : 0;

    return `
      <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-40">
        <div class="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
          <div class="p-4 text-center" style="background:${palette.primary};color:${palette.text}">
            <div class="text-[10px] font-semibold uppercase opacity-85">Giấy Chứng Nhận Quyền Sở Hữu Đất</div>
            <div class="text-lg font-extrabold uppercase mt-0.5">${escapeHtml(tile.name)}</div>
          </div>

          <div class="p-5 space-y-3">
            ${owner ? `<div class="text-xs text-center py-1 rounded bg-slate-800">Chủ sở hữu: <b style="color:${owner.color}">${escapeHtml(owner.name)}</b> ${tile.isMortgaged ? '(Đang thế chấp)' : ''}</div>` : ''}
            ${bodyDetails}

            ${isBuyingDecision ? `
              <div class="grid grid-cols-2 gap-2.5 pt-3">
                <button id="btn-buy-now" ${myPlayer && myPlayer.cash >= tile.price ? '' : 'disabled'}
                  class="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-extrabold text-xs text-white transition">
                  MUA NGAY (-${tile.price}K)
                </button>
                <button id="btn-start-auction"
                  class="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 font-extrabold text-xs text-white transition">
                  ĐƯA RA ĐẤU GIÁ
                </button>
              </div>
            ` : `
              ${canManageNow ? `
                <div class="grid grid-cols-2 gap-2 pt-2">
                  ${canBuildHouseState(state, myId, tile.index) ? `<button id="btn-tile-build" class="py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white">🏗️ Xây (+1) -${tile.buildCost}K</button>` : ''}
                  ${canSellHouseState(state, myId, tile.index) ? `<button id="btn-tile-sell" class="py-2 rounded-lg bg-amber-600 text-xs font-bold text-white">🏚️ Bán Nhà +${Math.floor(tile.buildCost * 0.5)}K</button>` : ''}
                  ${canMortgageTileState(state, myId, tile.index) ? `<button id="btn-tile-mort" class="py-2 rounded-lg bg-rose-700 text-xs font-bold text-white">🏦 Thế Chấp +${tile.mortgageValue}K</button>` : ''}
                  ${canUnmortgageTileState(state, myId, tile.index) ? `<button id="btn-tile-unmort" class="py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white">🔓 Chuộc -${unmortgageCost}K</button>` : ''}
                </div>
              ` : ''}
              <button id="btn-close-prop" class="w-full mt-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200">Đóng</button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  bindPropertyModalEvents(state, tile, isBuyingDecision, layer) {
    const myId = this.getEffectivePlayerId(state);
    if (isBuyingDecision) {
      layer.querySelector('#btn-buy-now')?.addEventListener('click', () => {
        this.inspectedTileIndex = null;
        this.handlers.onAction('BUY_PROPERTY', {}, myId);
      });
      layer.querySelector('#btn-start-auction')?.addEventListener('click', () => {
        this.inspectedTileIndex = null;
        this.handlers.onAction('SKIP_PROPERTY', {}, myId);
      });
      return;
    }

    layer.querySelector('#btn-tile-build')?.addEventListener('click', () =>
      this.handlers.onAction('BUILD_HOUSE', { tileIndex: tile.index }, myId));
    layer.querySelector('#btn-tile-sell')?.addEventListener('click', () =>
      this.handlers.onAction('SELL_HOUSE', { tileIndex: tile.index }, myId));
    layer.querySelector('#btn-tile-mort')?.addEventListener('click', () =>
      this.handlers.onAction('MORTGAGE_TILE', { tileIndex: tile.index }, myId));
    layer.querySelector('#btn-tile-unmort')?.addEventListener('click', () =>
      this.handlers.onAction('UNMORTGAGE_TILE', { tileIndex: tile.index }, myId));
    layer.querySelector('#btn-close-prop')?.addEventListener('click', () => {
      this.inspectedTileIndex = null;
      this.renderModals(state);
    });
  }

  // ==================== SÀN ĐẤU GIÁ THỜI GIAN THỰC ====================

  buildAuctionModalHTML(state) {
    const auction = state.auction;
    const tile = state.board[auction.tileIndex];
    const palette = GROUP_COLORS[tile.group] || GROUP_COLORS.NONE;
    const leader = state.players.find(p => p.id === auction.highestBidderId);

    // Reset thanh đếm ngược 10s mỗi khi lô đất hoặc mức giá cao nhất thay đổi
    const key = `${auction.tileIndex}-${auction.highestBid}-${auction.highestBidderId}`;
    if (this.auctionTrackKey !== key) {
      this.auctionTrackKey = key;
      this.auctionResetTimestamp = performance.now();
    }

    // Xác định người đặt giá (hỗ trợ chọn người đặt khi chơi Local nhiều người trên 1 máy)
    const humanCandidates = state.players.filter(p => !p.isBankrupt && !p.isAI);
    if (this.networkInfo.mode === 'LOCAL') {
      if (!this.localAuctionBidderId || !humanCandidates.some(p => p.id === this.localAuctionBidderId)) {
        this.localAuctionBidderId = humanCandidates[0]?.id || null;
      }
    }
    const bidderId = this.networkInfo.mode === 'LOCAL' ? this.localAuctionBidderId : this.networkInfo.myPlayerId;
    const bidder = state.players.find(p => p.id === bidderId);
    const hasFolded = !bidder || bidder.isBankrupt || auction.foldedIds.includes(bidderId);
    const baseBid = auction.highestBid === 0 ? 0 : auction.highestBid;
    const increments = [10, 20, 50];

    return `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-40">
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
          <div class="p-3.5 flex items-center justify-between" style="background:${palette.primary};color:${palette.text}">
            <div>
              <div class="text-[10px] font-bold uppercase opacity-85">🔨 Sàn Đấu Giá Thời Gian Thực</div>
              <div class="text-base font-extrabold uppercase">${escapeHtml(tile.name)}</div>
            </div>
            <div class="text-xs font-mono font-bold px-2.5 py-1 rounded bg-black/25">Giá gốc: ${tile.price}K</div>
          </div>

          <!-- Thanh tiến trình 10 giây màu đỏ -->
          <div class="w-full h-2 bg-slate-800">
            <div id="auction-timer-bar" class="h-full bg-rose-500 transition-all duration-100" style="width:100%"></div>
          </div>

          <div class="p-5 space-y-4 text-center">
            ${this.networkInfo.mode === 'LOCAL' && humanCandidates.length > 1 ? `
              <div class="flex justify-center gap-1.5">
                ${humanCandidates.map(p => `
                  <button data-local-bidder="${p.id}" class="px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    p.id === bidderId ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-slate-700 bg-slate-800 text-slate-400'
                  }">${escapeHtml(p.name)} (${p.cash}K)</button>
                `).join('')}
              </div>
            ` : ''}

            <div class="py-2">
              <div class="text-xs text-slate-400">Giá cao nhất hiện tại</div>
              <div class="font-mono text-4xl font-extrabold text-amber-300 mt-1">${auction.highestBid}K</div>
              <div class="text-xs text-slate-300 mt-1">
                Người dẫn đầu: <b>${leader ? escapeHtml(leader.name) : 'Chưa có ai đặt'}</b>
              </div>
            </div>

            ${hasFolded ? `
              <div class="py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-400">Bạn đã Bỏ Cuộc trong phiên đấu giá này.</div>
            ` : `
              <div class="flex justify-center gap-2">
                ${increments.map(inc => {
                  const nextAmt = baseBid + inc;
                  if (bidder.cash < nextAmt) return '';
                  return `<button data-bid-amount="${nextAmt}" class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-mono font-extrabold text-xs text-white transition">+${inc}K (${nextAmt}K)</button>`;
                }).join('')}
              </div>
              <button id="btn-auction-fold" class="w-full py-2 rounded-xl bg-rose-700/80 hover:bg-rose-600 font-bold text-xs text-white transition">
                🏳️ BỎ CUỘC (FOLD)
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  bindAuctionEvents(state, layer) {
    const bidderId = this.networkInfo.mode === 'LOCAL' ? this.localAuctionBidderId : this.networkInfo.myPlayerId;

    layer.querySelectorAll('[data-local-bidder]').forEach(btn => {
      btn.onclick = () => {
        this.localAuctionBidderId = btn.getAttribute('data-local-bidder');
        this.renderModals(state);
      };
    });

    layer.querySelectorAll('[data-bid-amount]').forEach(btn => {
      btn.onclick = () => {
        const amount = Number(btn.getAttribute('data-bid-amount'));
        this.handlers.onAction('PLACE_BID', { amount }, bidderId);
      };
    });

    layer.querySelector('#btn-auction-fold')?.addEventListener('click', () => {
      this.handlers.onAction('FOLD_AUCTION', {}, bidderId);
    });
  }

  // ==================== QUẢN LÝ DANH MỤC ĐẤT & THƯƠNG LƯỢNG ====================

  buildPortfolioModalHTML(state) {
    const myId = this.getEffectivePlayerId(state);
    const owned = state.board.filter(t => t.ownerId === myId);

    return `
      <div class="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-40">
        <div class="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
          <div class="flex justify-between items-center border-b border-slate-800 pb-2">
            <span class="font-extrabold text-sm text-white">🏘️ QUẢN LÝ BẤT ĐỘNG SẢN CỦA BẠN</span>
            <button id="btn-close-portfolio" class="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300">Đóng</button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            ${owned.length === 0 ? '<div class="text-xs text-slate-400 text-center py-6">Bạn chưa sở hữu lô đất nào.</div>' : owned.map(t => {
              const c = GROUP_COLORS[t.group] || GROUP_COLORS.NONE;
              const unmortCost = Math.ceil((t.mortgageValue || 0) * 1.1);
              return `
                <div class="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-3 h-8 rounded shrink-0" style="background:${c.primary}"></span>
                    <div class="truncate">
                      <div class="text-xs font-bold text-white truncate">${escapeHtml(t.name)}</div>
                      <div class="text-[11px] text-slate-400">
                        ${t.isMortgaged ? 'Đang thế chấp' : t.level === 5 ? '🏨 Khách sạn' : t.level > 0 ? `🏠 ${t.level} Nhà` : 'Đất trống'}
                      </div>
                    </div>
                  </div>
                  <div class="flex gap-1.5 shrink-0">
                    ${canBuildHouseState(state, myId, t.index) ? `<button data-build="${t.index}" class="px-2 py-1 rounded bg-emerald-600 text-[11px] font-bold text-white">+Nhà (-${t.buildCost}K)</button>` : ''}
                    ${canSellHouseState(state, myId, t.index) ? `<button data-sell="${t.index}" class="px-2 py-1 rounded bg-amber-600 text-[11px] font-bold text-white">-Nhà (+${Math.floor(t.buildCost * 0.5)}K)</button>` : ''}
                    ${canMortgageTileState(state, myId, t.index) ? `<button data-mort="${t.index}" class="px-2 py-1 rounded bg-rose-700 text-[11px] font-bold text-white">Thế chấp (+${t.mortgageValue}K)</button>` : ''}
                    ${canUnmortgageTileState(state, myId, t.index) ? `<button data-unmort="${t.index}" class="px-2 py-1 rounded bg-indigo-600 text-[11px] font-bold text-white">Chuộc (-${unmortCost}K)</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  bindPortfolioModalEvents(state, layer) {
    const myId = this.getEffectivePlayerId(state);
    layer.querySelector('#btn-close-portfolio').onclick = () => {
      this.showPortfolioModal = false;
      this.renderModals(state);
    };
    layer.querySelectorAll('[data-build]').forEach(b =>
      b.onclick = () => this.handlers.onAction('BUILD_HOUSE', { tileIndex: Number(b.dataset.build) }, myId));
    layer.querySelectorAll('[data-sell]').forEach(b =>
      b.onclick = () => this.handlers.onAction('SELL_HOUSE', { tileIndex: Number(b.dataset.sell) }, myId));
    layer.querySelectorAll('[data-mort]').forEach(b =>
      b.onclick = () => this.handlers.onAction('MORTGAGE_TILE', { tileIndex: Number(b.dataset.mort) }, myId));
    layer.querySelectorAll('[data-unmort]').forEach(b =>
      b.onclick = () => this.handlers.onAction('UNMORTGAGE_TILE', { tileIndex: Number(b.dataset.unmort) }, myId));
  }

  buildCreateTradeModalHTML(state) {
    const myId = this.getEffectivePlayerId(state);
    const me = state.players.find(p => p.id === myId);
    const partners = state.players.filter(p => !p.isBankrupt && p.id !== myId);
    if (!this.tradePartnerId || !partners.some(p => p.id === this.tradePartnerId)) {
      this.tradePartnerId = partners[0]?.id || null;
    }
    const partner = state.players.find(p => p.id === this.tradePartnerId);
    const myTradable = state.board.filter(t => isTileTradableState(state, myId, t.index));
    const partnerTradable = partner ? state.board.filter(t => isTileTradableState(state, partner.id, t.index)) : [];

    return `
      <div class="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-40">
        <div class="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <span class="font-extrabold text-sm text-white">🤝 THƯƠNG LƯỢNG & GIAO DỊCH TÀI SẢN</span>
            <select id="sel-trade-partner" class="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-white">
              ${partners.map(p => `<option value="${p.id}" ${p.id === this.tradePartnerId ? 'selected' : ''}>Đối tác: ${escapeHtml(p.name)} (${p.cash}K)</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4 text-xs">
            <!-- Cột Trái: Tài sản của bạn -->
            <div class="bg-slate-800/70 rounded-xl p-3 space-y-2.5 border border-slate-700">
              <div class="font-bold text-emerald-300">BÊN ĐỀ NGHỊ (${escapeHtml(me?.name)})</div>
              <div>
                <label class="text-[11px] text-slate-400">Tiền mặt đưa ra (Tối đa ${me?.cash || 0}K)</label>
                <input id="inp-offer-cash" type="number" min="0" max="${Math.max(0, me?.cash || 0)}" value="0"
                  class="w-full mt-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-white" />
              </div>
              <div class="max-h-40 overflow-y-auto space-y-1">
                ${myTradable.length === 0 ? '<div class="text-slate-500">Không có lô đất khả dụng</div>' : myTradable.map(t => `
                  <label class="flex items-center gap-2 py-1">
                    <input type="checkbox" name="offer-prop" value="${t.index}" />
                    <span>${escapeHtml(t.name)} (${t.price}K)</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Cột Phải: Tài sản của đối tác -->
            <div class="bg-slate-800/70 rounded-xl p-3 space-y-2.5 border border-slate-700">
              <div class="font-bold text-amber-300">BÊN ĐỐI TÁC (${escapeHtml(partner?.name || '-')})</div>
              <div>
                <label class="text-[11px] text-slate-400">Tiền mặt yêu cầu (Tối đa ${partner?.cash || 0}K)</label>
                <input id="inp-req-cash" type="number" min="0" max="${Math.max(0, partner?.cash || 0)}" value="0"
                  class="w-full mt-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-white" />
              </div>
              <div class="max-h-40 overflow-y-auto space-y-1">
                ${partnerTradable.length === 0 ? '<div class="text-slate-500">Không có lô đất khả dụng</div>' : partnerTradable.map(t => `
                  <label class="flex items-center gap-2 py-1">
                    <input type="checkbox" name="req-prop" value="${t.index}" />
                    <span>${escapeHtml(t.name)} (${t.price}K)</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="flex gap-2 pt-2">
            <button id="btn-send-trade" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-extrabold text-xs text-white">GỬI ĐỀ NGHỊ GIAO DỊCH</button>
            <button id="btn-cancel-trade" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300">Hủy</button>
          </div>
        </div>
      </div>
    `;
  }

  bindCreateTradeEvents(state, layer) {
    const myId = this.getEffectivePlayerId(state);
    layer.querySelector('#sel-trade-partner')?.addEventListener('change', (e) => {
      this.tradePartnerId = e.target.value;
      this.renderModals(state);
    });
    layer.querySelector('#btn-cancel-trade').onclick = () => {
      this.showTradeModal = false;
      this.renderModals(state);
    };
    layer.querySelector('#btn-send-trade').onclick = () => {
      const offerCash = Number(layer.querySelector('#inp-offer-cash').value || 0);
      const requestCash = Number(layer.querySelector('#inp-req-cash').value || 0);
      const offerProperties = [...layer.querySelectorAll('input[name="offer-prop"]:checked')].map(el => Number(el.value));
      const requestProperties = [...layer.querySelectorAll('input[name="req-prop"]:checked')].map(el => Number(el.value));
      this.showTradeModal = false;
      this.handlers.onAction('CREATE_TRADE', {
        toPlayerId: this.tradePartnerId,
        offerCash,
        requestCash,
        offerProperties,
        requestProperties,
        offerJailCards: 0,
        requestJailCards: 0
      }, myId);
    };
  }

  buildIncomingTradeHTML(state, trade) {
    const fromP = state.players.find(p => p.id === trade.fromPlayerId);
    const toP = state.players.find(p => p.id === trade.toPlayerId);
    const offerNames = trade.offerProperties.map(i => state.board[i]?.name).join(', ') || 'Không có đất';
    const reqNames = trade.requestProperties.map(i => state.board[i]?.name).join(', ') || 'Không có đất';

    return `
      <div class="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-40">
        <div class="w-full max-w-md bg-slate-900 border-2 border-indigo-500 rounded-2xl p-5 space-y-4 shadow-2xl">
          <div class="text-sm font-extrabold text-indigo-300">📩 ĐỀ NGHỊ THƯƠNG LƯỢNG DÀNH CHO ${escapeHtml(toP?.name)}</div>
          <div class="text-xs text-slate-300 space-y-2 bg-slate-800/90 p-3.5 rounded-xl">
            <div><b>${escapeHtml(fromP?.name)} đưa cho bạn:</b> ${trade.offerCash}K + [${escapeHtml(offerNames)}]</div>
            <div><b>Đổi lại bạn đưa:</b> ${trade.requestCash}K + [${escapeHtml(reqNames)}]</div>
          </div>
          <div class="flex gap-2.5">
            <button id="btn-accept-trade" class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-extrabold text-xs text-white">✅ ĐỒNG Ý</button>
            <button id="btn-reject-trade" class="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 font-extrabold text-xs text-white">❌ TỪ CHỐI</button>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== 4. MODAL LẬT THẺ CƠ HỘI / KHÍ VẬN ====================

  showChanceOrCommunityCardModal(deck, card) {
    const cardLayer = this.root.querySelector('#card-modal-layer');
    const isChance = deck === 'CHANCE';
    cardLayer.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl border-2 ${
          isChance ? 'bg-orange-950/95 border-orange-400' : 'bg-sky-950/95 border-sky-400'
        } space-y-3">
          <div class="text-xs font-extrabold uppercase tracking-widest ${isChance ? 'text-orange-300' : 'text-sky-300'}">
            ${isChance ? '❓ THẺ CƠ HỘI' : '🎁 HÒM KHÍ VẬN'}
          </div>
          <div class="text-sm font-bold text-white leading-relaxed py-2">${escapeHtml(card.text)}</div>
          <button id="btn-ack-card" class="px-6 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white">Tiếp tục</button>
        </div>
      </div>
    `;

    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        cardLayer.innerHTML = '';
        resolve();
      };
      cardLayer.querySelector('#btn-ack-card').onclick = finish;
      setTimeout(finish, 2300);
    });
  }

  // ==================== 5. BỘ ĐẾM THỜI GIAN ĐẤU GIÁ 10S & SPEED MODE 45P ====================

  startTimers() {
    this.auctionInterval = setInterval(() => {
      if (!this.state) return;

      // Cập nhật thanh đếm ngược 10s của Sàn đấu giá
      if (this.state.phase === 'AUCTION_PHASE' && this.state.auction) {
        const bar = this.root.querySelector('#auction-timer-bar');
        if (bar) {
          const elapsed = performance.now() - this.auctionResetTimestamp;
          const pct = Math.max(0, 100 - (elapsed / (GAME_CONSTANTS.AUCTION_TIMER_SECONDS * 1000)) * 100);
          bar.style.width = `${pct}%`;
        }
      }

      // Cập nhật đồng hồ 45 phút nếu chơi Speed Mode
      const speedBadge = this.root.querySelector('#lbl-speed-timer');
      if (this.state.mode === 'SPEED' && this.state.startedAt && this.state.phase !== 'LOBBY') {
        speedBadge.classList.remove('hidden');
        const remainSec = Math.max(0, Math.floor((45 * 60 * 1000 - (Date.now() - this.state.startedAt)) / 1000));
        const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
        const ss = String(remainSec % 60).padStart(2, '0');
        speedBadge.textContent = `⏱️ ${mm}:${ss}`;
      } else if (speedBadge) {
        speedBadge.classList.add('hidden');
      }
    }, 100);
  }
}
