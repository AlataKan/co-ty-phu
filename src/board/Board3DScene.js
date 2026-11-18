import { INITIAL_BOARD_TILES, GROUP_COLORS, PLAYER_PRESETS } from '../data/boardData.js';
import { MEGA_52_BOARD_TILES } from '../data/boardData52.js';
import { getTileRentInfo, ownsFullGroupUnmortgaged, hasJointVenture2Of3 } from '../core/stateRules.js';
import { createCubeFacesHTML, createSpeedCubeFacesHTML } from '../ui/dicePips.js';

function getGridPosition40(i) {
  if (i >= 0 && i <= 10)  return { row: 11, col: 11 - i };
  if (i >= 11 && i <= 20) return { row: 11 - (i - 10), col: 1 };
  if (i >= 21 && i <= 30) return { row: 1, col: 1 + (i - 20) };
  return { row: 1 + (i - 30), col: 11 };
}

function getGridPosition52(i) {
  if (i >= 0 && i <= 13)  return { row: 14, col: 14 - i };
  if (i >= 14 && i <= 26) return { row: 14 - (i - 13), col: 1 };
  if (i >= 27 && i <= 39) return { row: 1, col: 1 + (i - 26) };
  return { row: 1 + (i - 39), col: 14 };
}

const TOKEN_4_OFFSETS = [
  { left: '2px', right: 'auto', bottom: '20px', top: 'auto' },
  { left: 'auto', right: '2px', bottom: '20px', top: 'auto' },
  { left: '2px', right: 'auto', bottom: 'auto', top: '18px' },
  { left: 'auto', right: '2px', bottom: 'auto', top: '18px' }
];

// Ma trận 6 vị trí (3x2) quanh rìa ô đất cho chế độ 6 người chơi
const TOKEN_6_OFFSETS = [
  { left: '1px', right: 'auto', bottom: '18px', top: 'auto' },
  { left: 'calc(50% - 14.5px)', right: 'auto', bottom: '18px', top: 'auto' },
  { left: 'auto', right: '1px', bottom: '18px', top: 'auto' },
  { left: '1px', right: 'auto', bottom: 'auto', top: '16px' },
  { left: 'calc(50% - 14.5px)', right: 'auto', bottom: 'auto', top: '16px' },
  { left: 'auto', right: '1px', bottom: 'auto', top: '16px' }
];

const SINGLE_TOKEN_OFFSET_40 = {
  left: 'calc(50% - 17px)',
  right: 'auto',
  bottom: '19px',
  top: 'auto'
};

const SINGLE_TOKEN_OFFSET_52 = {
  left: 'calc(50% - 14.5px)',
  right: 'auto',
  bottom: '17px',
  top: 'auto'
};

export class Board3DScene {
  constructor(parentElementId, { onTileClick, onDeckClick } = {}) {
    this.parent = document.getElementById(parentElementId);
    this.onTileClick = onTileClick || (() => {});
    this.onDeckClick = onDeckClick || (() => {});
    this.boardPreset = 'STANDARD_40'; // 'STANDARD_40' | 'MEGA_52'
    this.boardSize = 40;
    this.cameraMode = 'isometric'; // 'isometric' | 'tilt' | 'top'
    this.soundEnabled = true;
    this.audioCtx = null;
    this.spinCount = 2;
    this.inspectedTileIndex = 39;
    this.lastState = null;

    this.tileRefs = new Map();
    this.tokenElements = new Map();

    this.buildDOM();
    this.setCameraPreset('isometric');
    this.renderShowcasePreview('STANDARD_40');

    window.addEventListener('resize', () => this.updateResponsiveScale());
  }

  buildDOM() {
    this.parent.innerHTML = `
      <main class="scene-viewport" id="scene-viewport">
        <div class="board-3d-wrapper" id="board-3d">
          <div class="monopoly-grid" id="monopoly-grid">
            <div class="center-court-3d" id="center-court-3d">
              <!-- Khay bài Cơ Hội 3D -->
              <div id="deck-chance-3d" class="card-deck-3d deck-chance" title="Xem bộ thẻ Cơ Hội">
                <span class="text-2xl">❓</span>
                <span class="text-xs font-extrabold tracking-wider uppercase text-white mt-1">CƠ HỘI</span>
                <span class="text-[9px] text-orange-100 opacity-85">Chạm xem thẻ</span>
              </div>

              <!-- Khu vực Đổ Xúc Xắc 3D & Thương hiệu trung tâm -->
              <div class="flex flex-col items-center justify-center text-center pointer-events-none">
                <div class="dice-stage">
                  <div class="cube-dice" id="dice-1">${createCubeFacesHTML()}</div>
                  <div class="cube-dice" id="dice-2">${createCubeFacesHTML()}</div>
                  <div class="cube-dice hidden" id="dice-speed" title="Xúc xắc Tốc độ">${createSpeedCubeFacesHTML()}</div>
                </div>

                <div class="px-5 py-2 rounded-2xl bg-slate-950/85 border border-amber-500/40 shadow-2xl">
                  <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    CỜ TỶ PHÚ VIỆT NAM
                  </h1>
                  <p id="board-subtitle-3d" class="text-[10.5px] font-semibold text-slate-400 tracking-widest uppercase mt-0.5">
                    Sa Bàn 3D Địa Danh &amp; Di Sản
                  </p>
                </div>
              </div>

              <!-- Khay bài Khí Vận 3D -->
              <div id="deck-community-3d" class="card-deck-3d deck-community" title="Xem bộ thẻ Khí Vận">
                <span class="text-2xl">🧧</span>
                <span class="text-xs font-extrabold tracking-wider uppercase text-slate-950 mt-1">KHÍ VẬN</span>
                <span class="text-[9px] text-amber-950 font-semibold opacity-85">Chạm xem thẻ</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;

    this.boardWrapperEl = this.parent.querySelector('#board-3d');
    this.gridEl = this.parent.querySelector('#monopoly-grid');
    this.centerCourtEl = this.parent.querySelector('#center-court-3d');
    this.subtitleEl = this.parent.querySelector('#board-subtitle-3d');
    this.dice1El = this.parent.querySelector('#dice-1');
    this.dice2El = this.parent.querySelector('#dice-2');
    this.diceSpeedEl = this.parent.querySelector('#dice-speed');

    this.parent.querySelector('#deck-chance-3d')?.addEventListener('click', () => {
      this.onDeckClick('CHANCE');
    });
    this.parent.querySelector('#deck-community-3d')?.addEventListener('click', () => {
      this.onDeckClick('COMMUNITY_CHEST');
    });

    this.buildTilesForPreset(this.boardPreset);
  }

  buildTilesForPreset(boardPreset = 'STANDARD_40') {
    this.boardPreset = boardPreset === 'MEGA_52' ? 'MEGA_52' : 'STANDARD_40';
    const is6P = this.boardPreset === 'MEGA_52';
    const tiles = is6P ? MEGA_52_BOARD_TILES : INITIAL_BOARD_TILES;
    this.boardSize = tiles.length;

    // Xóa các ô đất & token cũ, giữ lại sân trung tâm
    this.gridEl.querySelectorAll('.board-tile').forEach(el => el.remove());
    this.tileRefs.clear();
    this.tokenElements.forEach(el => el.remove());
    this.tokenElements.clear();

    this.boardWrapperEl.classList.toggle('is-6p', is6P);
    this.gridEl.className = is6P ? 'monopoly-grid-6p' : 'monopoly-grid';
    this.centerCourtEl.className = is6P ? 'center-court-3d center-court-6p' : 'center-court-3d';
    if (this.diceSpeedEl) {
      this.diceSpeedEl.classList.toggle('hidden', !is6P);
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = is6P
        ? 'Đại Chiến Lục Hùng • 52 Ô Địa Danh & Tuyến Metro'
        : 'Sa Bàn 3D Địa Danh & Di Sản (40 Ô)';
    }

    const corners = is6P ? [0, 13, 26, 39] : [0, 10, 20, 30];

    tiles.forEach((tile) => {
      const pos = is6P ? getGridPosition52(tile.index) : getGridPosition40(tile.index);
      const isCorner = corners.includes(tile.index);
      const el = document.createElement('div');
      el.id = `tile-${tile.index}`;
      el.className = `board-tile ${isCorner ? 'corner-tile' : ''}`;
      el.style.gridRow = String(pos.row);
      el.style.gridColumn = String(pos.col);
      el.addEventListener('click', () => this.onTileClick(tile.index));

      const groupColor = GROUP_COLORS[tile.group]?.primary || '#475569';
      const isPurchasable = tile.type === 'PROPERTY' || tile.type === 'STATION' || tile.type === 'UTILITY';

      let roofHTML = '';
      if (isPurchasable) {
        roofHTML = `
          <div class="color-roof" style="background:${groupColor}">
            <span class="monopoly-crown hidden">👑</span>
            <div class="roof-assets"></div>
            <div class="owner-marker hidden"></div>
          </div>
        `;
      } else {
        roofHTML = `<div class="text-center text-base leading-none pt-0.5">${tile.icon || ''}</div>`;
      }

      const displayLabel = tile.shortName || tile.name;
      const prefixIcon = tile.icon && (tile.type === 'STATION' || tile.type === 'UTILITY')
        ? `<span class="mr-0.5">${tile.icon}</span>`
        : '';

      const titleHTML = `<div class="tile-title">${prefixIcon}${displayLabel}</div>`;

      let pillDefault = '';
      if (tile.price) {
        pillDefault = `${tile.price}K`;
      } else if (tile.sub) {
        pillDefault = tile.sub;
      }

      const pillStyle = !tile.price && tile.sub ? 'style="background:#334155"' : '';
      const bottomHTML = pillDefault
        ? `<div class="tile-price-pill" ${pillStyle}>${pillDefault}</div>`
        : `<div></div>`;

      el.innerHTML = `${roofHTML}${titleHTML}${bottomHTML}`;
      this.gridEl.appendChild(el);

      this.tileRefs.set(tile.index, {
        el,
        assetsEl: el.querySelector('.roof-assets'),
        ownerEl: el.querySelector('.owner-marker'),
        crownEl: el.querySelector('.monopoly-crown'),
        pillEl: el.querySelector('.tile-price-pill'),
        renderedLevel: 0
      });
    });

    this.updateResponsiveScale();
  }

  renderShowcasePreview(boardPreset = 'STANDARD_40') {
    if (this.boardPreset !== boardPreset) {
      this.buildTilesForPreset(boardPreset);
    }

    const is6P = boardPreset === 'MEGA_52';
    const baseTiles = is6P ? MEGA_52_BOARD_TILES : INITIAL_BOARD_TILES;
    const demoBoard = baseTiles.map(t => ({ ...t, ownerId: null, level: 0, isMortgaged: false }));

    const demoSample = is6P
      ? [
          { idx: 4, owner: 'P1', level: 2 },
          { idx: 15, owner: 'P2', level: 3 },
          { idx: 20, owner: 'P3', level: 4 },
          { idx: 30, owner: 'P4', level: 5 },
          { idx: 40, owner: 'P5', level: 4 },
          { idx: 47, owner: 'P6', level: 5 },
          { idx: 51, owner: 'P1', level: 6 }
        ]
      : [
          { idx: 3, owner: 'P1', level: 2 },
          { idx: 9, owner: 'P1', level: 4 },
          { idx: 14, owner: 'P2', level: 3 },
          { idx: 24, owner: 'P3', level: 5 },
          { idx: 29, owner: 'P4', level: 5 },
          { idx: 37, owner: 'P2', level: 3 },
          { idx: 39, owner: 'P1', level: 5 }
        ];

    demoSample.forEach(s => {
      if (demoBoard[s.idx]) {
        demoBoard[s.idx].ownerId = s.owner;
        demoBoard[s.idx].level = s.level;
      }
    });

    const count = is6P ? 6 : 4;
    const samplePositions = is6P ? [0, 6, 15, 26, 37, 47] : [0, 9, 20, 29];
    const demoPlayers = PLAYER_PRESETS.slice(0, count).map((preset, i) => ({
      id: preset.id,
      short: preset.short,
      name: preset.defaultName,
      color: preset.color,
      icon: preset.icon,
      position: samplePositions[i] || 0,
      inJail: false,
      isBankrupt: false
    }));

    const defaultInspect = is6P ? 51 : 39;
    this.syncBoardState({
      boardPreset,
      board: demoBoard,
      players: demoPlayers,
      activePlayerIndex: 0,
      dice: [1, 6],
      speedDie: is6P ? 3 : null
    }, defaultInspect);
  }

  setCameraPreset(mode) {
    this.cameraMode = mode;
    const root = document.documentElement;
    if (mode === 'isometric') {
      root.style.setProperty('--tilt-angle', '48deg');
      root.style.setProperty('--rotate-z', '-28deg');
    } else if (mode === 'tilt') {
      root.style.setProperty('--tilt-angle', '42deg');
      root.style.setProperty('--rotate-z', '0deg');
    } else {
      root.style.setProperty('--tilt-angle', '0deg');
      root.style.setProperty('--rotate-z', '0deg');
    }
    this.updateResponsiveScale();
  }

  getCameraPreset() {
    return this.cameraMode;
  }

  updateResponsiveScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isDesktop = vw >= 1024;
    const availW = isDesktop ? Math.max(360, vw - 468) : Math.max(300, vw - 24);
    const availH = Math.max(320, vh - 72);
    const is6P = this.boardPreset === 'MEGA_52';

    let scale = is6P ? 0.84 : 0.88;
    if (this.cameraMode === 'isometric') {
      scale = Math.min(is6P ? 0.85 : 0.9, availW / (is6P ? 1220 : 1140), availH / (is6P ? 845 : 790));
    } else if (this.cameraMode === 'tilt') {
      scale = Math.min(is6P ? 0.85 : 0.9, availW / (is6P ? 975 : 910), availH / (is6P ? 790 : 740));
    } else {
      scale = Math.min(is6P ? 0.84 : 0.88, availW / (is6P ? 940 : 880), availH / (is6P ? 940 : 880));
    }
    scale = Math.max(0.34, Number(scale.toFixed(3)));
    document.documentElement.style.setProperty('--board-scale', String(scale));
  }

  setInspectedTile(tileIndex) {
    this.inspectedTileIndex = tileIndex;
    this.tileRefs.forEach((ref, idx) => {
      ref.el.classList.toggle('inspected-tile', idx === tileIndex);
    });
  }

  syncBoardOwnersAndBuildings(board, players, activePlayerIndex = 0, dice = [1, 1]) {
    const preset = board?.length === 52 ? 'MEGA_52' : 'STANDARD_40';
    this.syncBoardState(
      { boardPreset: preset, board, players, activePlayerIndex, dice },
      this.inspectedTileIndex
    );
  }

  syncBoardState(state, inspectedTileIndex = this.inspectedTileIndex) {
    if (!state || !state.board) return;
    const targetPreset = state.boardPreset || (state.board.length === 52 ? 'MEGA_52' : 'STANDARD_40');
    if (targetPreset !== this.boardPreset || state.board.length !== this.boardSize) {
      this.buildTilesForPreset(targetPreset);
      if (inspectedTileIndex >= state.board.length) {
        inspectedTileIndex = state.board.length - 1;
      }
    }

    this.lastState = state;
    if (inspectedTileIndex !== undefined && inspectedTileIndex !== null) {
      this.inspectedTileIndex = Math.min(state.board.length - 1, Math.max(0, inspectedTileIndex));
    }

    const activePlayer = state.players?.[state.activePlayerIndex];
    const viewerId = activePlayer?.id || null;
    const playerMap = new Map((state.players || []).map(p => [p.id, p]));

    state.board.forEach((tile) => {
      const ref = this.tileRefs.get(tile.index);
      if (!ref) return;

      ref.el.classList.toggle('inspected-tile', tile.index === this.inspectedTileIndex);
      ref.el.classList.toggle('mortgaged-tile', Boolean(tile.isMortgaged));

      const owner = tile.ownerId ? playerMap.get(tile.ownerId) : null;

      // 1. Cờ chủ sở hữu & Vương miện độc quyền / Liên doanh 2/3
      if (ref.ownerEl) {
        if (owner) {
          ref.ownerEl.style.background = owner.color;
          ref.ownerEl.title = `Sở hữu bởi ${owner.name}`;
          ref.ownerEl.classList.remove('hidden');
        } else {
          ref.ownerEl.classList.add('hidden');
        }
      }

      if (ref.crownEl) {
        const hasMono = owner && tile.type === 'PROPERTY' && ownsFullGroupUnmortgaged(state, owner.id, tile.group);
        const hasJV = !hasMono && owner && tile.type === 'PROPERTY' && hasJointVenture2Of3(state, owner.id, tile.group);
        if (hasMono) {
          ref.crownEl.textContent = '👑';
          ref.crownEl.title = 'Độc quyền trọn bộ màu (x2 đất trống & mở khóa Khách sạn/Landmark)';
          ref.crownEl.classList.remove('hidden');
        } else if (hasJV) {
          ref.crownEl.textContent = '🏗️';
          ref.crownEl.title = 'Liên doanh Đô thị (2/3 bộ màu: Xây tối đa 2 Nhà phố)';
          ref.crownEl.classList.remove('hidden');
        } else {
          ref.crownEl.classList.add('hidden');
        }
      }

      // 2. Nhà phố 3D (1..4), Khách sạn 3D (5) & Siêu Quần Thể Landmark 3D (6)
      if (ref.assetsEl && ref.renderedLevel !== tile.level) {
        ref.renderedLevel = tile.level;
        if (tile.level >= 1 && tile.level <= 4) {
          let html = '';
          for (let h = 0; h < tile.level; h++) {
            html += `<div class="asset-3d-house" title="Nhà phố cấp ${tile.level}"></div>`;
          }
          ref.assetsEl.innerHTML = html;
        } else if (tile.level === 5) {
          ref.assetsEl.innerHTML = `<div class="asset-3d-hotel" title="Khách sạn 5 sao">🏨</div>`;
        } else if (tile.level >= 6) {
          ref.assetsEl.innerHTML = `<div class="asset-3d-landmark" title="Siêu Quần Thể Landmark">🏙️</div>`;
        } else {
          ref.assetsEl.innerHTML = '';
        }
      }

      // 3. Nhãn Giá Mua / Tiền Thuê Hiện Tại / Quỹ Lễ Hội (#26)
      if (ref.pillEl) {
        if (tile.price) {
          if (!owner) {
            ref.pillEl.textContent = `${tile.price}K`;
            ref.pillEl.className = 'tile-price-pill';
          } else {
            const rentInfo = getTileRentInfo(state, tile, viewerId);
            if (rentInfo?.isMortgaged) {
              ref.pillEl.textContent = rentInfo.pillText;
              ref.pillEl.className = 'tile-price-pill is-mortgaged';
            } else if (rentInfo?.isAllyFree) {
              ref.pillEl.textContent = rentInfo.pillText;
              ref.pillEl.className = 'tile-price-pill is-festival';
            } else if (rentInfo) {
              ref.pillEl.textContent = rentInfo.pillText;
              ref.pillEl.className = 'tile-price-pill is-rent';
            }
          }
        } else if (tile.type === 'FREE_PARKING' && this.boardPreset === 'MEGA_52') {
          if (state.festivalFund > 0) {
            ref.pillEl.textContent = `⛲+${state.festivalFund}K`;
            ref.pillEl.className = 'tile-price-pill is-festival';
          } else {
            ref.pillEl.textContent = tile.sub || 'Quỹ Thưởng';
            ref.pillEl.className = 'tile-price-pill';
          }
        }
      }
    });

    this.syncTokens3D(state.players || [], state.activePlayerIndex ?? 0);
  }

  syncTokens3D(players, activePlayerIndex = 0) {
    const activeIds = new Set(players.filter(p => !p.isBankrupt).map(p => p.id));
    for (const [pid, el] of this.tokenElements.entries()) {
      if (!activeIds.has(pid)) {
        el.remove();
        this.tokenElements.delete(pid);
      }
    }

    const occupantsByTile = new Map();
    players.forEach((p, idx) => {
      if (p.isBankrupt) return;
      if (!occupantsByTile.has(p.position)) occupantsByTile.set(p.position, []);
      occupantsByTile.get(p.position).push({ player: p, idx });
    });

    const is6P = this.boardPreset === 'MEGA_52';
    const singleOffset = is6P ? SINGLE_TOKEN_OFFSET_52 : SINGLE_TOKEN_OFFSET_40;

    players.forEach((p, idx) => {
      if (p.isBankrupt) return;
      const preset = PLAYER_PRESETS[idx] || PLAYER_PRESETS[0];
      const icon = p.icon || preset.icon || '⭐';
      const shortTag = p.short || p.id;
      const isCurrentTurn = idx === activePlayerIndex;

      let token = this.tokenElements.get(p.id);
      if (!token) {
        token = document.createElement('div');
        token.id = `token-${p.id}`;
        this.tokenElements.set(p.id, token);
      }

      token.className = `player-token-3d ${isCurrentTurn ? 'active-turn-token' : ''}`;
      token.style.background = `radial-gradient(circle at 30% 30%, #ffffff 0%, ${p.color} 45%, #0f172a 100%)`;
      token.style.setProperty('--token-color', p.color);
      token.innerHTML = `
        <span>${icon}</span>
        <span class="token-tag" style="border-color:${p.color}">${p.inJail ? `⛓️${shortTag}` : shortTag}</span>
      `;

      const tileGroup = occupantsByTile.get(p.position) || [];
      const slotInTile = Math.max(0, tileGroup.findIndex(item => item.player.id === p.id));

      let offset = singleOffset;
      if (tileGroup.length > 1) {
        offset = (is6P || tileGroup.length > 4)
          ? TOKEN_6_OFFSETS[slotInTile % 6]
          : TOKEN_4_OFFSETS[slotInTile % 4];
      }

      Object.assign(token.style, offset);

      const tileRef = this.tileRefs.get(p.position);
      if (tileRef && token.parentElement !== tileRef.el) {
        tileRef.el.appendChild(token);
      }
    });
  }

  // ==================== HIỆU ỨNG DIỄN HOẠT 3D BẤT ĐỒNG BỘ ====================

  rotateSingleDie(el, val, baseDeg) {
    if (!el) return;
    const faceOffsets = {
      1: { rx: 0, ry: 0 },
      6: { rx: 0, ry: 180 },
      2: { rx: 0, ry: 270 },
      5: { rx: 0, ry: 90 },
      3: { rx: 270, ry: 0 },
      4: { rx: 90, ry: 0 }
    };
    const off = faceOffsets[val] || faceOffsets[1];
    el.style.transform = `rotateX(${baseDeg + off.rx}deg) rotateY(${baseDeg + off.ry}deg)`;
  }

  animateDiceRoll(d1, d2, speedDie = null) {
    this.spinCount += 2;
    const baseDeg = this.spinCount * 360;
    this.rotateSingleDie(this.dice1El, d1, baseDeg);
    this.rotateSingleDie(this.dice2El, d2, baseDeg + 360);

    if (this.diceSpeedEl && this.boardPreset === 'MEGA_52') {
      if (speedDie !== null && speedDie !== undefined) {
        this.diceSpeedEl.classList.remove('hidden');
        const speedFaceIdx = typeof speedDie === 'number'
          ? speedDie
          : speedDie === 'BUS'
            ? 4
            : 6;
        this.rotateSingleDie(this.diceSpeedEl, speedFaceIdx, baseDeg + 720);
      }
    }

    this.playStepSound(540, 0.08);
    setTimeout(() => this.playStepSound(460, 0.07), 220);

    return new Promise((resolve) => {
      setTimeout(resolve, 750);
    });
  }

  animateTokenMove(playerId, from, to, passedStart = false) {
    const token = this.tokenElements.get(playerId);
    if (!token || from === to) return Promise.resolve();

    const B = this.boardSize || 40;
    const path = [];
    const diffBackward = (from - to + B) % B;

    if (!passedStart && diffBackward > 0 && diffBackward <= 3) {
      for (let step = 1; step <= diffBackward; step++) {
        path.push((from - step + B) % B);
      }
    } else {
      let cur = from;
      while (cur !== to) {
        cur = (cur + 1) % B;
        path.push(cur);
        if (path.length > B + 2) break;
      }
    }

    if (path.length === 0) return Promise.resolve();

    const singleOffset = this.boardPreset === 'MEGA_52' ? SINGLE_TOKEN_OFFSET_52 : SINGLE_TOKEN_OFFSET_40;
    const stepDelay = path.length > 12 ? 125 : 160;

    return new Promise((resolve) => {
      let idx = 0;
      const hopNext = () => {
        if (idx >= path.length) {
          token.classList.remove('hopping');
          resolve();
          return;
        }

        const nextTileIdx = path[idx];
        const tileRef = this.tileRefs.get(nextTileIdx);
        if (tileRef) {
          Object.assign(token.style, singleOffset);
          tileRef.el.appendChild(token);
          token.classList.remove('hopping');
          void token.offsetWidth;
          token.classList.add('hopping');
          this.playStepSound(330 + (idx % 6) * 28, 0.055);
        }

        idx += 1;
        setTimeout(hopNext, stepDelay);
      };

      hopNext();
    });
  }

  animateTokenJail(playerId, toIndex = 10) {
    const token = this.tokenElements.get(playerId);
    const tileRef = this.tileRefs.get(toIndex);
    if (!token || !tileRef) return Promise.resolve();

    const singleOffset = this.boardPreset === 'MEGA_52' ? SINGLE_TOKEN_OFFSET_52 : SINGLE_TOKEN_OFFSET_40;

    return new Promise((resolve) => {
      this.playStepSound(210, 0.12);
      Object.assign(token.style, singleOffset);
      tileRef.el.appendChild(token);
      token.classList.remove('hopping');
      void token.offsetWidth;
      token.classList.add('hopping');
      setTimeout(() => {
        token.classList.remove('hopping');
        resolve();
      }, 420);
    });
  }

  showFloatingText(tileIndex, amount) {
    if (!amount) return;
    const tileRef = this.tileRefs.get(tileIndex ?? 0);
    if (!tileRef) return;

    const rect = tileRef.el.getBoundingClientRect();
    const isPositive = amount > 0;
    const color = isPositive ? '#22c55e' : '#ef4444';
    const text = `${isPositive ? '+' : ''}${amount}K`;

    const floatEl = document.createElement('div');
    floatEl.className = 'floating-money';
    floatEl.style.left = `${rect.left + rect.width / 2}px`;
    floatEl.style.top = `${rect.top}px`;
    floatEl.style.background = '#0f172a';
    floatEl.style.color = color;
    floatEl.style.border = `2px solid ${color}`;
    floatEl.textContent = text;
    document.body.appendChild(floatEl);

    this.playStepSound(isPositive ? 660 : 240, 0.08);
    setTimeout(() => floatEl.remove(), 1250);
  }

  playStepSound(freq = 340, duration = 0.065) {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration + 0.01);
    } catch {
      // Bỏ qua nếu trình duyệt chưa cho phép phát âm thanh trước khi click
    }
  }
}

export function createBoard3D(parentElementId, callbacks) {
  const boardScene = new Board3DScene(parentElementId, callbacks);
  return { boardScene };
}
