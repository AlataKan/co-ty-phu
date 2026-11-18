import { GROUP_COLORS, GAME_CONSTANTS, PLAYER_PRESETS } from '../data/boardData.js';
import { ALLIANCE_TEAMS, getAllianceForPlayer } from '../data/boardData52.js';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../data/cardDecks.js';
import {
  areTeammates,
  ownsFullGroupUnmortgaged,
  hasJointVenture2Of3,
  getMaxAllowedBuildLevel,
  getTileRentInfo,
  canBuildHouseState,
  canSellHouseState,
  canMortgageTileState,
  canUnmortgageTileState,
  isTileTradableState,
  getTransitTeleportInfo,
  getAllyBailoutInfo,
  calculateNetWorthState
} from '../core/stateRules.js';
import { createMiniPipDieHTML, createMiniSpeedDieHTML, renderMiniDicePairHTML } from './dicePips.js';

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
    // handlers: { onAction, onSetupGame, onToggleSound, onSetCamera, onSelectTile, onPreviewBoardPreset, isFirebaseAvailable }
    this.handlers = handlers;
    this.state = null;
    this.networkInfo = { mode: 'NONE', roomId: null, myPlayerId: null, isHost: false };
    this.cameraMode = 'isometric';
    this.interactiveLocked = false;
    this.inspectedTileIndex = 39;
    this.selectedMenuPreset = 'MEGA_52'; // Mặc định nổi bật chế độ mở rộng hoặc cho chọn

    this.pendingLandingSummary = null;
    this.eventPopupCollapsed = false;
    this.lastPopupSignature = null;
    this.logCollapsed = false;
    this.inspectorCollapsed = false;

    this.showPortfolioModal = false;
    this.showTradeModal = false;
    this.showTransitModal = false;
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
    const ctrlBox = this.root.querySelector('#left-turn-box');
    if (ctrlBox) {
      ctrlBox.style.opacity = locked ? '0.6' : '1';
      ctrlBox.style.pointerEvents = locked ? 'none' : 'auto';
    }
  }

  getInspectedTileIndex(state = this.state) {
    const maxIdx = (state?.board?.length || 40) - 1;
    if (this.inspectedTileIndex !== null && this.inspectedTileIndex !== undefined) {
      return Math.min(maxIdx, Math.max(0, this.inspectedTileIndex));
    }
    const active = state?.players?.[state.activePlayerIndex];
    return active ? active.position : maxIdx;
  }

  setInspectedTile(tileIndex, shouldRender = true) {
    this.inspectedTileIndex = tileIndex;
    this.handlers.onSelectTile?.(tileIndex);
    if (shouldRender && this.state && this.state.phase !== 'LOBBY') {
      this.renderInspector(this.state);
    }
  }

  openTileInspect(tileIndex) {
    if (!this.state || this.state.phase === 'LOBBY') return;
    if (this.inspectorCollapsed) {
      this.inspectorCollapsed = false;
      this.syncRightPanelsCollapse();
    }
    this.setInspectedTile(tileIndex, true);
  }

  isLocalHumanPlayer(playerId, state = this.state) {
    if (!state || !playerId) return false;
    const p = state.players.find(item => item.id === playerId);
    if (!p || p.isAI || p.isBankrupt) return false;
    if (this.networkInfo.mode === 'LOCAL') return true;
    return playerId === this.networkInfo.myPlayerId;
  }

  getEffectivePlayerId(state = this.state) {
    if (!state) return null;
    if (this.networkInfo.mode === 'LOCAL') {
      const active = state.players[state.activePlayerIndex];
      return active && !active.isAI ? active.id : null;
    }
    return this.networkInfo.myPlayerId;
  }

  // ==================== KHUNG GIAO DIỆN TĨNH (HEADER + COMPACT TRÁI/PHẢI) ====================

  buildStaticShell() {
    this.root.innerHTML = `
      <!-- 1. THANH ĐIỀU KHIỂN GÓC NHÌN 3D & CHÚ THÍCH KÝ HIỆU CHUẨN HÓA -->
      <header id="top-bar" class="hidden fixed top-2.5 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <!-- Trái: Mã Phòng & Chú thích ký hiệu chuẩn hóa -->
        <div class="flex items-center gap-2.5 bg-slate-900/85 backdrop-blur-md border border-slate-700/70 px-3 py-1.5 rounded-xl shadow-xl ui-interactive">
          <button id="btn-copy-room" title="Bấm để sao chép Mã Phòng" class="flex items-center gap-1.5 pr-2.5 border-r border-slate-700 hover:opacity-85 transition">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span class="text-[11px] font-bold tracking-wider uppercase text-slate-300">
              Phòng: <strong id="lbl-room-id" class="text-amber-400 mono-num">LOCAL</strong>
            </span>
          </button>

          <span id="lbl-board-badge" class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 text-[10px] font-extrabold">
            52 Ô
          </span>

          <span id="lbl-speed-timer" class="hidden px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] mono-num font-bold">
            ⏱️ 45:00
          </span>

          <div class="hidden xl:flex items-center gap-2.5 text-[11px] font-semibold text-slate-300">
            <span title="Giá mua đất trống"><b class="text-amber-400 mono-num">K</b> Mua</span>
            <span title="Tiền thuê phải trả khi dừng chân"><b class="text-rose-400">⚡</b> Thuê</span>
            <span title="Nhà phố 3D (Tối đa 4 căn)"><b class="text-emerald-400">🏠</b> Nhà</span>
            <span title="Khách sạn cấp 5"><b class="text-rose-500">🏨</b> K.Sạn</span>
            <span title="Siêu Quần Thể Landmark cấp 6"><b class="text-sky-400">🏙️</b> L.Mark</span>
            <span title="Độc quyền bộ màu (x2) / Liên doanh 2/3"><b class="text-purple-400">👑</b> Bộ</span>
            <span title="Đất đang cầm cố ngân hàng"><b class="text-slate-400">🔒</b> Cầm</span>
          </div>
        </div>

        <!-- Phải: Cụm nút Camera 3D + Âm thanh + Luật chơi -->
        <div class="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/70 p-1 rounded-xl shadow-xl ui-interactive">
          <button data-cam="isometric" id="cam-iso" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 text-slate-950 transition">
            📐 3D Nghiêng
          </button>
          <button data-cam="tilt" id="cam-tilt" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 transition">
            🎥 Chính Diện
          </button>
          <button data-cam="top" id="cam-top" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 transition">
            🗺️ Phẳng 2D
          </button>
          <span class="w-px h-4 bg-slate-700 mx-0.5"></span>
          <button id="btn-sound-toggle" title="Bật / Tắt âm thanh" class="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-200 hover:bg-slate-800 transition">
            🔊
          </button>
          <button id="btn-rules" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-200 hover:bg-slate-800 transition">
            📖 Luật
          </button>
          <button id="btn-leave-room" title="Rời khỏi phòng về màn hình chính" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-600/85 hover:bg-rose-500 text-white transition">
            🚪 Rời Phòng
          </button>
        </div>
      </header>

      <!-- 2. CỘT TRÁI COMPACT (W-52): THẺ MINI 4-6 NGƯỜI CHƠI & ĐIỀU KHIỂN LƯỢT -->
      <aside id="left-hud-aside" class="hidden fixed left-3 top-14 bottom-3 w-48 lg:w-52 z-20 flex flex-col justify-between gap-1.5 pointer-events-none">
        <div id="players-hud-container" class="space-y-1 ui-interactive overflow-y-auto pr-0.5"></div>

        <!-- Bảng điều khiển lượt đi & Quản lý nhanh -->
        <div id="left-turn-box" class="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-2 rounded-xl shadow-xl ui-interactive space-y-1.5">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-400 font-medium">Lượt đi:</span>
            <span id="turn-indicator" class="font-extrabold text-amber-400 truncate max-w-[120px]">---</span>
          </div>

          <!-- Cặp xúc xắc chấm tròn Mini + Xúc xắc Tốc độ thứ 3 -->
          <div class="flex items-center justify-between bg-slate-950/75 px-2 py-1 rounded-lg border border-slate-800">
            <span class="text-[10px] text-slate-400 font-semibold">Xúc xắc:</span>
            <div id="hud-dice-pips" class="flex items-center gap-1">
              ${renderMiniDicePairHTML(1, 6, true, null)}
            </div>
          </div>

          <!-- Khu vực nút hành động chính theo Phase -->
          <div id="turn-primary-actions" class="space-y-1"></div>

          <!-- Cụm nút Quản lý Tài sản / Giao dịch / Phá sản -->
          <div class="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800">
            <button id="btn-open-portfolio" title="Quản lý xây nhà, bán nhà & thế chấp" class="py-1.5 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-[10px] font-bold text-slate-200 transition">
              🏘️ Đất/Nhà
            </button>
            <button id="btn-open-trade" title="Thương lượng & trao đổi với người chơi khác" class="py-1.5 px-1 rounded-lg bg-indigo-600/85 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-[10px] font-bold text-white transition">
              🤝 Đổi Đất
            </button>
            <button id="btn-declare-bankrupt" title="Tuyên bố phá sản" class="py-1.5 px-1 rounded-lg bg-rose-800/80 hover:bg-rose-700 disabled:opacity-40 disabled:pointer-events-none text-[10px] font-bold text-rose-100 transition">
              🏳️ Bỏ Cuộc
            </button>
          </div>
        </div>
      </aside>

      <!-- 3. CỘT PHẢI COMPACT (W-56): THẺ SỔ ĐỎ CHI TIẾT & NHẬT KÝ TRỰC TIẾP (CÓ THỂ THU GỌN) -->
      <aside id="right-hud-aside" class="hidden fixed right-3 top-14 bottom-3 w-52 lg:w-56 z-20 flex flex-col justify-between gap-2 pointer-events-none">
        <!-- Thẻ Sổ Đỏ Chi Tiết -->
        <div id="property-inspector" class="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl overflow-hidden shadow-xl ui-interactive">
          <div id="inspector-header" class="px-3 py-2 bg-amber-600 text-white transition-colors cursor-pointer" title="Bấm để thu gọn / mở rộng Sổ đỏ">
            <div class="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider opacity-95">
              <span id="inspector-group" class="truncate pr-1">NHÓM ĐỊA DANH</span>
              <div class="flex items-center gap-1 shrink-0">
                <span id="inspector-id">#39</span>
                <button id="btn-toggle-inspector" type="button" class="px-1 py-0.2 rounded bg-black/25 hover:bg-black/40 text-[9px] leading-none font-black transition" title="Thu gọn / Mở rộng">▾</button>
              </div>
            </div>
            <h2 id="inspector-title" class="text-sm font-extrabold tracking-tight truncate mt-0.5">PHỐ ĐI BỘ NGUYỄN HUỆ</h2>
            <div id="inspector-owner-bar" class="hidden mt-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-black/25 truncate"></div>
          </div>

          <div id="inspector-collapsible-body" class="p-2.5 space-y-2 text-[11px]">
            <div class="grid grid-cols-2 gap-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
              <div>
                <div class="text-[9px] text-slate-400 uppercase font-semibold">Giá Mua</div>
                <div id="inspector-price" class="text-xs font-extrabold text-amber-400 mono-num">---</div>
              </div>
              <div class="border-l border-slate-700 pl-2">
                <div class="text-[9px] text-slate-400 uppercase font-semibold">Thuê Hiện Tại</div>
                <div id="inspector-current-rent" class="text-xs font-extrabold text-rose-400 mono-num">---</div>
              </div>
            </div>

            <div id="inspector-body-rows" class="space-y-0.5 text-[10.5px] text-slate-300 font-medium"></div>

            <div id="inspector-footer-meta" class="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[10px] text-slate-400"></div>

            <div id="inspector-actions" class="space-y-1"></div>
          </div>
        </div>

        <!-- Nhật ký sự kiện thu gọn / mở rộng -->
        <div id="event-log-panel" class="bg-slate-900/85 backdrop-blur-md border border-slate-700/75 p-2.5 rounded-xl shadow-xl ui-interactive h-32 lg:h-36 flex flex-col transition-all">
          <button id="btn-toggle-log" type="button" class="w-full text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between gap-1 hover:text-white transition" title="Thu gọn / Mở rộng Nhật ký sự kiện">
            <span class="shrink-0">📜 Nhật Ký</span>
            <span id="event-log-latest" class="hidden flex-1 text-[9.5px] font-normal normal-case text-slate-400 truncate text-left px-1"></span>
            <span id="lbl-toggle-log" class="text-[9px] text-emerald-400 font-semibold shrink-0">▾ Thu gọn</span>
          </button>
          <div id="event-log-list" class="mt-1.5 flex-1 overflow-y-auto space-y-1 text-[10.5px] pr-1"></div>
        </div>
      </aside>

      <!-- 4. CÁC LỚP PHÒNG CHỜ, EVENT POPUP & MODAL CHỨC NĂNG -->
      <div id="lobby-layer" class="ui-interactive"></div>
      <div id="modal-layer" class="pointer-events-none"></div>
      <div id="card-modal-layer" class="pointer-events-none"></div>
    `;

    this.bindStaticEvents();
    this.renderInitialMenu();
  }

  bindStaticEvents() {
    this.root.querySelector('#btn-copy-room').addEventListener('click', () => {
      const code = this.networkInfo.roomId || this.state?.roomId;
      if (code) {
        navigator.clipboard?.writeText(code);
        const lbl = this.root.querySelector('#lbl-room-id');
        if (lbl) {
          const old = lbl.textContent;
          lbl.textContent = 'ĐÃ CHÉP!';
          setTimeout(() => {
            lbl.textContent = this.networkInfo.roomId || this.state?.roomId || old;
          }, 1100);
        }
      }
    });

    this.root.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-cam');
        this.setCameraButtonsActive(mode);
        this.handlers.onSetCamera?.(mode);
      });
    });

    this.root.querySelector('#btn-sound-toggle').addEventListener('click', (e) => {
      const enabled = this.handlers.onToggleSound?.();
      e.currentTarget.textContent = enabled ? '🔊' : '🔇';
    });

    this.root.querySelector('#btn-rules').addEventListener('click', () => {
      this.showRulesModal = true;
      if (this.state) this.renderModals(this.state);
    });

    this.root.querySelector('#btn-leave-room').addEventListener('click', () => {
      this.requestLeaveRoom();
    });

    this.root.querySelector('#btn-open-portfolio').addEventListener('click', () => {
      this.pendingLandingSummary = null;
      this.showPortfolioModal = true;
      if (this.state) this.renderModals(this.state);
    });

    this.root.querySelector('#btn-open-trade').addEventListener('click', () => {
      this.pendingLandingSummary = null;
      this.showTradeModal = true;
      if (this.state) this.renderModals(this.state);
    });

    this.root.querySelector('#btn-declare-bankrupt').addEventListener('click', () => {
      const myId = this.getEffectivePlayerId();
      if (!myId) return;
      if (confirm('Bạn chắc chắn muốn tuyên bố Phá Sản và dừng cuộc chơi?')) {
        this.pendingLandingSummary = null;
        this.handlers.onAction('DECLARE_BANKRUPTCY', {}, myId);
      }
    });

    this.root.querySelector('#inspector-header')?.addEventListener('click', () => {
      this.inspectorCollapsed = !this.inspectorCollapsed;
      this.syncRightPanelsCollapse();
    });

    this.root.querySelector('#btn-toggle-log')?.addEventListener('click', () => {
      this.logCollapsed = !this.logCollapsed;
      this.syncRightPanelsCollapse();
    });
  }

  syncRightPanelsCollapse() {
    const inspBody = this.root.querySelector('#inspector-collapsible-body');
    const inspBtn = this.root.querySelector('#btn-toggle-inspector');
    if (inspBody) inspBody.classList.toggle('hidden', this.inspectorCollapsed);
    if (inspBtn) inspBtn.textContent = this.inspectorCollapsed ? '▸' : '▾';

    const logPanel = this.root.querySelector('#event-log-panel');
    const logList = this.root.querySelector('#event-log-list');
    const logLatest = this.root.querySelector('#event-log-latest');
    const logLbl = this.root.querySelector('#lbl-toggle-log');
    if (logPanel && logList && logLbl) {
      logList.classList.toggle('hidden', this.logCollapsed);
      logPanel.className = this.logCollapsed
        ? 'bg-slate-900/90 backdrop-blur-md border border-slate-700/75 px-2.5 py-2 rounded-xl shadow-xl ui-interactive flex flex-col transition-all'
        : 'bg-slate-900/85 backdrop-blur-md border border-slate-700/75 p-2.5 rounded-xl shadow-xl ui-interactive h-32 lg:h-36 flex flex-col transition-all';
      logLbl.textContent = this.logCollapsed ? '▴ Mở' : '▾ Thu gọn';
      if (logLatest) {
        logLatest.classList.toggle('hidden', !this.logCollapsed);
      }
    }
  }

  setEventPopupCollapsed(collapsed) {
    this.eventPopupCollapsed = collapsed;
    if (this.state) {
      this.renderTurnControls(this.state);
      this.renderModals(this.state);
    }
  }

  requestLeaveRoom() {
    const isActiveMatch = Boolean(this.state && this.state.phase !== 'LOBBY' && this.state.phase !== 'GAME_OVER');
    if (isActiveMatch && !confirm('Bạn chắc chắn muốn rời khỏi phòng chơi hiện tại?')) {
      return;
    }
    this.handlers.onLeaveRoom?.();
  }

  resetToMenu() {
    this.state = null;
    this.pendingLandingSummary = null;
    this.eventPopupCollapsed = false;
    this.lastPopupSignature = null;
    this.showPortfolioModal = false;
    this.showTradeModal = false;
    this.showTransitModal = false;
    this.showRulesModal = false;
    this.tradePartnerId = null;
    this.localAuctionBidderId = null;
    this.displayedCash.clear();

    this.root.querySelector('#top-bar')?.classList.add('hidden');
    this.root.querySelector('#left-hud-aside')?.classList.add('hidden');
    this.root.querySelector('#right-hud-aside')?.classList.add('hidden');
    const modalLayer = this.root.querySelector('#modal-layer');
    if (modalLayer) modalLayer.innerHTML = '';
    const cardLayer = this.root.querySelector('#card-modal-layer');
    if (cardLayer) cardLayer.innerHTML = '';

    this.renderInitialMenu();
  }

  setCameraButtonsActive(mode) {
    this.cameraMode = mode;
    const map = { isometric: '#cam-iso', tilt: '#cam-tilt', top: '#cam-top' };
    Object.entries(map).forEach(([key, sel]) => {
      const btn = this.root.querySelector(sel);
      if (!btn) return;
      btn.className = key === mode
        ? 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 text-slate-950 transition'
        : 'px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 transition';
    });
  }

  updateMiniDiceHUD(d1, d2, speedDie = null) {
    const hudBox = this.root.querySelector('#hud-dice-pips');
    if (hudBox) {
      hudBox.innerHTML = renderMiniDicePairHTML(d1, d2, true, speedDie);
    }
  }

  // ==================== 1. MÀN HÌNH KHỞI TẠO & PHÒNG CHỜ (4P & 6P MEGA EXPANSION) ====================

  renderInitialMenu() {
    const fbReady = this.handlers.isFirebaseAvailable();
    const lobby = this.root.querySelector('#lobby-layer');
    lobby.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-30">
        <div class="w-full max-w-lg bg-slate-900/95 border-2 border-slate-700/90 rounded-3xl shadow-2xl p-6 space-y-4 modal-pop">
          <div class="text-center space-y-1">
            <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
              ✨ Sa Bàn 3D Địa Danh &amp; Đại Chiến Lục Hùng
            </div>
            <h1 class="text-2xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent pt-0.5">
              CỜ TỶ PHÚ VIỆT NAM
            </h1>
            <p class="text-xs text-slate-400">Hỗ trợ Bàn cờ 40 Ô (4 Người) &amp; Mở Rộng 52 Ô (6 Người • Liên Minh 2v2v2)</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Tên nhân vật của bạn</label>
              <input id="inp-player-name" type="text" maxlength="18" value="Tỷ Phú Việt"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:border-amber-400 transition" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Quy mô Sa bàn 3D</label>
              <div class="grid grid-cols-2 gap-2" id="preset-selector">
                <button type="button" data-preset="MEGA_52" class="p-2.5 rounded-xl border-2 text-left transition ${
                  this.selectedMenuPreset === 'MEGA_52'
                    ? 'border-amber-400 bg-amber-500/15 text-white'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600'
                }">
                  <div class="text-xs font-extrabold text-amber-300">🔥 Đại Chiến 52 Ô (Mới)</div>
                  <div class="text-[10px] text-slate-300 mt-0.5">Tối đa 6 người • Xúc xắc Tốc độ • Metro • Liên minh 2v2v2</div>
                </button>
                <button type="button" data-preset="STANDARD_40" class="p-2.5 rounded-xl border-2 text-left transition ${
                  this.selectedMenuPreset === 'STANDARD_40'
                    ? 'border-amber-400 bg-amber-500/15 text-white'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600'
                }">
                  <div class="text-xs font-extrabold text-emerald-300">🗺️ Tiêu Chuẩn 40 Ô</div>
                  <div class="text-[10px] text-slate-300 mt-0.5">2–4 người chơi • 8 nhóm địa danh cổ điển</div>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Chế độ kết nối</label>
              <select id="sel-net-type" class="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:border-amber-400">
                <option value="LOCAL">🎮 Chơi trên 1 máy / Đấu với AI Bot (Local)</option>
                <option value="PEERJS">⚡ Phòng Online P2P Trực Tiếp (PeerJS - 0 cấu hình)</option>
                <option value="FIREBASE" ${fbReady ? '' : 'disabled'}>☁️ Phòng Online Cloud Bền Vững (Firebase ${fbReady ? 'Sẵn sàng' : '- Chưa cấu hình .env'})</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button id="btn-create-room" class="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-110 font-extrabold text-sm text-slate-950 shadow-lg shadow-amber-500/20 transition">
              🏠 Tạo Phòng Mới
            </button>
            <div class="flex gap-2">
              <input id="inp-room-code" type="text" placeholder="Mã VN-8899"
                class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm mono-num uppercase text-white focus:outline-none focus:border-amber-400" />
              <button id="btn-join-room" class="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-extrabold text-sm text-white whitespace-nowrap transition">
                Vào
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.handlers.onPreviewBoardPreset?.(this.selectedMenuPreset);

    lobby.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedMenuPreset = btn.getAttribute('data-preset');
        this.renderInitialMenu();
      });
    });

    lobby.querySelector('#btn-create-room').addEventListener('click', () => {
      const name = lobby.querySelector('#inp-player-name').value.trim() || 'Người chơi 1';
      const netType = lobby.querySelector('#sel-net-type').value;
      this.handlers.onSetupGame({
        action: 'CREATE',
        netType,
        playerName: name,
        boardPreset: this.selectedMenuPreset
      });
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
    const is52 = state.boardPreset === 'MEGA_52';
    const maxPlayers = is52 ? 6 : 4;
    const canAddMore = state.players.length < maxPlayers;
    const canStart = state.players.length >= 2;
    const roomCode = this.networkInfo.roomId || state.roomId;

    lobby.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-30">
        <div class="w-full max-w-lg bg-slate-900/95 border-2 border-slate-700 rounded-3xl shadow-2xl p-5 space-y-4 modal-pop max-h-[92vh] flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <div class="text-base font-extrabold text-white">
                ${is52 ? '🔥 PHÒNG CHỜ ĐẠI CHIẾN LỤC HÙNG (52 Ô)' : '🗺️ PHÒNG CHỜ TIÊU CHUẨN (40 Ô)'}
              </div>
              <div class="text-[11px] text-slate-400">
                Kết nối: <b class="text-slate-200">${escapeHtml(this.networkInfo.mode)}</b> &bull; Vốn: <b class="text-amber-400 mono-num">${is52 ? '2500K' : '2000K'}</b>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button id="btn-lobby-copy" title="Sao chép mã phòng" class="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 mono-num font-extrabold text-amber-300 text-xs hover:bg-amber-500/25 transition">
                📋 ${escapeHtml(roomCode)}
              </button>
              <button id="btn-lobby-leave" title="Rời phòng chờ về trang chính" class="px-2.5 py-1 rounded-xl bg-rose-700/80 hover:bg-rose-600 text-xs font-extrabold text-white transition">
                🚪 Rời
              </button>
            </div>
          </div>

          <div class="space-y-1.5 overflow-y-auto pr-1 flex-1">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Danh sách Tỷ Phú (${state.players.length}/${maxPlayers})
            </div>
            ${state.players.map((p, idx) => {
              const preset = PLAYER_PRESETS[idx] || PLAYER_PRESETS[0];
              const icon = p.icon || preset.icon;
              const team = state.allianceMode ? getAllianceForPlayer(p.id) : null;
              return `
                <div class="flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-800/90 border border-slate-700">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white shadow shrink-0" style="background:${p.color}">
                      ${icon}
                    </span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-extrabold text-xs text-white truncate">${escapeHtml(p.name)}</span>
                        ${team ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-bold text-white shrink-0" style="background:${team.color}">${escapeHtml(team.badge)}</span>` : ''}
                      </div>
                      <div class="text-[10px] text-slate-400">${escapeHtml(p.avatar)} &bull; Vốn ${p.cash}K</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[11px] px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 mono-num font-bold">
                      ${p.isAI ? '🤖 AI Bot' : p.id}
                    </span>
                    ${isHost && p.id !== 'P1' ? `<button data-remove-player="${p.id}" title="Xóa người chơi này khỏi phòng chờ" class="w-6 h-6 rounded-lg bg-slate-900 hover:bg-rose-600 text-slate-400 hover:text-white text-[11px] font-bold transition">✕</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${isHost ? `
            <div class="space-y-2.5 pt-2 border-t border-slate-800">
              <!-- Chuyển đổi Bàn cờ 40 ô / 52 ô & Liên minh 2v2v2 -->
              <div class="grid grid-cols-2 gap-2">
                <button id="btn-switch-preset" type="button" class="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-amber-300 transition">
                  🔄 Đổi sang ${is52 ? 'Bàn 40 Ô (4P)' : 'Bàn 52 Ô (6P)'}
                </button>
                ${is52 ? `
                  <button id="btn-toggle-alliance" type="button" class="py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition ${
                    state.allianceMode
                      ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                  }">
                    🤝 Liên Minh 2v2v2: ${state.allianceMode ? 'BẬT' : 'TẮT'}
                  </button>
                ` : `
                  <div class="py-1.5 px-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-500 flex items-center justify-center">
                    Chọn 52 Ô để mở 6P &amp; 2v2v2
                  </div>
                `}
              </div>

              <!-- Thêm Người Chơi / Thêm AI Bot (Có nút thêm nhanh đủ 6 người) -->
              <div class="flex flex-wrap gap-1.5">
                ${this.networkInfo.mode === 'LOCAL' && canAddMore ? `
                  <button id="btn-add-human" class="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 transition">
                    ➕ Thêm Người
                  </button>
                ` : ''}
                ${canAddMore ? `
                  <button id="btn-add-bot" class="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-xs font-bold text-amber-300 transition">
                    🤖 +1 AI Bot
                  </button>
                ` : ''}
                ${is52 && state.players.length < 6 ? `
                  <button id="btn-fill-6p" class="py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs font-extrabold text-amber-300 transition">
                    ⚡ Đủ 6 Tỷ Phú
                  </button>
                ` : ''}
              </div>

              <div class="flex items-center justify-between gap-2">
                <select id="sel-game-mode" class="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white">
                  <option value="CLASSIC" ${state.mode === 'CLASSIC' ? 'selected' : ''}>🏆 Tiêu chuẩn (Đến người cuối)</option>
                  <option value="SPEED" ${state.mode === 'SPEED' ? 'selected' : ''}>⚡ Chơi nhanh (45 Phút / Đua Tài Sản)</option>
                </select>
                <button id="btn-start-match" ${canStart ? '' : 'disabled'}
                  class="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-40 font-extrabold text-xs sm:text-sm text-slate-950 shadow-lg transition">
                  🚀 BẮT ĐẦU VÁN
                </button>
              </div>
            </div>
          ` : `
            <div class="text-center text-xs font-semibold text-amber-300 py-2 animate-pulse">
              ⏳ Đang chờ Chủ phòng (P1) bắt đầu ván đấu...
            </div>
          `}
        </div>
      </div>
    `;

    lobby.querySelector('#btn-lobby-copy')?.addEventListener('click', (e) => {
      if (roomCode) {
        navigator.clipboard?.writeText(roomCode);
        e.currentTarget.textContent = `✅ Đã chép ${roomCode}`;
      }
    });

    lobby.querySelector('#btn-lobby-leave')?.addEventListener('click', () => {
      this.requestLeaveRoom();
    });

    lobby.querySelectorAll('[data-remove-player]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-remove-player');
        this.handlers.onAction('REMOVE_PLAYER', { targetId }, 'P1');
      });
    });

    lobby.querySelector('#btn-switch-preset')?.addEventListener('click', () => {
      const nextPreset = is52 ? 'STANDARD_40' : 'MEGA_52';
      this.handlers.onAction('SET_LOBBY_CONFIG', { boardPreset: nextPreset }, 'P1');
    });

    lobby.querySelector('#btn-toggle-alliance')?.addEventListener('click', () => {
      this.handlers.onAction('SET_LOBBY_CONFIG', { allianceMode: !state.allianceMode }, 'P1');
    });

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

    lobby.querySelector('#btn-fill-6p')?.addEventListener('click', () => {
      for (let idx = state.players.length + 1; idx <= 6; idx++) {
        this.handlers.onAction('JOIN_GAME', { name: `Bot Đại Gia ${idx}`, isAI: true }, `P${idx}`);
      }
    });

    lobby.querySelector('#btn-start-match')?.addEventListener('click', () => {
      const mode = lobby.querySelector('#sel-game-mode').value;
      this.handlers.onAction('START_GAME', { mode }, 'P1');
    });
  }

  // ==================== 2. XỬ LÝ TỔNG KẾT SỰ KIỆN SAU KHI QUÂN CỜ DỪNG ====================

  async onEventsBatchFinished(events, finalState, { jailedPlayerId, rolledDice, rolledSpeedDie, hadCardModal }) {
    if (!finalState || finalState.phase === 'LOBBY') return;

    if (jailedPlayerId && !hadCardModal && this.isLocalHumanPlayer(jailedPlayerId, finalState)) {
      await this.showBlockingJailModal(jailedPlayerId, finalState, rolledDice);
      return;
    }

    const diceEv = events.find(e => e.type === 'DICE_ROLLED');
    if (!diceEv) return;

    const rollerId = diceEv.playerId;
    if (!this.isLocalHumanPlayer(rollerId, finalState)) return;

    const activePlayer = finalState.players[finalState.activePlayerIndex];
    if (!activePlayer || activePlayer.id !== rollerId) return;

    // Nếu đang ở TILE_RESOLUTION, BUS_DECISION hoặc AUCTION_PHASE thì đã có Popup riêng xử lý
    if (finalState.phase !== 'MANAGEMENT_PHASE' && finalState.phase !== 'BANKRUPTCY_CHECK') return;

    const moveEvents = events.filter(e => e.type === 'PLAYER_MOVED' && e.playerId === rollerId);
    const landedTile = finalState.board[activePlayer.position];

    if (hadCardModal && moveEvents.length <= 1) {
      return;
    }

    const passedStart = moveEvents.some(m => m.passedStart);
    const cashDeltasForRoller = events
      .filter(e => e.type === 'CASH_CHANGED' && e.playerId === rollerId)
      .reduce((sum, e) => sum + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);

    const positiveFestivalGain = landedTile.type === 'FREE_PARKING'
      ? events
          .filter(e => e.type === 'CASH_CHANGED' && e.playerId === rollerId && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0)
      : 0;

    this.pendingLandingSummary = {
      playerId: rollerId,
      tileIndex: landedTile.index,
      dice: rolledDice,
      speedDie: rolledSpeedDie,
      passedStart,
      negativeDelta: cashDeltasForRoller,
      festivalGain: positiveFestivalGain,
      stayedInJail: activePlayer.inJail && moveEvents.length === 0
    };
  }

  showBlockingJailModal(playerId, state, dice) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return Promise.resolve();
    const cardLayer = this.root.querySelector('#card-modal-layer');
    const presetIdx = state.players.findIndex(p => p.id === playerId);
    const icon = player.icon || PLAYER_PRESETS[presetIdx]?.icon || '🐉';
    const jailTileIdx = state.boardPreset === 'MEGA_52' ? 13 : 10;

    return new Promise((resolve) => {
      let closed = false;
      let collapsed = false;

      const done = () => {
        if (closed) return;
        closed = true;
        cardLayer.innerHTML = '';
        resolve();
      };

      const renderView = () => {
        if (closed) return;
        if (collapsed) {
          cardLayer.innerHTML = `
            <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 ui-interactive modal-pop">
              <div class="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 border-rose-500 shadow-2xl">
                <span class="text-base">🚓</span>
                <div class="text-xs font-bold text-white whitespace-nowrap">
                  Tạm giam <span class="text-rose-400">Côn Đảo (#${jailTileIdx})</span>
                </div>
                <button id="btn-ack-jail" class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-extrabold text-white transition">
                  Chấp Hành
                </button>
                <button id="btn-expand-jail" title="Mở rộng thông báo" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-slate-200 transition">
                  🔼 Mở
                </button>
              </div>
            </div>
          `;
          cardLayer.querySelector('#btn-ack-jail')?.addEventListener('click', done);
          cardLayer.querySelector('#btn-expand-jail')?.addEventListener('click', () => {
            collapsed = false;
            renderView();
          });
          return;
        }

        cardLayer.innerHTML = `
          <div id="jail-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 ui-interactive">
            <div class="w-full max-w-[330px] bg-slate-900/95 border-2 border-rose-500 rounded-2xl overflow-hidden shadow-2xl modal-pop" onclick="event.stopPropagation()">
              <div class="px-4 py-2.5 bg-rose-600 text-white flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="text-lg">🚓</span>
                  <span class="text-[11px] font-extrabold uppercase tracking-wider">LỆNH TẠM GIAM</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="flex items-center gap-1 bg-slate-950/25 px-1.5 py-0.5 rounded-lg">
                    ${createMiniPipDieHTML(dice[0])}${createMiniPipDieHTML(dice[1])}
                  </div>
                  <button id="btn-collapse-jail" title="Thu gọn để quan sát bàn cờ" class="px-2 py-1 rounded-lg bg-slate-950/30 hover:bg-slate-950/50 text-[10px] font-extrabold text-white transition">
                    ➖ Thu gọn
                  </button>
                </div>
              </div>
              <div class="p-4 text-center space-y-2.5">
                <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200">
                  <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style="background:${player.color}">${icon}</span>
                  <span>${escapeHtml(player.name)}</span>
                </div>
                <h3 class="text-lg font-extrabold text-white">Nhà Tù Côn Đảo (#${jailTileIdx})</h3>
                <div class="text-xl font-extrabold text-rose-400 mono-num">ĐẾN Ô #${jailTileIdx}</div>
                <p class="text-[11.5px] text-slate-300 leading-relaxed">
                  Di chuyển thẳng về Nhà Tù Côn Đảo và kết thúc lượt đi ngay lập tức!
                </p>
                <button id="btn-ack-jail" class="w-full py-2 rounded-xl font-extrabold text-xs bg-rose-600 hover:bg-rose-500 text-white transition">
                  🚓 Chấp Hành Vào Ô #${jailTileIdx}
                </button>
              </div>
            </div>
          </div>
        `;
        cardLayer.querySelector('#btn-ack-jail')?.addEventListener('click', done);
        const collapseFn = () => {
          collapsed = true;
          renderView();
        };
        cardLayer.querySelector('#btn-collapse-jail')?.addEventListener('click', collapseFn);
        cardLayer.querySelector('#jail-backdrop')?.addEventListener('click', collapseFn);
      };

      renderView();
      if (this.networkInfo.mode !== 'LOCAL') {
        setTimeout(done, 6500);
      }
    });
  }

  // ==================== 3. ĐỒNG BỘ HUD 6 NGƯỜI SIÊU GỌN, SỔ ĐỎ & ĐIỀU KHIỂN ====================

  renderHUD(state) {
    this.state = state;
    const lobbyLayer = this.root.querySelector('#lobby-layer');
    const topBar = this.root.querySelector('#top-bar');
    const leftAside = this.root.querySelector('#left-hud-aside');
    const rightAside = this.root.querySelector('#right-hud-aside');

    if (state.phase === 'LOBBY') {
      topBar.classList.add('hidden');
      leftAside.classList.add('hidden');
      rightAside.classList.add('hidden');
      this.renderWaitingLobby(state);
      return;
    }

    lobbyLayer.innerHTML = '';
    topBar.classList.remove('hidden');
    leftAside.classList.remove('hidden');
    rightAside.classList.remove('hidden');

    this.root.querySelector('#lbl-room-id').textContent = this.networkInfo.roomId || state.roomId;
    const boardBadge = this.root.querySelector('#lbl-board-badge');
    if (boardBadge) {
      boardBadge.textContent = state.boardPreset === 'MEGA_52'
        ? `52 Ô${state.allianceMode ? ' • 2v2v2' : ''} • Vòng ${state.roundCount || 1}`
        : `40 Ô • Vòng ${state.roundCount || 1}`;
    }

    if (state.dice) {
      this.updateMiniDiceHUD(state.dice[0], state.dice[1], state.speedDie);
    }

    this.renderPlayersCompactHUD(state);
    this.renderInspector(state);

    const logContainer = this.root.querySelector('#event-log-list');
    logContainer.innerHTML = state.logs
      .map(item => `
        <div class="text-slate-300 leading-snug border-l-2 border-amber-400/80 pl-2 py-0.5">
          ${escapeHtml(item)}
        </div>
      `)
      .join('');
    const logLatest = this.root.querySelector('#event-log-latest');
    if (logLatest) {
      logLatest.textContent = state.logs[0] || '';
    }
    this.syncRightPanelsCollapse();

    this.renderTurnControls(state);
    this.renderModals(state);
  }

  renderPlayersCompactHUD(state) {
    const container = this.root.querySelector('#players-hud-container');
    if (!container) return;

    const isMini6P = state.players.length > 4 || state.boardPreset === 'MEGA_52';

    container.innerHTML = state.players.map((p, idx) => {
      const isTurn = idx === state.activePlayerIndex;
      const isMe = this.networkInfo.mode !== 'LOCAL' && p.id === this.networkInfo.myPlayerId;
      const preset = PLAYER_PRESETS[idx] || PLAYER_PRESETS[0];
      const icon = p.icon || preset.icon || '⭐';
      const ownedCount = state.board.filter(t => t.ownerId === p.id).length;
      const prevCash = this.displayedCash.has(p.id) ? this.displayedCash.get(p.id) : p.cash;
      const tileName = state.board[p.position]?.shortName || state.board[p.position]?.name || '';
      const team = state.allianceMode ? getAllianceForPlayer(p.id) : null;

      const statusText = p.isBankrupt
        ? '💥 Phá sản'
        : p.inJail
          ? `⛓️ Tù (${p.jailTurns}/3)`
          : `#${p.position} ${tileName}`;

      return `
        <div data-player-pos="${p.position}" class="${isMini6P ? 'py-1.5 px-2' : 'p-2'} rounded-xl border cursor-pointer transition-all ${
          isTurn
            ? 'bg-slate-800/95 border-amber-400 shadow-md shadow-amber-500/15 scale-[1.02]'
            : 'bg-slate-900/85 border-slate-700/70 opacity-90 hover:opacity-100'
        } ${p.isBankrupt ? 'opacity-40 grayscale' : ''}">
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <div class="${isMini6P ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-sm'} rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow" style="background:${p.color}">
                ${icon}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1">
                  <span class="text-[10.5px] font-extrabold text-white truncate">${escapeHtml(p.name)}</span>
                  ${isTurn ? '<span class="px-1 py-0.1 text-[7.5px] font-black bg-amber-400 text-slate-950 rounded">LƯỢT</span>' : ''}
                  ${isMe ? '<span class="px-1 py-0.1 text-[7.5px] font-black bg-emerald-500/25 text-emerald-300 rounded">BẠN</span>' : ''}
                </div>
                <div class="text-[9px] text-slate-400 truncate">
                  ${team ? `<span style="color:${team.color}">●</span> ` : ''}${escapeHtml(statusText)}
                </div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div id="cash-val-${p.id}" class="text-[11.5px] font-extrabold mono-num ${p.cash < 0 ? 'text-rose-400' : 'text-amber-400'}">
                ${prevCash}K
              </div>
              <div class="text-[9px] text-slate-400 font-semibold">
                🏠 ${ownedCount}${p.jailFreeCards > 0 ? ` • 🎫${p.jailFreeCards}` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-player-pos]').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const pos = Number(cardEl.getAttribute('data-player-pos'));
        this.setInspectedTile(pos, true);
      });
    });

    state.players.forEach(p => this.animateCashDisplay(p.id, p.cash));

    const activePlayer = state.players[state.activePlayerIndex];
    const turnIndicator = this.root.querySelector('#turn-indicator');
    if (turnIndicator && activePlayer) {
      const activeIcon = activePlayer.icon || PLAYER_PRESETS[state.activePlayerIndex]?.icon || '🎲';
      turnIndicator.textContent = `${activeIcon} ${activePlayer.name}`;
    }
  }

  animateCashDisplay(playerId, targetCash) {
    const startCash = this.displayedCash.has(playerId) ? this.displayedCash.get(playerId) : targetCash;
    this.displayedCash.set(playerId, targetCash);
    const el = this.root.querySelector(`#cash-val-${playerId}`);
    if (!el || startCash === targetCash) {
      if (el) el.textContent = `${targetCash}K`;
      return;
    }

    const duration = 340;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const current = Math.round(startCash + (targetCash - startCash) * progress);
      const node = this.root.querySelector(`#cash-val-${playerId}`);
      if (node) node.textContent = `${current}K`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  renderInspector(state) {
    const idx = this.getInspectedTileIndex(state);
    const tile = state.board[idx];
    if (!tile) return;

    const palette = GROUP_COLORS[tile.group] || GROUP_COLORS.NONE;
    const owner = tile.ownerId ? state.players.find(p => p.id === tile.ownerId) : null;
    const myId = this.getEffectivePlayerId(state);
    const rentInfo = getTileRentInfo(state, tile, myId);

    const headerEl = this.root.querySelector('#inspector-header');
    headerEl.style.background = palette.primary;
    this.root.querySelector('#inspector-group').textContent = palette.label;
    this.root.querySelector('#inspector-id').textContent = `#${String(tile.index).padStart(2, '0')}`;
    this.root.querySelector('#inspector-title').textContent = tile.name;

    const ownerBar = this.root.querySelector('#inspector-owner-bar');
    if (owner) {
      const levelBadge = tile.isMortgaged
        ? '🔒 Đang cầm cố'
        : tile.level === 6
          ? '🏙️ Landmark'
          : tile.level === 5
            ? '🏨 Khách sạn'
            : tile.level > 0
              ? `🏠 ${tile.level} Nhà`
              : rentInfo?.isMonopoly
                ? '👑 Độc quyền x2'
                : rentInfo?.isJointVenture
                  ? '🏗️ Liên doanh 2/3'
                  : 'Đất trống';
      ownerBar.textContent = `${owner.icon || '🚩'} ${owner.name} • ${levelBadge}`;
      ownerBar.classList.remove('hidden');
    } else {
      ownerBar.classList.add('hidden');
    }

    this.root.querySelector('#inspector-price').textContent = tile.price ? `${tile.price}K` : '---';
    this.root.querySelector('#inspector-current-rent').textContent = owner && rentInfo
      ? rentInfo.inspectorText
      : tile.rent
        ? `${tile.rent[0]}K`
        : tile.type === 'UTILITY'
          ? '4x🎲'
          : (tile.sub || '---');

    const rowsEl = this.root.querySelector('#inspector-body-rows');
    const footerEl = this.root.querySelector('#inspector-footer-meta');
    const actionsEl = this.root.querySelector('#inspector-actions');

    if (tile.type === 'PROPERTY') {
      const activeLv = owner && !tile.isMortgaged ? tile.level : -1;
      const isMono = owner && ownsFullGroupUnmortgaged(state, owner.id, tile.group);
      const hasLandmark = tile.rent.length >= 7;

      rowsEl.innerHTML = `
        <div class="flex justify-between py-0.5 border-b border-slate-800/80 ${activeLv === 0 && !isMono ? 'text-amber-300 font-bold' : ''}">
          <span>Đất trống</span>
          <span class="mono-num font-bold text-white">${tile.rent[0]}K</span>
        </div>
        <div class="flex justify-between py-0.5 border-b border-slate-800/80 text-purple-300 ${activeLv === 0 && isMono ? 'font-extrabold underline' : ''}">
          <span>👑 Độc quyền (x2)</span>
          <span class="mono-num font-bold">${tile.rent[0] * 2}K</span>
        </div>
        <div class="flex justify-between py-0.5 border-b border-slate-800/80 ${activeLv === 1 ? 'bg-emerald-500/15 px-1 rounded' : ''}">
          <span>🏠 1 Nhà phố</span>
          <span class="mono-num font-bold text-emerald-400">${tile.rent[1]}K</span>
        </div>
        <div class="flex justify-between py-0.5 border-b border-slate-800/80 ${activeLv === 2 ? 'bg-emerald-500/15 px-1 rounded' : ''}">
          <span>🏠🏠 2 Nhà ${hasLandmark ? '<em class="text-[8.5px] text-sky-300">(2/3 bộ)</em>' : ''}</span>
          <span class="mono-num font-bold text-emerald-400">${tile.rent[2]}K</span>
        </div>
        <div class="flex justify-between py-0.5 border-b border-slate-800/80 ${activeLv === 3 ? 'bg-emerald-500/15 px-1 rounded' : ''}">
          <span>🏠🏠🏠 3 Nhà phố</span>
          <span class="mono-num font-bold text-emerald-400">${tile.rent[3]}K</span>
        </div>
        <div class="flex justify-between py-0.5 border-b border-slate-800/80 ${activeLv === 4 ? 'bg-emerald-500/15 px-1 rounded' : ''}">
          <span>🏠🏠🏠🏠 4 Nhà</span>
          <span class="mono-num font-bold text-emerald-400">${tile.rent[4]}K</span>
        </div>
        <div class="flex justify-between py-0.5 ${hasLandmark ? 'border-b border-slate-800/80' : ''} text-rose-400 font-bold ${activeLv === 5 ? 'bg-rose-500/15 px-1 rounded' : ''}">
          <span>🏨 Khách sạn 5 Sao</span>
          <span class="mono-num">${tile.rent[5]}K</span>
        </div>
        ${hasLandmark ? `
          <div class="flex justify-between pt-0.5 text-sky-300 font-extrabold ${activeLv === 6 ? 'bg-sky-500/20 px-1 rounded' : ''}">
            <span>🏙️ Landmark (Cấp 6)</span>
            <span class="mono-num">${tile.rent[6]}K</span>
          </div>
        ` : ''}
      `;
      footerEl.innerHTML = `
        <span>Xây: <strong class="text-slate-200 mono-num">${tile.buildCost}K</strong></span>
        <span>🔒 Cầm: <strong class="text-slate-200 mono-num">${tile.mortgageValue}K</strong></span>
      `;
    } else if (tile.type === 'STATION') {
      const is52 = state.boardPreset === 'MEGA_52';
      rowsEl.innerHTML = is52
        ? `
          <div class="flex justify-between py-0.5 border-b border-slate-800/80"><span>🚇 1 / 2 Trạm</span><span class="mono-num font-bold text-white">25K / 50K</span></div>
          <div class="flex justify-between py-0.5 border-b border-slate-800/80"><span>🚇 3 / 4 Trạm</span><span class="mono-num font-bold text-emerald-400">100K / 200K</span></div>
          <div class="flex justify-between py-0.5 border-b border-slate-800/80"><span>🚇 5 Trạm</span><span class="mono-num font-bold text-amber-300">350K</span></div>
          <div class="flex justify-between py-0.5 text-rose-400 font-extrabold"><span>👑 Trọn 6 Trạm</span><span class="mono-num">600K</span></div>
          <div class="text-[9.5px] text-sky-300 pt-1">✈️ Đầu lượt tại Trạm có chủ: Được bay chuyển tuyến tốc hành!</div>
        `
        : `
          <div class="flex justify-between py-0.5 border-b border-slate-800/80"><span>🚌 Sở hữu 1 Bến</span><span class="mono-num font-bold text-white">25K</span></div>
          <div class="flex justify-between py-0.5 border-b border-slate-800/80"><span>🚌🚌 Sở hữu 2 Bến</span><span class="mono-num font-bold text-emerald-400">50K</span></div>
          <div class="flex justify-between py-0.5 border-b border-slate-800/80"><span>🚌🚌🚌 Sở hữu 3 Bến</span><span class="mono-num font-bold text-emerald-400">100K</span></div>
          <div class="flex justify-between pt-0.5 text-amber-300 font-bold"><span>👑 Trọn bộ 4 Bến</span><span class="mono-num">200K</span></div>
        `;
      footerEl.innerHTML = `
        <span>Tuyến giao thông</span>
        <span>🔒 Cầm: <strong class="text-slate-200 mono-num">${tile.mortgageValue}K</strong></span>
      `;
    } else if (tile.type === 'UTILITY') {
      const is52 = state.boardPreset === 'MEGA_52';
      rowsEl.innerHTML = `
        <div class="flex justify-between py-0.5 border-b border-slate-800/80"><span>⚡ Sở hữu 1 Tập đoàn</span><span class="mono-num font-bold text-emerald-400">4K × 🎲</span></div>
        <div class="flex justify-between py-0.5 ${is52 ? 'border-b border-slate-800/80' : ''} text-amber-300 font-bold"><span>⚡⚡ Sở hữu 2 Tập đoàn</span><span class="mono-num">10K × 🎲</span></div>
        ${is52 ? `<div class="flex justify-between pt-0.5 text-rose-400 font-extrabold"><span>👑 Trọn 3 Tập đoàn</span><span class="mono-num">20K × 🎲</span></div>` : ''}
      `;
      footerEl.innerHTML = `
        <span>Hạ tầng Quốc gia</span>
        <span>🔒 Cầm: <strong class="text-slate-200 mono-num">${tile.mortgageValue}K</strong></span>
      `;
    } else {
      const descMap = {
        START: state.boardPreset === 'MEGA_52'
          ? 'Đi qua nhận +250K. Dừng chính xác trên ô Khởi Hành nhận thưởng +350K!'
          : 'Đi qua hoặc dừng tại Khởi Hành nhận ngay +200K tiền lương.',
        JAIL: 'Ô Thăm Tù an toàn (hoặc nơi tạm giam tối đa 3 lượt nếu bị bắt).',
        FREE_PARKING: state.boardPreset === 'MEGA_52'
          ? `Quỹ Lễ Hội hiện có: +${state.festivalFund || 0}K. Ai dừng chân tại đây sẽ nhận trọn quỹ thưởng!`
          : 'Phố Đi Bộ nghỉ chân an toàn, không mất phí.',
        NATIONAL_AUCTION: 'Sàn Đấu Giá Quốc Gia: Tự động chọn 1 lô đất chưa có chủ đưa ra đấu giá cho cả 6 người!',
        GO_TO_JAIL: `Di chuyển thẳng về Nhà Tù Côn Đảo (#${state.boardPreset === 'MEGA_52' ? 13 : 10}), không nhận lương.`,
        TAX: `Nộp khoản thuế bắt buộc -${tile.taxAmount}K (Tích lũy vào Quỹ Lễ Hội ở bản 52 Ô).`,
        CHANCE: 'Rút ngẫu nhiên 1 thẻ trong bộ bài Cơ Hội Việt Nam.',
        COMMUNITY_CHEST: 'Rút ngẫu nhiên 1 thẻ trong bộ bài Khí Vận Việt Nam.'
      };
      rowsEl.innerHTML = `<div class="py-1.5 text-slate-300 leading-relaxed">${escapeHtml(descMap[tile.type] || '')}</div>`;
      footerEl.innerHTML = `<span>Ô Sự Kiện</span><span class="mono-num text-amber-400">${escapeHtml(tile.sub || '')}</span>`;
    }

    const activePlayer = state.players[state.activePlayerIndex];
    const isMyManagePhase = Boolean(
      myId &&
      activePlayer?.id === myId &&
      tile.ownerId === myId &&
      (state.phase === 'MANAGEMENT_PHASE' || state.phase === 'BANKRUPTCY_CHECK')
    );

    if (!isMyManagePhase) {
      actionsEl.innerHTML = '';
      return;
    }

    const canBuild = canBuildHouseState(state, myId, tile.index);
    const canSell = canSellHouseState(state, myId, tile.index);
    const canMort = canMortgageTileState(state, myId, tile.index);
    const canUnmort = canUnmortgageTileState(state, myId, tile.index);
    const unmortCost = Math.ceil((tile.mortgageValue || 0) * 1.1);
    const maxAllowedLv = getMaxAllowedBuildLevel(state, myId, tile.group);

    const btns = [];
    if (canBuild) {
      const nextLvLabel = tile.level + 1 === 6 ? 'Landmark 🏙️' : tile.level + 1 === 5 ? 'Khách Sạn 🏨' : `Nhà Cấp ${tile.level + 1} 🏠`;
      btns.push(`<button id="insp-btn-build" class="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10.5px] transition">🏗️ Xây ${nextLvLabel} (-${tile.buildCost}K)</button>`);
    } else if (tile.type === 'PROPERTY' && !tile.isMortgaged && maxAllowedLv === 0) {
      btns.push(`<div class="text-[9.5px] text-center text-slate-400 py-0.5">💡 Cần 2/3 bộ (52 Ô) hoặc đủ bộ màu để xây</div>`);
    } else if (tile.type === 'PROPERTY' && !tile.isMortgaged && maxAllowedLv === 2 && tile.level >= 2) {
      btns.push(`<div class="text-[9.5px] text-center text-sky-300 py-0.5">💡 Đủ 3/3 bộ màu để lên Cấp 3–Landmark</div>`);
    }

    if (canSell) {
      btns.push(`<button id="insp-btn-sell" class="w-full py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] transition">🏚️ Bán 1 Cấp Nhà (+${Math.floor(tile.buildCost * 0.5)}K)</button>`);
    }
    if (canMort) {
      btns.push(`<button id="insp-btn-mort" class="w-full py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-bold text-[10px] transition">🔒 Thế Chấp Ngân Hàng (+${tile.mortgageValue}K)</button>`);
    }
    if (canUnmort) {
      btns.push(`<button id="insp-btn-unmort" class="w-full py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition">🔓 Chuộc Lại Đất (-${unmortCost}K)</button>`);
    }

    actionsEl.innerHTML = btns.join('');
    actionsEl.querySelector('#insp-btn-build')?.addEventListener('click', () =>
      this.handlers.onAction('BUILD_HOUSE', { tileIndex: tile.index }, myId));
    actionsEl.querySelector('#insp-btn-sell')?.addEventListener('click', () =>
      this.handlers.onAction('SELL_HOUSE', { tileIndex: tile.index }, myId));
    actionsEl.querySelector('#insp-btn-mort')?.addEventListener('click', () =>
      this.handlers.onAction('MORTGAGE_TILE', { tileIndex: tile.index }, myId));
    actionsEl.querySelector('#insp-btn-unmort')?.addEventListener('click', () =>
      this.handlers.onAction('UNMORTGAGE_TILE', { tileIndex: tile.index }, myId));
  }

  renderTurnControls(state) {
    const activePlayer = state.players[state.activePlayerIndex];
    const myId = this.getEffectivePlayerId(state);
    const isMyTurn = Boolean(activePlayer && myId === activePlayer.id && !activePlayer.isAI);

    const canManage = isMyTurn && (state.phase === 'MANAGEMENT_PHASE' || state.phase === 'BANKRUPTCY_CHECK');
    this.root.querySelector('#btn-open-trade').disabled = !(isMyTurn && state.phase === 'MANAGEMENT_PHASE');
    this.root.querySelector('#btn-open-portfolio').disabled = !canManage;
    this.root.querySelector('#btn-declare-bankrupt').disabled = !isMyTurn;

    const actionContainer = this.root.querySelector('#turn-primary-actions');
    if (!activePlayer || state.phase === 'GAME_OVER') {
      actionContainer.innerHTML = '';
      return;
    }

    // Nếu đồng đội đang bị âm tiền và máy này là đồng đội có thể cứu trợ
    const bailoutInfo = getAllyBailoutInfo(state, activePlayer.id);
    if (!isMyTurn) {
      if (bailoutInfo && this.networkInfo.myPlayerId === bailoutInfo.allyId) {
        actionContainer.innerHTML = `
          <button id="btn-ally-bailout" class="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[10.5px] shadow-lg animate-pulse transition">
            🤝 Cứu Trợ ${escapeHtml(activePlayer.name)} (-${bailoutInfo.amount}K)
          </button>
        `;
        actionContainer.querySelector('#btn-ally-bailout').onclick = () =>
          this.handlers.onAction('ALLY_BAILOUT', {}, bailoutInfo.allyId);
        return;
      }

      actionContainer.innerHTML = `
        <div class="w-full py-2 px-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center text-[11px] font-bold text-slate-300 truncate">
          ⏳ Chờ <span style="color:${activePlayer.color}">${escapeHtml(activePlayer.name)}</span>...
        </div>
      `;
      return;
    }

    if (state.phase === 'ROLL_DICE') {
      const transit = getTransitTeleportInfo(state, myId);
      actionContainer.innerHTML = `
        <button id="btn-roll-dice" class="w-full py-2 rounded-lg font-extrabold text-xs bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20 hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1.5">
          <span>🎲</span> ĐỔ XÚC XẮC
        </button>
        ${transit ? `
          <button id="btn-open-transit" class="w-full py-1.5 rounded-lg font-extrabold text-[10.5px] bg-sky-600 hover:bg-sky-500 text-white transition">
            🚇 Chuyển Tuyến Tốc Hành (${transit.fee === 0 ? 'Miễn phí' : `-${transit.fee}K`})
          </button>
        ` : ''}
      `;
      actionContainer.querySelector('#btn-roll-dice').onclick = () => {
        this.showTransitModal = false;
        this.handlers.onAction('ROLL_DICE', {}, myId);
      };
      actionContainer.querySelector('#btn-open-transit')?.addEventListener('click', () => {
        this.showTransitModal = true;
        this.renderModals(state);
      });
    } else if (state.phase === 'JAIL_DECISION') {
      actionContainer.innerHTML = `
        <div class="space-y-1">
          <button id="btn-jail-roll" class="w-full py-2 rounded-lg font-extrabold text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 transition">
            🎲 Đổ Đôi Thoát Tù
          </button>
          <div class="grid grid-cols-2 gap-1">
            <button id="btn-jail-pay" ${activePlayer.cash < GAME_CONSTANTS.JAIL_FINE ? 'disabled' : ''} class="py-1.5 rounded-lg font-bold text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-40 text-amber-300 transition">
              💸 Phạt 50K
            </button>
            <button id="btn-jail-card" ${activePlayer.jailFreeCards <= 0 ? 'disabled' : ''} class="py-1.5 rounded-lg font-bold text-[10px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition">
              🎫 Ân Xá (${activePlayer.jailFreeCards})
            </button>
          </div>
        </div>
      `;
      actionContainer.querySelector('#btn-jail-roll').onclick = () =>
        this.handlers.onAction('ROLL_DICE', {}, myId);
      actionContainer.querySelector('#btn-jail-pay').onclick = () =>
        this.handlers.onAction('JAIL_PAY_FINE', {}, myId);
      actionContainer.querySelector('#btn-jail-card').onclick = () =>
        this.handlers.onAction('JAIL_USE_CARD', {}, myId);
    } else if (state.phase === 'BUS_DECISION') {
      actionContainer.innerHTML = `
        <button id="btn-reopen-bus" class="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-center text-[11px] font-extrabold text-amber-300 transition">
          🚌 ${this.eventPopupCollapsed ? 'Mở Lại Xe Buýt Nhanh' : 'Chọn Bến Xe Buýt Nhanh'}
        </button>
      `;
      actionContainer.querySelector('#btn-reopen-bus').onclick = () => this.setEventPopupCollapsed(false);
    } else if (state.phase === 'TILE_RESOLUTION') {
      actionContainer.innerHTML = `
        <button id="btn-reopen-buy" class="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-center text-[11px] font-extrabold text-emerald-300 transition">
          🏞️ ${this.eventPopupCollapsed ? 'Mở Lại Ô Mua Đất' : 'Chọn Mua hoặc Đấu Giá'}
        </button>
      `;
      actionContainer.querySelector('#btn-reopen-buy').onclick = () => {
        this.setEventPopupCollapsed(false);
      };
    } else if (state.phase === 'MANAGEMENT_PHASE') {
      const isDoubleBonus = state.dice[0] === state.dice[1] && !activePlayer.inJail && !state.escapedJailByDouble && state.doubleCount > 0;
      actionContainer.innerHTML = `
        <button id="btn-end-turn" class="w-full py-2 rounded-lg font-extrabold text-xs ${
          isDoubleBonus
            ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950'
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
        } shadow-md transition active:scale-95">
          ${isDoubleBonus ? '🎲 ĐỔ TIẾP LƯỢT ĐÔI' : '✅ KẾT THÚC LƯỢT'}
        </button>
      `;
      actionContainer.querySelector('#btn-end-turn').onclick = () => {
        this.pendingLandingSummary = null;
        this.handlers.onAction('END_TURN', {}, myId);
      };
    } else if (state.phase === 'BANKRUPTCY_CHECK') {
      actionContainer.innerHTML = `
        <div class="space-y-1">
          ${bailoutInfo ? `
            <button id="btn-ally-bailout" class="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[10.5px] transition">
              🤝 ${escapeHtml(bailoutInfo.allyName)} Cứu Trợ (-${bailoutInfo.amount}K)
            </button>
          ` : ''}
          <button id="btn-rescue-debt" class="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10.5px] animate-pulse transition">
            ⚠️ Âm ${activePlayer.cash}K! Bán/Cầm Cố
          </button>
        </div>
      `;
      actionContainer.querySelector('#btn-ally-bailout')?.addEventListener('click', () => {
        this.pendingLandingSummary = null;
        this.handlers.onAction('ALLY_BAILOUT', {}, myId);
      });
      actionContainer.querySelector('#btn-rescue-debt').onclick = () => {
        this.pendingLandingSummary = null;
        this.showPortfolioModal = true;
        this.renderModals(state);
      };
    } else {
      actionContainer.innerHTML = '';
    }
  }

  // ==================== 4. HỆ THỐNG EVENT POPUP & CÁC MODAL THU GỌN ====================

  renderModals(state) {
    const layer = this.root.querySelector('#modal-layer');

    const sig = [
      state.phase,
      state.activePlayerIndex,
      state.players[state.activePlayerIndex]?.position,
      state.auction?.tileIndex ?? '-',
      state.pendingTrade ? `${state.pendingTrade.fromPlayerId}->${state.pendingTrade.toPlayerId}` : '-',
      state.pendingMortgageTransfers[0]?.tileIndex ?? '-',
      this.pendingLandingSummary ? `${this.pendingLandingSummary.playerId}@${this.pendingLandingSummary.tileIndex}` : '-'
    ].join('|');

    if (this.lastPopupSignature !== sig) {
      this.lastPopupSignature = sig;
      this.eventPopupCollapsed = false;
    }

    // 1. Kết thúc ván đấu (Cá nhân hoặc Liên Minh 2v2v2)
    if (state.phase === 'GAME_OVER') {
      const winner = state.players.find(p => p.id === state.winnerId);
      const wIdx = state.players.findIndex(p => p.id === state.winnerId);
      const wIcon = winner?.icon || PLAYER_PRESETS[wIdx]?.icon || '🏆';
      const winTeam = state.winningAlliance ? ALLIANCE_TEAMS[state.winningAlliance] : null;

      layer.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-40 ui-interactive">
          <div class="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 text-center space-y-4 shadow-2xl modal-pop">
            <div class="text-5xl">${wIcon}</div>
            <div class="text-xs font-extrabold uppercase tracking-widest text-amber-400">
              ${winTeam ? 'LIÊN MINH TẬP ĐOÀN CHIẾN THẮNG' : 'TÂN TỶ PHÚ VIỆT NAM'}
            </div>
            <div class="text-2xl font-black text-white">
              ${escapeHtml(winTeam ? winTeam.name : (winner?.name || 'Kết thúc ván đấu'))}
            </div>
            <div class="space-y-1.5 text-left bg-slate-800/85 p-3.5 rounded-2xl text-xs border border-slate-700">
              ${state.players.map((p, i) => {
                const t = state.allianceMode ? getAllianceForPlayer(p.id) : null;
                return `
                  <div class="flex justify-between items-center py-1 border-b border-slate-700/50 last:border-0">
                    <span class="font-bold text-slate-200">
                      ${p.icon || PLAYER_PRESETS[i]?.icon || ''} ${escapeHtml(p.name)}
                      ${t ? `<em class="text-[10px] ml-1" style="color:${t.color}">(${escapeHtml(t.badge)})</em>` : ''}
                    </span>
                    <span class="mono-num font-extrabold ${p.isBankrupt ? 'text-rose-400' : 'text-amber-300'}">
                      ${p.isBankrupt ? 'Phá sản' : `${calculateNetWorthState(state, p.id)}K`}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <button id="btn-gameover-leave" class="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-extrabold text-xs sm:text-sm text-white transition">
                🚪 Về Sảnh Chính
              </button>
              <button onclick="window.location.reload()" class="py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 font-extrabold text-xs sm:text-sm text-slate-950 transition">
                🔄 Chơi Ván Mới
              </button>
            </div>
          </div>
        </div>
      `;
      layer.querySelector('#btn-gameover-leave')?.addEventListener('click', () => {
        this.requestLeaveRoom();
      });
      return;
    }

    // 2. Sàn Đấu Giá Thời Gian Thực 10s (Có thể thu gọn xuống thanh đáy)
    if (state.phase === 'AUCTION_PHASE' && state.auction) {
      this.pendingLandingSummary = null;
      layer.innerHTML = this.buildAuctionModalHTML(state);
      this.bindAuctionEvents(state, layer);
      return;
    }

    // 3. Xử lý Đất Thế Chấp nhận từ Giao Dịch (Có thể thu gọn)
    const myIdForTransfer = this.networkInfo.mode === 'LOCAL'
      ? state.pendingMortgageTransfers[0]?.playerId
      : this.networkInfo.myPlayerId;
    const pendingTransfer = state.pendingMortgageTransfers.find(t => t.playerId === myIdForTransfer);
    if (pendingTransfer) {
      const tile = state.board[pendingTransfer.tileIndex];
      const player = state.players.find(p => p.id === pendingTransfer.playerId);
      if (this.eventPopupCollapsed) {
        layer.innerHTML = `
          <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 ui-interactive modal-pop">
            <div class="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 border-amber-500/70 shadow-2xl">
              <span>🏦</span>
              <span class="text-xs font-bold text-white whitespace-nowrap">${escapeHtml(tile.name)}: Giải chấp <b class="text-amber-300 mono-num">-${tile.mortgageValue}K</b>?</span>
              <button id="btn-unmort-now" ${player.cash < tile.mortgageValue ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[11px] font-extrabold text-slate-950">Giải Chấp</button>
              <button id="btn-keep-mort" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-white">Giữ</button>
              <button data-expand-popup class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-amber-300">🔼 Mở</button>
            </div>
          </div>
        `;
      } else {
        layer.innerHTML = `
          <div data-collapse-backdrop class="fixed inset-0 bg-slate-950/45 flex items-center justify-center p-4 z-40 ui-interactive">
            <div class="w-full max-w-[330px] bg-slate-900/95 border-2 border-amber-500/60 rounded-2xl p-4 space-y-3 shadow-2xl modal-pop" onclick="event.stopPropagation()">
              <div class="flex items-center justify-between">
                <div class="text-xs font-extrabold text-amber-300">🏦 Xử Lý Đất Thế Chấp (${escapeHtml(player.name)})</div>
                <button data-collapse-popup class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300">➖ Thu gọn</button>
              </div>
              <p class="text-[11.5px] text-slate-300 leading-relaxed">
                Bạn vừa nhận <b>${escapeHtml(tile.name)}</b> (đã thu 10% phí sang tên). Trả thêm <b class="mono-num text-amber-300">${tile.mortgageValue}K</b> để giải chấp ngay?
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button id="btn-unmort-now" ${player.cash < tile.mortgageValue ? 'disabled' : ''} class="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-xs font-extrabold text-slate-950">
                  🔓 Giải Chấp (-${tile.mortgageValue}K)
                </button>
                <button id="btn-keep-mort" class="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white">
                  Giữ Thế Chấp
                </button>
              </div>
            </div>
          </div>
        `;
      }
      this.bindCollapseTriggers(layer);
      layer.querySelector('#btn-unmort-now').onclick = () =>
        this.handlers.onAction('RESOLVE_TRANSFERRED_MORTGAGE', { tileIndex: tile.index, unmortgageNow: true }, player.id);
      layer.querySelector('#btn-keep-mort').onclick = () =>
        this.handlers.onAction('RESOLVE_TRANSFERRED_MORTGAGE', { tileIndex: tile.index, unmortgageNow: false }, player.id);
      return;
    }

    // 4. Đề nghị Giao Dịch gửi đến (Có thể thu gọn)
    if (state.pendingTrade) {
      const toPlayer = state.players.find(p => p.id === state.pendingTrade.toPlayerId);
      const isRecipient = this.networkInfo.mode === 'LOCAL'
        ? !toPlayer?.isAI
        : this.networkInfo.myPlayerId === state.pendingTrade.toPlayerId;

      if (isRecipient) {
        layer.innerHTML = this.buildIncomingTradeHTML(state, state.pendingTrade);
        this.bindCollapseTriggers(layer);
        layer.querySelector('#btn-accept-trade').onclick = () =>
          this.handlers.onAction('RESPOND_TRADE', { accept: true }, toPlayer.id);
        layer.querySelector('#btn-reject-trade').onclick = () =>
          this.handlers.onAction('RESPOND_TRADE', { accept: false }, toPlayer.id);
        return;
      }
    }

    const activePlayer = state.players[state.activePlayerIndex];
    const effectiveId = this.getEffectivePlayerId(state);
    const isMyActiveTurn = Boolean(activePlayer && activePlayer.id === effectiveId && !activePlayer.isAI);

    // 5. EVENT POPUP: Xúc xắc Tốc độ mặt Xe Buýt Nhanh (BUS_DECISION)
    if (state.phase === 'BUS_DECISION' && isMyActiveTurn && state.busTargets) {
      layer.innerHTML = this.buildSpeedBusPopupHTML(state, activePlayer);
      this.bindCollapseTriggers(layer);
      this.bindSpeedBusPopupEvents(activePlayer, layer);
      return;
    }

    // 6. EVENT POPUP: Dừng tại Đất Trống chưa có chủ (TILE_RESOLUTION)
    if (state.phase === 'TILE_RESOLUTION' && isMyActiveTurn) {
      const tile = state.board[activePlayer.position];
      if (tile) {
        layer.innerHTML = this.buildUnownedLandingPopupHTML(state, activePlayer, tile);
        this.bindCollapseTriggers(layer);
        this.bindUnownedLandingPopupEvents(activePlayer, layer);
        return;
      }
    }

    // 7. Modal Chuyển Tuyến Tốc Hành (Transit Teleport)
    if (this.showTransitModal && isMyActiveTurn && state.phase === 'ROLL_DICE') {
      const transit = getTransitTeleportInfo(state, effectiveId);
      if (transit) {
        layer.innerHTML = this.buildTransitTeleportModalHTML(state, activePlayer, transit);
        this.bindTransitTeleportModalEvents(state, activePlayer, layer);
        return;
      }
    }

    // 8. EVENT POPUP TỰ ĐỘNG: Tổng kết dừng chân sau khi tung xúc xắc
    if (this.pendingLandingSummary && activePlayer && this.pendingLandingSummary.playerId === activePlayer.id) {
      layer.innerHTML = this.buildPostRollSummaryPopupHTML(state, activePlayer, this.pendingLandingSummary);
      this.bindCollapseTriggers(layer);
      this.bindPostRollSummaryPopupEvents(state, activePlayer, this.pendingLandingSummary, layer);
      return;
    }

    // 9. Modal Quản Lý Danh Mục Đất & Nhà
    if (this.showPortfolioModal) {
      layer.innerHTML = this.buildPortfolioModalHTML(state);
      this.bindPortfolioModalEvents(state, layer);
      return;
    }

    // 10. Modal Tạo Đề Nghị Giao Dịch
    if (this.showTradeModal) {
      layer.innerHTML = this.buildCreateTradeModalHTML(state);
      this.bindCreateTradeEvents(state, layer);
      return;
    }

    // 11. Modal Luật Chơi
    if (this.showRulesModal) {
      layer.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-40 ui-interactive" id="rules-backdrop">
          <div class="w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 space-y-3 text-xs text-slate-300 shadow-2xl modal-pop" onclick="event.stopPropagation()">
            <div class="text-sm font-extrabold text-amber-400">📖 LUẬT CỜ TỶ PHÚ VIỆT NAM 3D (40 Ô &amp; 52 Ô)</div>
            <ul class="list-disc pl-4 space-y-1.5 leading-relaxed">
              <li><b>Bản 40 Ô (2–4 người):</b> Vốn <b class="text-white mono-num">2000K</b>, qua Khởi Hành nhận <b class="text-emerald-400 mono-num">+200K</b>.</li>
              <li><b>Bản Đại Chiến 52 Ô (2–6 người):</b> Vốn <b class="text-white mono-num">2500K</b>, qua Khởi Hành <b class="text-emerald-400 mono-num">+250K</b> (dừng đúng ô nhận <b class="text-amber-300 mono-num">+350K</b>).</li>
              <li><b>Quy Hoạch Linh Hoạt (52 Ô):</b> Gom đủ <b>2/3 bộ màu</b> được xây tối đa <b>🏠 2 Nhà phố</b>; gom đủ <b>trọn bộ</b> mở khóa <b>🏨 Khách sạn</b> &amp; <b>🏙️ Landmark Cấp 6</b>.</li>
              <li><b>Xúc Xắc Tốc Độ (Từ vòng 2 bản 52 Ô):</b> Cộng thêm 1–3 bước, bắt <b>🚌 Xe Buýt Nhanh</b> hoặc <b>🎩 Tỷ Phú</b> bay thẳng tới đất trống tiếp theo.</li>
              <li><b>Liên Minh 2v2v2:</b> Miễn 100% tiền thuê đồng đội, gộp chung bộ màu độc quyền và hỗ trợ <b>Cứu trợ Phá sản</b> 1 lần/ván.</li>
              <li>Mọi ô sự kiện và bảng thông tin đều có nút <b>➖ Thu gọn</b> để bạn tự do quan sát bàn cờ 3D.</li>
            </ul>
            <button id="btn-close-rules" class="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 font-extrabold text-slate-950 transition">Đã Hiểu</button>
          </div>
        </div>
      `;
      const closeRules = () => {
        this.showRulesModal = false;
        this.renderModals(state);
      };
      layer.querySelector('#btn-close-rules').onclick = closeRules;
      layer.querySelector('#rules-backdrop').onclick = closeRules;
      return;
    }

    layer.innerHTML = '';
  }

  bindCollapseTriggers(layer) {
    layer.querySelectorAll('[data-collapse-popup]').forEach(btn => {
      btn.addEventListener('click', () => this.setEventPopupCollapsed(true));
    });
    layer.querySelectorAll('[data-collapse-backdrop]').forEach(bg => {
      bg.addEventListener('click', () => this.setEventPopupCollapsed(true));
    });
    layer.querySelectorAll('[data-expand-popup]').forEach(btn => {
      btn.addEventListener('click', () => this.setEventPopupCollapsed(false));
    });
  }

  // ==================== POPUP XE BUÝT NHANH & CHUYỂN TUYẾN METRO ====================

  buildSpeedBusPopupHTML(state, player) {
    const targets = state.busTargets || {};
    const cardTile = targets.cardIndex !== null && targets.cardIndex !== undefined ? state.board[targets.cardIndex] : null;
    const stationTile = targets.stationIndex !== null && targets.stationIndex !== undefined ? state.board[targets.stationIndex] : null;

    if (this.eventPopupCollapsed) {
      return `
        <div id="event-popup-modal" class="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 ui-interactive modal-pop">
          <div class="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 border-amber-400 shadow-2xl">
            <span class="text-base">🚌</span>
            <span class="text-xs font-extrabold text-amber-300 whitespace-nowrap">Xe Buýt Nhanh:</span>
            ${cardTile ? `<button data-bus-dest="${cardTile.index}" class="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-[11px] font-extrabold text-white whitespace-nowrap">${cardTile.icon || '❓'} ${escapeHtml(cardTile.shortName)} (#${cardTile.index})</button>` : ''}
            ${stationTile ? `<button data-bus-dest="${stationTile.index}" class="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-[11px] font-extrabold text-slate-950 whitespace-nowrap">${stationTile.icon || '🚇'} ${escapeHtml(stationTile.shortName)} (#${stationTile.index})</button>` : ''}
            <button id="btn-bus-stay" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-slate-200 whitespace-nowrap">🚏 Đứng yên</button>
            <button data-expand-popup class="px-2 py-1 rounded-lg bg-slate-800 text-[11px] font-bold text-amber-300">🔼 Mở</button>
          </div>
        </div>
      `;
    }

    return `
      <div id="event-popup-modal" data-collapse-backdrop class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 ui-interactive">
        <div class="w-full max-w-[340px] bg-slate-900/95 border-2 border-amber-400 rounded-2xl overflow-hidden shadow-2xl modal-pop" onclick="event.stopPropagation()">
          <div class="px-4 py-2.5 bg-amber-500 text-slate-950 flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-base">🚌</span>
              <span class="text-[11px] font-extrabold uppercase tracking-wider">XÚC XẮC XE BUÝT NHANH</span>
            </div>
            <button data-collapse-popup class="px-2 py-0.5 rounded-lg bg-slate-950/20 hover:bg-slate-950/35 text-[10px] font-extrabold text-slate-950">
              ➖ Thu gọn
            </button>
          </div>

          <div class="p-4 text-center space-y-2.5">
            <h3 class="text-base font-extrabold text-white">Chọn Hành Trình Tiếp Theo</h3>
            <p class="text-[11.5px] text-slate-300 leading-relaxed">
              Nhờ mặt <b>🚌 Xe Buýt Nhanh</b>, ${escapeHtml(player.name)} được quyền nhảy thẳng tới một trong các điểm phía trước hoặc dừng lại tại chỗ:
            </p>

            <div class="space-y-1.5 pt-1">
              ${cardTile ? `
                <button data-bus-dest="${cardTile.index}" class="w-full py-2 px-3 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-extrabold text-xs flex items-center justify-between transition">
                  <span>${cardTile.icon || '❓'} Đến ô ${escapeHtml(cardTile.name)}</span>
                  <span class="mono-num">#${cardTile.index}</span>
                </button>
              ` : ''}
              ${stationTile ? `
                <button data-bus-dest="${stationTile.index}" class="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center justify-between transition">
                  <span>${stationTile.icon || '🚇'} Đến ${escapeHtml(stationTile.name)}</span>
                  <span class="mono-num">#${stationTile.index}</span>
                </button>
              ` : ''}
              <button id="btn-bus-stay" class="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs transition">
                🚏 Đứng Yên Tại Ô Hiện Tại (#${player.position})
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindSpeedBusPopupEvents(player, layer) {
    layer.querySelectorAll('[data-bus-dest]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetIndex = Number(btn.getAttribute('data-bus-dest'));
        this.handlers.onAction('USE_SPEED_BUS', { targetIndex }, player.id);
      });
    });
    layer.querySelector('#btn-bus-stay')?.addEventListener('click', () => {
      this.handlers.onAction('SKIP_SPEED_BUS', {}, player.id);
    });
  }

  buildTransitTeleportModalHTML(state, player, transit) {
    const currentTile = state.board[transit.fromIndex];
    return `
      <div id="transit-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 ui-interactive">
        <div class="w-full max-w-[360px] bg-slate-900/95 border-2 border-sky-400 rounded-2xl overflow-hidden shadow-2xl modal-pop" onclick="event.stopPropagation()">
          <div class="px-4 py-2.5 bg-sky-600 text-white flex items-center justify-between">
            <span class="text-xs font-extrabold uppercase tracking-wider">🚇 CHUYỂN TUYẾN TỐC HÀNH</span>
            <button id="btn-close-transit" class="px-2 py-0.5 rounded bg-slate-950/30 hover:bg-slate-950/50 text-[10px] font-bold">✕ Đóng</button>
          </div>
          <div class="p-4 space-y-2.5">
            <p class="text-[11.5px] text-slate-300 leading-relaxed">
              Khởi hành từ <b>${escapeHtml(currentTile.name)}</b>. ${
                transit.fee === 0
                  ? 'Bạn được <b class="text-emerald-400">miễn phí vé</b> do trạm thuộc sở hữu của bạn/đồng đội!'
                  : `Phí mua vé chuyển tuyến: <b class="text-amber-300 mono-num">-${transit.fee}K</b>.`
              }
            </p>
            <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              ${transit.destinations.map(dest => {
                const owner = dest.ownerId ? state.players.find(p => p.id === dest.ownerId) : null;
                return `
                  <button data-transit-dest="${dest.index}" class="w-full p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-between text-xs transition">
                    <div class="text-left">
                      <div class="font-extrabold text-white">${dest.icon || '🚇'} ${escapeHtml(dest.name)} (#${dest.index})</div>
                      <div class="text-[10px] text-slate-400">
                        ${owner ? `Chủ trạm: ${escapeHtml(owner.name)}` : `Chưa có chủ (Mua ${dest.price}K)`}
                      </div>
                    </div>
                    <span class="px-2 py-1 rounded-lg bg-sky-500 text-slate-950 font-extrabold text-[10.5px]">Bay Tới</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindTransitTeleportModalEvents(state, player, layer) {
    const closeFn = () => {
      this.showTransitModal = false;
      this.renderModals(state);
    };
    layer.querySelector('#btn-close-transit')?.addEventListener('click', closeFn);
    layer.querySelector('#transit-backdrop')?.addEventListener('click', closeFn);
    layer.querySelectorAll('[data-transit-dest]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetIndex = Number(btn.getAttribute('data-transit-dest'));
        this.showTransitModal = false;
        this.handlers.onAction('TRANSIT_TELEPORT', { targetIndex }, player.id);
      });
    });
  }

  // ==================== POPUP MUA ĐẤT & TỔNG KẾT LƯỢT ĐI (THU GỌN / MỞ RỘNG) ====================

  buildUnownedLandingPopupHTML(state, player, tile) {
    const palette = GROUP_COLORS[tile.group] || GROUP_COLORS.NONE;
    const pIdx = state.players.findIndex(p => p.id === player.id);
    const icon = player.icon || PLAYER_PRESETS[pIdx]?.icon || '🐉';
    const d1 = state.dice?.[0] || 1;
    const d2 = state.dice?.[1] || 1;
    const speedDie = state.speedDie;
    const canAfford = player.cash >= tile.price;
    const baseRentText = tile.rent ? `⚡${tile.rent[0]}K` : tile.type === 'UTILITY' ? '⚡4x🎲' : '⚡25K';

    if (this.eventPopupCollapsed) {
      return `
        <div id="event-popup-modal" class="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 ui-interactive modal-pop">
          <div class="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 border-slate-600 shadow-2xl">
            <span class="w-3 h-6 rounded shrink-0" style="background:${palette.primary}"></span>
            <div class="text-xs font-extrabold text-white whitespace-nowrap">
              ${escapeHtml(tile.shortName || tile.name)} <span class="text-amber-400 mono-num ml-1">${tile.price}K</span>
            </div>
            <button id="popup-btn-buy" ${!canAfford ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg font-extrabold text-[11px] ${
              canAfford ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            } transition whitespace-nowrap">
              🏠 Mua
            </button>
            <button id="popup-btn-auction" class="px-2.5 py-1 rounded-lg font-extrabold text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 transition whitespace-nowrap">
              🔨 Đấu giá
            </button>
            <button data-expand-popup title="Mở rộng ô sự kiện" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-600 transition whitespace-nowrap">
              🔼 Mở
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div id="event-popup-modal" data-collapse-backdrop class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 ui-interactive">
        <div class="w-full max-w-[330px] bg-slate-900/95 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl modal-pop" onclick="event.stopPropagation()">
          <div class="px-4 py-2.5 text-white flex items-center justify-between" style="background:${palette.primary}">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-base">🏞️</span>
              <span class="text-[11px] font-extrabold uppercase tracking-wider truncate">ĐẤT TRỐNG</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <div class="flex items-center gap-1 bg-slate-950/25 px-1.5 py-0.5 rounded-lg">
                ${createMiniPipDieHTML(d1)}${createMiniPipDieHTML(d2)}${createMiniSpeedDieHTML(speedDie)}
              </div>
              <button data-collapse-popup title="Thu gọn để xem bàn cờ" class="px-2 py-1 rounded-lg bg-slate-950/30 hover:bg-slate-950/50 text-[10px] font-extrabold text-white transition">
                ➖ Thu gọn
              </button>
            </div>
          </div>

          <div class="p-4 text-center space-y-2.5">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200">
              <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style="background:${player.color}">${icon}</span>
              <span>${escapeHtml(player.name)}</span>
              <span class="text-amber-400 mono-num">(${player.cash}K)</span>
            </div>

            <h3 class="text-lg font-extrabold text-white tracking-tight">${escapeHtml(tile.name)}</h3>
            <div class="text-xl font-extrabold text-amber-400 mono-num">Giá mua: ${tile.price}K</div>

            <div class="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 text-[11px] space-y-1 text-left">
              <div class="flex justify-between"><span>Nhóm:</span><b class="text-white">${escapeHtml(palette.label)}</b></div>
              <div class="flex justify-between"><span>Thuê cơ bản:</span><b class="text-emerald-400 mono-num">${baseRentText}</b></div>
              <div class="flex justify-between"><span>Số dư sau mua:</span><b class="${canAfford ? 'text-amber-300' : 'text-rose-400'} mono-num">${player.cash - tile.price}K</b></div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <button id="popup-btn-buy" ${!canAfford ? 'disabled' : ''} class="py-2 px-2.5 rounded-xl font-extrabold text-xs ${
                canAfford
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              } transition">
                🏠 Mua (-${tile.price}K)
              </button>
              <button id="popup-btn-auction" class="py-2 px-2.5 rounded-xl font-extrabold text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 transition">
                🔨 Đấu Giá
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindUnownedLandingPopupEvents(player, layer) {
    layer.querySelector('#popup-btn-buy')?.addEventListener('click', () => {
      this.handlers.onAction('BUY_PROPERTY', {}, player.id);
    });
    layer.querySelector('#popup-btn-auction')?.addEventListener('click', () => {
      this.handlers.onAction('SKIP_PROPERTY', {}, player.id);
    });
  }

  buildPostRollSummaryPopupHTML(state, player, summary) {
    const tile = state.board[summary.tileIndex];
    const pIdx = state.players.findIndex(p => p.id === player.id);
    const icon = player.icon || PLAYER_PRESETS[pIdx]?.icon || '🐉';
    const d1 = summary.dice?.[0] || state.dice?.[0] || 1;
    const d2 = summary.dice?.[1] || state.dice?.[1] || 1;
    const speedDie = summary.speedDie ?? state.speedDie;

    const isDoubleBonus = state.dice[0] === state.dice[1] && !player.inJail && !state.escapedJailByDouble && state.doubleCount > 0;
    const finishBtnText = isDoubleBonus ? '🎲 Đổ Tiếp Lượt Đôi' : '✅ Hoàn Tất Lượt';
    const isNegativeDebt = state.phase === 'BANKRUPTCY_CHECK' || player.cash < 0;
    const bailoutInfo = getAllyBailoutInfo(state, player.id);

    let headerBg = '#475569';
    let badgeIcon = tile.icon || '📍';
    let category = 'SỰ KIỆN LƯỢT ĐI';
    let highlight = 'An Toàn';
    let highlightClass = 'text-2xl font-extrabold text-emerald-400 mono-num py-1';
    let desc = `Bạn vừa dừng chân tại ${tile.name}.`;
    let metaHTML = `<div class="flex justify-between"><span>Số dư hiện tại:</span><b class="text-amber-400 mono-num">${player.cash}K</b></div>`;
    let actionsHTML = '';

    if (summary.stayedInJail) {
      headerBg = '#475569';
      badgeIcon = '⛓️';
      category = 'NHÀ TÙ CÔN ĐẢO';
      highlight = `Tạm giam (${player.jailTurns}/3)`;
      highlightClass = 'text-2xl font-extrabold text-amber-400 mono-num py-1';
      desc = 'Bạn chưa đổ ra cặp số Đôi nên tiếp tục ở lại Nhà Tù Côn Đảo.';
    } else if (tile.ownerId && tile.ownerId !== player.id) {
      const owner = state.players.find(p => p.id === tile.ownerId);
      const oIdx = state.players.findIndex(p => p.id === tile.ownerId);
      const oIcon = owner?.icon || PLAYER_PRESETS[oIdx]?.icon || '👑';
      const isAlly = areTeammates(state, owner?.id, player.id);

      headerBg = tile.isMortgaged || isAlly ? '#059669' : '#dc2626';
      badgeIcon = isAlly ? '🤝' : tile.isMortgaged ? '🔒' : '⚡';
      category = isAlly ? 'ĐẤT ĐỒNG ĐỘI LIÊN MINH' : 'ĐẤT ĐÃ CÓ CHỦ SỞ HỮU';

      if (isAlly) {
        highlight = 'Miễn Thuê (0K)';
        highlightClass = 'text-2xl font-extrabold text-emerald-400 mono-num py-1';
        desc = `${tile.name} thuộc sở hữu đồng đội ${owner?.name} trong Liên minh nên bạn được miễn 100% tiền thuê!`;
      } else if (tile.isMortgaged) {
        highlight = 'Miễn Thuê (0K)';
        highlightClass = 'text-2xl font-extrabold text-emerald-400 mono-num py-1';
        desc = `${tile.name} của ${owner?.name} đang thế chấp ngân hàng nên bạn không phải trả tiền thuê!`;
      } else {
        const paid = summary.negativeDelta || getTileRentInfo(state, tile)?.amount || 0;
        highlight = `-${paid}K`;
        highlightClass = 'text-3xl font-extrabold text-rose-400 mono-num py-1';
        desc = `Bạn đã đi vào bất động sản của ${owner?.name} và thanh toán tiền thuê.`;
      }

      const lvLabel = tile.isMortgaged
        ? '🔒 Đang thế chấp'
        : tile.level === 6
          ? '🏙️ Landmark Cấp 6'
          : tile.level === 5
            ? '🏨 Khách sạn 5 sao'
            : tile.level > 0
              ? `🏠 ${tile.level} Nhà phố`
              : 'Đất trống';

      metaHTML = `
        <div class="flex justify-between"><span>Chủ sở hữu:</span><b style="color:${owner?.color || '#fff'}">${oIcon} ${escapeHtml(owner?.name)}</b></div>
        <div class="flex justify-between"><span>Cấp độ tài sản:</span><b class="text-emerald-400">${lvLabel}</b></div>
        <div class="flex justify-between"><span>Số dư hiện tại:</span><b class="${player.cash < 0 ? 'text-rose-400' : 'text-amber-300'} mono-num">${player.cash}K</b></div>
      `;
    } else if (tile.ownerId === player.id) {
      headerBg = '#0284c7';
      badgeIcon = '🏗️';
      category = 'BẤT ĐỘNG SẢN CỦA BẠN';
      const canBuild = canBuildHouseState(state, player.id, tile.index);
      const rentInfo = getTileRentInfo(state, tile);
      const maxLv = state.boardPreset === 'MEGA_52' ? 6 : 5;
      highlight = canBuild
        ? `Xây thêm: -${tile.buildCost}K`
        : tile.level >= maxLv
          ? (maxLv === 6 ? '🏙️ Đạt Cấp Landmark' : '🏨 Cấp Tối Đa')
          : (rentInfo?.inspectorText || 'Sở Hữu');
      highlightClass = 'text-2xl font-extrabold text-sky-400 mono-num py-1';
      desc = canBuild
        ? `Chào mừng chủ nhân quay lại ${tile.name}! Bạn đủ điều kiện nâng cấp công trình 3D ngay.`
        : `Bạn đang đứng trên bất động sản thuộc quyền sở hữu của mình.`;
      metaHTML = `
        <div class="flex justify-between"><span>Cấp hiện tại:</span><b class="text-emerald-400">${tile.level === 6 ? '🏙️ Landmark' : tile.level === 5 ? '🏨 Khách sạn' : `🏠 ${tile.level} Nhà phố`}</b></div>
        <div class="flex justify-between"><span>Thuê hiện tại:</span><b class="text-amber-400 mono-num">${rentInfo?.inspectorText || '-'}</b></div>
      `;

      if (canBuild && !isNegativeDebt) {
        actionsHTML = `
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button id="popup-btn-upgrade" class="py-2 px-2.5 rounded-xl font-extrabold text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg transition">
              🏗️ Nâng Cấp (-${tile.buildCost}K)
            </button>
            <button id="popup-btn-finish" class="py-2 px-2.5 rounded-xl font-extrabold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition">
              ${finishBtnText}
            </button>
          </div>
        `;
      }
    } else if (tile.type === 'TAX') {
      headerBg = '#dc2626';
      badgeIcon = '💸';
      category = 'NỘP THUẾ NGÂN HÀNG';
      highlight = `-${tile.taxAmount}K`;
      highlightClass = 'text-3xl font-extrabold text-rose-400 mono-num py-1';
      desc = state.boardPreset === 'MEGA_52'
        ? `Bạn dừng tại ${tile.name}. Khoản thuế được chuyển vào Quỹ Lễ Hội (#26)!`
        : `Bạn dừng tại ${tile.name} và đã khấu trừ thuế vào Ngân hàng.`;
      metaHTML = `<div class="flex justify-between"><span>Số dư sau nộp thuế:</span><b class="${player.cash < 0 ? 'text-rose-400' : 'text-amber-300'} mono-num">${player.cash}K</b></div>`;
    } else {
      headerBg = '#059669';
      badgeIcon = tile.icon || '🚩';
      category = tile.type === 'FREE_PARKING' && summary.festivalGain > 0 ? 'TRÚNG QUỸ LỄ HỘI!' : 'ĐIỂM DỪNG AN TOÀN';
      const startBonus = state.boardPreset === 'MEGA_52' ? (tile.type === 'START' ? '+350K Thưởng' : '+250K Lương') : '+200K Lương';
      highlight = summary.festivalGain > 0
        ? `+${summary.festivalGain}K Quỹ Lễ Hội`
        : summary.passedStart || tile.type === 'START'
          ? startBonus
          : (tile.sub || 'An Toàn');
      highlightClass = 'text-2xl font-extrabold text-emerald-400 mono-num py-1';
      desc = summary.festivalGain > 0
        ? `Chúc mừng! Bạn đã nhận toàn bộ Quỹ Lễ Hội tích lũy tại ${tile.name}!`
        : `Bạn dừng chân an toàn tại ${tile.name}.`;
    }

    if (!actionsHTML) {
      if (isNegativeDebt) {
        actionsHTML = `
          <div class="space-y-1.5 pt-1">
            ${bailoutInfo ? `
              <button id="popup-btn-bailout" class="w-full py-2 rounded-xl font-extrabold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition">
                🤝 Nhận Cứu Trợ Liên Minh Từ ${escapeHtml(bailoutInfo.allyName)} (-${bailoutInfo.amount}K)
              </button>
            ` : ''}
            <button id="popup-btn-rescue" class="w-full py-2 rounded-xl font-extrabold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition">
              ⚠️ Mở Quản Lý Bán Nhà / Thế Chấp Cứu Nợ
            </button>
          </div>
        `;
      } else {
        actionsHTML = `
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button id="popup-btn-finish" class="py-2 px-2.5 rounded-xl font-extrabold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg transition">
              ${finishBtnText}
            </button>
            <button id="popup-btn-manage" class="py-2 px-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition">
              🏘️ Quản Lý Thêm
            </button>
          </div>
        `;
      }
    }

    if (this.eventPopupCollapsed) {
      const canBuildOwn = tile.ownerId === player.id && canBuildHouseState(state, player.id, tile.index) && !isNegativeDebt;
      return `
        <div id="event-popup-modal" class="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 ui-interactive modal-pop">
          <div class="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 border-slate-600 shadow-2xl">
            <span class="text-base">${badgeIcon}</span>
            <div class="text-xs font-extrabold text-white whitespace-nowrap">
              ${escapeHtml(tile.shortName || tile.name)} <span class="text-amber-400 mono-num ml-1">${escapeHtml(highlight)}</span>
            </div>
            ${isNegativeDebt ? `
              ${bailoutInfo ? `<button id="popup-btn-bailout" class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-[11px] font-extrabold text-white whitespace-nowrap">🤝 Cứu trợ</button>` : ''}
              <button id="popup-btn-rescue" class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-extrabold text-white whitespace-nowrap">
                ⚠️ Cứu Nợ
              </button>
            ` : `
              ${canBuildOwn ? `<button id="popup-btn-upgrade" class="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-[11px] font-extrabold text-slate-950 whitespace-nowrap">+🏠 (-${tile.buildCost}K)</button>` : ''}
              <button id="popup-btn-finish" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[11px] font-extrabold text-slate-950 whitespace-nowrap">
                ${isDoubleBonus ? '🎲 Đổ tiếp' : '✅ Xong lượt'}
              </button>
            `}
            <button data-expand-popup title="Mở rộng ô sự kiện" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-600 transition whitespace-nowrap">
              🔼 Mở
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div id="event-popup-modal" data-collapse-backdrop class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 ui-interactive">
        <div class="w-full max-w-[330px] bg-slate-900/95 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl modal-pop" onclick="event.stopPropagation()">
          <div class="px-4 py-2.5 text-white flex items-center justify-between" style="background:${headerBg}">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-base">${badgeIcon}</span>
              <span class="text-[11px] font-extrabold uppercase tracking-wider truncate">${category}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <div class="flex items-center gap-1 bg-slate-950/25 px-1.5 py-0.5 rounded-lg">
                ${createMiniPipDieHTML(d1)}${createMiniPipDieHTML(d2)}${createMiniSpeedDieHTML(speedDie)}
              </div>
              <button data-collapse-popup title="Thu gọn để xem bàn cờ" class="px-2 py-1 rounded-lg bg-slate-950/30 hover:bg-slate-950/50 text-[10px] font-extrabold text-white transition">
                ➖ Thu gọn
              </button>
            </div>
          </div>

          <div class="p-4 text-center space-y-2.5">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200">
              <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style="background:${player.color}">${icon}</span>
              <span>${escapeHtml(player.name)}</span>
              <span class="text-amber-400 mono-num">(${player.cash}K)</span>
            </div>

            <h3 class="text-lg font-extrabold text-white tracking-tight">${escapeHtml(tile.name)}</h3>
            <div class="${highlightClass}">${escapeHtml(highlight)}</div>
            <p class="text-[11.5px] text-slate-300 leading-relaxed">${escapeHtml(desc)}</p>

            <div class="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 text-[11px] space-y-1 text-left">
              ${metaHTML}
            </div>

            ${actionsHTML}
          </div>
        </div>
      </div>
    `;
  }

  bindPostRollSummaryPopupEvents(state, player, summary, layer) {
    layer.querySelector('#popup-btn-upgrade')?.addEventListener('click', () => {
      this.pendingLandingSummary = null;
      this.handlers.onAction('BUILD_HOUSE', { tileIndex: summary.tileIndex }, player.id);
    });

    layer.querySelector('#popup-btn-finish')?.addEventListener('click', () => {
      this.pendingLandingSummary = null;
      this.handlers.onAction('END_TURN', {}, player.id);
    });

    layer.querySelector('#popup-btn-manage')?.addEventListener('click', () => {
      this.pendingLandingSummary = null;
      this.renderModals(state);
    });

    layer.querySelector('#popup-btn-bailout')?.addEventListener('click', () => {
      this.pendingLandingSummary = null;
      this.handlers.onAction('ALLY_BAILOUT', {}, player.id);
    });

    layer.querySelector('#popup-btn-rescue')?.addEventListener('click', () => {
      this.pendingLandingSummary = null;
      this.showPortfolioModal = true;
      this.renderModals(state);
    });
  }

  // ==================== 5. MODAL THẺ CƠ HỘI / KHÍ VẬN (CÓ THU GỌN) ====================

  showDeckPreviewModal(deckType) {
    const cards = deckType === 'CHANCE' ? CHANCE_CARDS : COMMUNITY_CARDS;
    const sample = cards[Math.floor(Math.random() * cards.length)];
    this.openCardVisualModal(deckType, sample, { isPreview: true });
  }

  showChanceOrCommunityCardModal(deck, card, playerId, state, dice = [1, 1], speedDie = null) {
    const isHumanLocal = this.isLocalHumanPlayer(playerId, state);
    return this.openCardVisualModal(deck, card, {
      isPreview: false,
      autoCloseMs: isHumanLocal ? (this.networkInfo.mode === 'LOCAL' ? 0 : 9000) : 1800,
      dice,
      speedDie
    });
  }

  openCardVisualModal(deck, card, { isPreview = false, autoCloseMs = 0, dice = null, speedDie = null } = {}) {
    const cardLayer = this.root.querySelector('#card-modal-layer');
    const isChance = deck === 'CHANCE';
    const impactColor = card.tone === 'positive'
      ? 'text-emerald-400'
      : card.tone === 'negative'
        ? 'text-rose-400'
        : 'text-amber-400';

    return new Promise((resolve) => {
      let done = false;
      let collapsed = false;

      const finish = () => {
        if (done) return;
        done = true;
        cardLayer.innerHTML = '';
        resolve();
      };

      const renderCard = () => {
        if (done) return;
        if (collapsed) {
          cardLayer.innerHTML = `
            <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 ui-interactive modal-pop">
              <div class="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 ${isChance ? 'border-orange-400' : 'border-amber-400'} shadow-2xl">
                <span class="text-base">${isChance ? '❓' : '🧧'}</span>
                <div class="text-xs font-bold text-white whitespace-nowrap">
                  ${escapeHtml(card.title || (isChance ? 'Thẻ Cơ Hội' : 'Thẻ Khí Vận'))}
                  <span class="mono-num font-extrabold ${impactColor} ml-1">${escapeHtml(card.impact || '')}</span>
                </div>
                <button id="btn-ack-card" class="px-3 py-1 rounded-lg ${
                  isChance ? 'bg-orange-500 hover:bg-orange-400 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                } font-extrabold text-[11px] transition whitespace-nowrap">
                  ${isPreview ? 'Đóng' : '✨ Nhận'}
                </button>
                <button id="btn-expand-card" title="Mở rộng thẻ bài" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-slate-200 transition">
                  🔼 Mở
                </button>
              </div>
            </div>
          `;
          cardLayer.querySelector('#btn-ack-card')?.addEventListener('click', finish);
          cardLayer.querySelector('#btn-expand-card')?.addEventListener('click', () => {
            collapsed = false;
            renderCard();
          });
          return;
        }

        cardLayer.innerHTML = `
          <div id="card-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 ui-interactive">
            <div class="w-full max-w-[330px] bg-slate-900/95 border-2 ${isChance ? 'border-orange-400' : 'border-amber-400'} rounded-2xl overflow-hidden text-center shadow-2xl modal-pop" onclick="event.stopPropagation()">
              <div class="px-4 py-2.5 ${isChance ? 'bg-orange-500 text-white' : 'bg-amber-400 text-slate-950'} flex items-center justify-between">
                <span class="text-[11px] font-extrabold uppercase tracking-wider truncate">
                  ${isChance ? '❓ THẺ CƠ HỘI' : '🧧 THẺ KHÍ VẬN'}
                </span>
                <div class="flex items-center gap-1.5 shrink-0">
                  ${dice ? `<div class="flex items-center gap-1 bg-slate-950/20 px-1.5 py-0.5 rounded-lg">${createMiniPipDieHTML(dice[0])}${createMiniPipDieHTML(dice[1])}${createMiniSpeedDieHTML(speedDie)}</div>` : `<span class="text-[10px] font-bold opacity-80">Xem thử</span>`}
                  <button id="btn-collapse-card" title="Thu gọn để xem bàn cờ" class="px-2 py-1 rounded-lg bg-slate-950/20 hover:bg-slate-950/35 text-[10px] font-extrabold transition">
                    ➖ Thu gọn
                  </button>
                </div>
              </div>

              <div class="p-4 space-y-2.5">
                <div class="text-2xl font-extrabold mono-num ${impactColor}">
                  ${escapeHtml(card.impact || (isChance ? 'CƠ HỘI' : 'KHÍ VẬN'))}
                </div>
                <h3 class="text-base font-extrabold text-white">
                  ${escapeHtml(card.title || (isChance ? 'Sự Kiện Cơ Hội' : 'Hòm Khí Vận'))}
                </h3>
                <p class="text-[11.5px] text-slate-300 leading-relaxed pb-1">
                  ${escapeHtml(card.text)}
                </p>
                <button id="btn-ack-card" class="w-full py-2 rounded-xl ${
                  isChance ? 'bg-orange-500 hover:bg-orange-400 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                } font-extrabold text-xs shadow-lg transition">
                  ${isPreview ? 'Đóng Xem Thử' : '✨ Nhận Hiệu Ứng Thẻ'}
                </button>
              </div>
            </div>
          </div>
        `;
        cardLayer.querySelector('#btn-ack-card')?.addEventListener('click', finish);
        const collapseFn = () => {
          if (isPreview) {
            finish();
            return;
          }
          collapsed = true;
          renderCard();
        };
        cardLayer.querySelector('#btn-collapse-card')?.addEventListener('click', () => {
          collapsed = true;
          renderCard();
        });
        cardLayer.querySelector('#card-backdrop')?.addEventListener('click', collapseFn);
      };

      renderCard();
      if (autoCloseMs > 0) {
        setTimeout(finish, autoCloseMs);
      }
    });
  }

  // ==================== 6. SÀN ĐẤU GIÁ (HỖ TRỢ 6 NGƯỜI + THU GỌN), DANH MỤC ĐẤT & GIAO DỊCH ====================

  buildAuctionModalHTML(state) {
    const auction = state.auction;
    const tile = state.board[auction.tileIndex];
    const palette = GROUP_COLORS[tile.group] || GROUP_COLORS.NONE;
    const leader = state.players.find(p => p.id === auction.highestBidderId);

    const key = `${auction.tileIndex}-${auction.highestBid}-${auction.highestBidderId}`;
    if (this.auctionTrackKey !== key) {
      this.auctionTrackKey = key;
      this.auctionResetTimestamp = performance.now();
    }

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

    if (this.eventPopupCollapsed) {
      const quickNext = baseBid + 10;
      const canQuickBid = !hasFolded && bidder && bidder.cash >= quickNext;
      return `
        <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 ui-interactive modal-pop">
          <div class="rounded-2xl bg-slate-900/95 border-2 border-amber-400/80 overflow-hidden shadow-2xl">
            <div class="w-full h-1.5 bg-slate-800">
              <div id="auction-timer-bar" class="h-full bg-amber-400 transition-all duration-100" style="width:100%"></div>
            </div>
            <div class="flex items-center gap-2 px-3.5 py-2">
              <span class="text-sm">🔨</span>
              <div class="text-xs font-extrabold text-white whitespace-nowrap">
                ${escapeHtml(tile.shortName || tile.name)}: <span class="text-amber-400 mono-num">${auction.highestBid}K</span>
              </div>
              ${canQuickBid ? `<button data-bid-amount="${quickNext}" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 mono-num font-extrabold text-[11px] text-slate-950 whitespace-nowrap">+10K (${quickNext}K)</button>` : ''}
              ${!hasFolded ? `<button id="btn-auction-fold" class="px-2 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-[11px] font-bold text-white whitespace-nowrap">🏳️ Bỏ</button>` : ''}
              <button data-expand-popup class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-slate-200 whitespace-nowrap">🔼 Mở sàn</button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div data-collapse-backdrop class="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-40 ui-interactive">
        <div class="w-full max-w-[360px] bg-slate-900/95 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl modal-pop" onclick="event.stopPropagation()">
          <div class="px-4 py-3 flex items-center justify-between text-white" style="background:${palette.primary}">
            <div class="min-w-0 pr-2">
              <div class="text-[10px] font-bold uppercase opacity-90">🔨 Sàn Đấu Giá (10s)</div>
              <div class="text-sm font-extrabold uppercase truncate">${escapeHtml(tile.name)}</div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <div class="text-[11px] mono-num font-extrabold px-2 py-0.5 rounded-lg bg-slate-950/35">Gốc: ${tile.price}K</div>
              <button data-collapse-popup title="Thu gọn để xem bàn cờ" class="px-2 py-1 rounded-lg bg-slate-950/30 hover:bg-slate-950/50 text-[10px] font-extrabold text-white transition">
                ➖ Thu gọn
              </button>
            </div>
          </div>

          <div class="w-full h-1.5 bg-slate-800">
            <div id="auction-timer-bar" class="h-full bg-amber-400 transition-all duration-100" style="width:100%"></div>
          </div>

          <div class="p-4 space-y-3 text-center">
            ${this.networkInfo.mode === 'LOCAL' && humanCandidates.length > 1 ? `
              <div class="flex flex-wrap justify-center gap-1.5">
                ${humanCandidates.map(p => `
                  <button data-local-bidder="${p.id}" class="px-2 py-1 rounded-xl text-[10.5px] font-bold border ${
                    p.id === bidderId ? 'border-amber-400 bg-amber-500/20 text-white' : 'border-slate-700 bg-slate-800 text-slate-400'
                  }">${escapeHtml(p.icon || '')} ${escapeHtml(p.name)} (${p.cash}K)</button>
                `).join('')}
              </div>
            ` : ''}

            <div>
              <div class="text-[11px] text-slate-400">Mức trả cao nhất hiện tại</div>
              <div class="mono-num text-3xl font-extrabold text-amber-400 mt-0.5">${auction.highestBid}K</div>
              <div class="text-[11px] text-slate-300 mt-0.5">
                Dẫn đầu: <b>${leader ? escapeHtml(leader.name) : 'Chưa có ai trả giá'}</b>
              </div>
            </div>

            ${hasFolded ? `
              <div class="py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-400">Bạn đã rút lui khỏi phiên đấu giá này.</div>
            ` : `
              <div class="flex justify-center gap-1.5">
                ${increments.map(inc => {
                  const nextAmt = baseBid + inc;
                  if (bidder.cash < nextAmt) return '';
                  return `<button data-bid-amount="${nextAmt}" class="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 mono-num font-extrabold text-xs text-slate-950 transition">+${inc}K (${nextAmt}K)</button>`;
                }).join('')}
              </div>
              <button id="btn-auction-fold" class="w-full py-2 rounded-xl bg-rose-700/85 hover:bg-rose-600 font-bold text-xs text-white transition">
                🏳️ Bỏ Cuộc Phiên Này
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  bindAuctionEvents(state, layer) {
    this.bindCollapseTriggers(layer);
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

  buildPortfolioModalHTML(state) {
    const myId = this.getEffectivePlayerId(state);
    const owned = state.board.filter(t => t.ownerId === myId);

    return `
      <div id="portfolio-backdrop" class="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-40 ui-interactive">
        <div class="w-full max-w-lg bg-slate-900/95 border-2 border-slate-700 rounded-2xl p-4 space-y-3 max-h-[82vh] flex flex-col shadow-2xl modal-pop" onclick="event.stopPropagation()">
          <div class="flex justify-between items-center border-b border-slate-800 pb-2">
            <span class="font-extrabold text-sm text-amber-400">🏘️ DANH MỤC SỔ ĐỎ &amp; CÔNG TRÌNH 3D</span>
            <button id="btn-close-portfolio" class="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-slate-200">✕ Đóng</button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            ${owned.length === 0 ? '<div class="text-xs text-slate-400 text-center py-8">Bạn chưa sở hữu bất động sản nào.</div>' : owned.map(t => {
              const c = GROUP_COLORS[t.group] || GROUP_COLORS.NONE;
              const unmortCost = Math.ceil((t.mortgageValue || 0) * 1.1);
              const lvLabel = t.isMortgaged
                ? '🔒 Đang thế chấp'
                : t.level === 6
                  ? '🏙️ Landmark Cấp 6'
                  : t.level === 5
                    ? '🏨 Khách sạn 5 sao'
                    : t.level > 0
                      ? `🏠 ${t.level} Nhà phố`
                      : 'Đất trống';
              return `
                <div class="p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-3 h-8 rounded shrink-0" style="background:${c.primary}"></span>
                    <div class="truncate">
                      <div class="text-xs font-extrabold text-white truncate">${escapeHtml(t.name)}</div>
                      <div class="text-[11px] text-slate-400">${lvLabel}</div>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-1.5 shrink-0">
                    ${canBuildHouseState(state, myId, t.index) ? `<button data-build="${t.index}" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[11px] font-extrabold text-slate-950">+${t.level + 1 === 6 ? '🏙️' : t.level + 1 === 5 ? '🏨' : '🏠'} (-${t.buildCost}K)</button>` : ''}
                    ${canSellHouseState(state, myId, t.index) ? `<button data-sell="${t.index}" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-[11px] font-extrabold text-slate-950">-🏠 (+${Math.floor(t.buildCost * 0.5)}K)</button>` : ''}
                    ${canMortgageTileState(state, myId, t.index) ? `<button data-mort="${t.index}" class="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-bold text-amber-300">🔒 Cầm (+${t.mortgageValue}K)</button>` : ''}
                    ${canUnmortgageTileState(state, myId, t.index) ? `<button data-unmort="${t.index}" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white">🔓 Chuộc (-${unmortCost}K)</button>` : ''}
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
    const closePort = () => {
      this.showPortfolioModal = false;
      this.renderModals(state);
    };
    layer.querySelector('#btn-close-portfolio').onclick = closePort;
    layer.querySelector('#portfolio-backdrop').onclick = closePort;
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
      <div id="trade-backdrop" class="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-40 ui-interactive">
        <div class="w-full max-w-2xl bg-slate-900/95 border-2 border-slate-700 rounded-2xl p-4 space-y-3.5 shadow-2xl modal-pop" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <span class="font-extrabold text-sm text-amber-400">🤝 THƯƠNG LƯỢNG &amp; TRAO ĐỔI SỔ ĐỎ</span>
            <select id="sel-trade-partner" class="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white">
              ${partners.map(p => `<option value="${p.id}" ${p.id === this.tradePartnerId ? 'selected' : ''}>Đối tác: ${escapeHtml(p.name)} (${p.cash}K)</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div class="bg-slate-800/75 rounded-2xl p-3 space-y-2.5 border border-slate-700">
              <div class="font-extrabold text-emerald-400">BÊN ĐỀ NGHỊ (${escapeHtml(me?.name)})</div>
              <div>
                <label class="text-[11px] text-slate-400">Tiền mặt đưa thêm (Tối đa ${me?.cash || 0}K)</label>
                <input id="inp-offer-cash" type="number" min="0" max="${Math.max(0, me?.cash || 0)}" value="0"
                  class="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 mono-num text-white" />
              </div>
              <div class="max-h-40 overflow-y-auto space-y-1">
                ${myTradable.length === 0 ? '<div class="text-slate-500">Không có lô đất khả dụng</div>' : myTradable.map(t => `
                  <label class="flex items-center gap-2 py-1 cursor-pointer">
                    <input type="checkbox" name="offer-prop" value="${t.index}" />
                    <span>${escapeHtml(t.name)} (${t.price}K)</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="bg-slate-800/75 rounded-2xl p-3 space-y-2.5 border border-slate-700">
              <div class="font-extrabold text-amber-400">BÊN ĐỐI TÁC (${escapeHtml(partner?.name || '-')})</div>
              <div>
                <label class="text-[11px] text-slate-400">Tiền mặt yêu cầu (Tối đa ${partner?.cash || 0}K)</label>
                <input id="inp-req-cash" type="number" min="0" max="${Math.max(0, partner?.cash || 0)}" value="0"
                  class="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 mono-num text-white" />
              </div>
              <div class="max-h-40 overflow-y-auto space-y-1">
                ${partnerTradable.length === 0 ? '<div class="text-slate-500">Không có lô đất khả dụng</div>' : partnerTradable.map(t => `
                  <label class="flex items-center gap-2 py-1 cursor-pointer">
                    <input type="checkbox" name="req-prop" value="${t.index}" />
                    <span>${escapeHtml(t.name)} (${t.price}K)</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="flex gap-2.5 pt-2">
            <button id="btn-send-trade" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-extrabold text-xs text-white shadow-lg transition">
              📨 GỬI ĐỀ NGHỊ GIAO DỊCH
            </button>
            <button id="btn-cancel-trade" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300 transition">
              Hủy
            </button>
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
    const closeTrade = () => {
      this.showTradeModal = false;
      this.renderModals(state);
    };
    layer.querySelector('#btn-cancel-trade').onclick = closeTrade;
    layer.querySelector('#trade-backdrop').onclick = closeTrade;
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

    if (this.eventPopupCollapsed) {
      return `
        <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 ui-interactive modal-pop">
          <div class="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 border-indigo-500 shadow-2xl">
            <span>📩</span>
            <span class="text-xs font-bold text-white whitespace-nowrap">Đề nghị giao dịch từ <b class="text-indigo-300">${escapeHtml(fromP?.name)}</b></span>
            <button id="btn-accept-trade" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-extrabold text-[11px] text-slate-950">✅ Đồng ý</button>
            <button id="btn-reject-trade" class="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 font-extrabold text-[11px] text-white">❌ Từ chối</button>
            <button data-expand-popup class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-slate-200">🔼 Chi tiết</button>
          </div>
        </div>
      `;
    }

    return `
      <div data-collapse-backdrop class="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-40 ui-interactive">
        <div class="w-full max-w-sm bg-slate-900/95 border-2 border-indigo-500 rounded-2xl p-4 space-y-3 shadow-2xl modal-pop" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-extrabold text-indigo-300 truncate">📩 ĐỀ NGHỊ TỚI ${escapeHtml(toP?.name)}</div>
            <button data-collapse-popup class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 shrink-0">➖ Thu gọn</button>
          </div>
          <div class="text-[11.5px] text-slate-300 space-y-1.5 bg-slate-800/90 p-3 rounded-xl border border-slate-700">
            <div><b class="text-emerald-400">${escapeHtml(fromP?.name)} trao:</b> ${trade.offerCash}K + [${escapeHtml(offerNames)}]</div>
            <div><b class="text-amber-400">Bạn trao lại:</b> ${trade.requestCash}K + [${escapeHtml(reqNames)}]</div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button id="btn-accept-trade" class="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-extrabold text-xs text-slate-950">✅ ĐỒNG Ý</button>
            <button id="btn-reject-trade" class="py-2 rounded-xl bg-rose-700 hover:bg-rose-600 font-extrabold text-xs text-white">❌ TỪ CHỐI</button>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== 7. ĐỒNG HỒ ĐẤU GIÁ 10S & CHẾ ĐỘ SPEED 45P ====================

  startTimers() {
    this.auctionInterval = setInterval(() => {
      if (!this.state) return;

      if (this.state.phase === 'AUCTION_PHASE' && this.state.auction) {
        const bar = this.root.querySelector('#auction-timer-bar');
        if (bar) {
          const elapsed = performance.now() - this.auctionResetTimestamp;
          const pct = Math.max(0, 100 - (elapsed / (GAME_CONSTANTS.AUCTION_TIMER_SECONDS * 1000)) * 100);
          bar.style.width = `${pct}%`;
        }
      }

      const speedBadge = this.root.querySelector('#lbl-speed-timer');
      if (speedBadge && this.state.mode === 'SPEED' && this.state.startedAt && this.state.phase !== 'LOBBY') {
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
